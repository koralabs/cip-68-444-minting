# Contract Code Paths

## Migration Note (Aiken + MPF)
- The active on-chain implementation now lives in Aiken (`validators/*.ak`, `lib/cip_68_444/*.ak`).
- This Helios document remains the canonical baseline path inventory used for parity.
- Aiken parity tests live in `lib/cip_68_444/path_tests.ak` and are guarded by `tests/aikenPathParity.test.ts`.
- One structural migration change:
  - Stable proxy validators now enforce a `withdraw 0` observer witness:
    - mint proxy checks `settings.mint_governor`
    - editing proxy checks `settings.editing_governor`
  - Logic is executed in observer withdrawal validators, so policy ID / script address can remain stable across logic upgrades.
  - `settings.assets` remains the source of per-asset metadata (price, discounts, required UTxO, validity).
  - MPF is used for asset-name key membership (`mpf.has(...)`) rather than storing full asset metadata.
  - The former Helios dynamic discount-data decode hazards (`M-COST-10`, `M-COST-11`) are represented in Aiken via typed data decoding boundaries and explicit malformed datum tests (`mint_settings_*_decode_fails`, `mint_deny_config_decode_fails`) plus MPF proof-mismatch rejection (`mpf_proof_mismatch_rejected`).

This document inventories every branch and failure path in:
- `minting.helios`
- `editing.helios`

The goal is to treat each code path as either:
- a feature path (allowed behavior), or
- an assertion path (required invariant/enforcement).

## Helios Semantics Used
- `if/else` and `switch` are expressions (`https://helios-lang.io/docs/lang/control-flow/`).
- `Option` has `Some`/`None`; `unwrap()` throws on `None` (`https://helios-lang.io/docs/lang/builtins/option/`).
- `List.find` throws if nothing matches; `List.find_safe` returns `Option`; `List.get_singleton` requires exactly one item (`https://helios-lang.io/docs/lang/builtins/list/`).
- `Map.get`/`Map.find` throw if missing; `Map.get_safe` is optional (`https://helios-lang.io/docs/lang/builtins/map/`).
- `OutputDatum.get_inline_data()` throws unless datum is inline (`https://helios-lang.io/docs/lang/builtins/outputdatum/`).
- `Value.get_policy` throws if policy missing; `Value.get_safe` returns `0` when missing (`https://helios-lang.io/docs/lang/builtins/value/`).
- `ScriptContext.get_current_minting_policy_hash()` is valid only in minting scripts (`https://helios-lang.io/docs/lang/builtins/scriptcontext/`).

## `minting.helios` Code Paths

### 1. `load_config(ctx)` (`minting.helios:46`)
1. Path M-LOAD-CONFIG-1 (feature): a reference input containing exactly `1` `CONFIG_HANDLE` token exists (`47-49`), datum is inline and decodes as `MintConfig` (`51`), function returns config (`53`).
2. Path M-LOAD-CONFIG-2 (assertion): no matching config ref input, fails `assert(..., "mint_config_444 reference input missing")` (`50`).
3. Path M-LOAD-CONFIG-3 (assertion): matching ref input exists but datum is not inline, `get_inline_data()` throws (`51`).
4. Path M-LOAD-CONFIG-4 (assertion): inline datum exists but fails `MintConfig::from_data(...)` decode (`51`).

### 2. `load_settings(ctx)` (`minting.helios:56`)
1. Path M-LOAD-SETTINGS-1 (assertion): both settings sources missing (`57-62`), fails `assert(..., "settings input missing")` (`64`).
2. Path M-LOAD-SETTINGS-2 (feature): settings output exists (`66`), returns decoded output datum and `signed_by_owner=true` (`67`).
3. Path M-LOAD-SETTINGS-3 (assertion): output branch selected, but output datum not inline (`67`), `get_inline_data()` throws.
4. Path M-LOAD-SETTINGS-4 (assertion): output branch selected, inline datum malformed for `MintSettings::from_data(...)` (`67`).
5. Path M-LOAD-SETTINGS-5 (feature): output missing, ref input exists, owner credential is `PubKey`, signatory present (`70-74`), returns settings + `signed_by_owner=true` (`75`).
6. Path M-LOAD-SETTINGS-6 (feature): same as above, signatory absent, returns settings + `signed_by_owner=false` (`75`).
7. Path M-LOAD-SETTINGS-7 (assertion): ref input owner credential is not `PubKey`, credential switch hits `error("Invalid credential hash")` (`71-73`).
8. Path M-LOAD-SETTINGS-8 (assertion): ref-input branch datum not inline, `get_inline_data()` throws (`75`).
9. Path M-LOAD-SETTINGS-9 (assertion): ref-input branch datum decode to `MintSettings` fails (`75`).

### 3. `get_mint_fee(payment, config)` (`minting.helios:79`)
1. Path M-FEE-1 (feature): sorted `fee_schedule` has at least one row where `payment >= threshold` (`80-82`), returns second element (`83`).
2. Path M-FEE-2 (assertion): no row satisfies `payment >= threshold`, `find(...)` throws (`80-82`).
3. Path M-FEE-3 (assertion): matched row has no index `1`, `fee.get(1)` throws (`83`).

### 4. `get_mint_cost(asset, settings, config, ctx)` (`minting.helios:86`)
1. Path M-COST-1 (assertion, static-only): `asset` does not start with label `444`, fails `assert(..., "Asset is not a (444) token")` (`88`). In canonical flow this is guarded by caller branch `key.starts_with(LBL_444)` before `get_mint_cost(...)`.
2. Path M-COST-2 (assertion): no matching `MintAsset` by exact name, fails `assert(..., "Asset not found in policy")` (`89-90`).
3. Path M-COST-3 (feature): `discount == [][]Data{}`, uses base `mint_asset.price` (`92`).
4. Path M-COST-4 (feature): discount list non-empty; builds discount map by folding entries (`95-97`), sorts by discount price ascending (`98`), then lazily picks first qualifying discount (`99-120`).
5. Path M-COST-5 (feature): for a discount rule, inner output scan finds enough qualifying tokens (`100-116`) so discounted price becomes `discount.get(1)` (`117`).
6. Path M-COST-6 (feature): discount rule not met, continues to next rule via `next()` (`119`).
7. Path M-COST-7 (feature): no discount rule qualifies, falls back to base price (`120`).
8. Path M-COST-8 (feature): in inner asset counting, policy key length is `<= 28`, so asset-prefix test is never entered (`105-107`) and this rule contributes zero for that output.
9. Path M-COST-9 (feature): output has no tokens for requested policy (`get_safe(...)=None`), contributes `0` (`102-111`).
10. Path M-COST-10 (assertion): malformed discount entry data causes `ByteArray::from_data` or `[]Int::from_data` failure (`96`).
11. Path M-COST-11 (assertion): malformed discount vectors cause `.get(0)`/`.get(1)` out-of-range failures (`98`, `112`, `116`, `117`).
12. Path M-COST-12 (assertion): `get_mint_fee(...)` fails by any `M-FEE-*` path (`122`).
13. Path M-COST-13 (feature): `valid_until <= 0`, no time-bound checks, returns computed cost (`124`, `129`).
14. Path M-COST-14 (assertion): `valid_until > 0` and tx validity width exceeds 15 minutes, fails `assert(..., "Invalid slot range for asset")` (`124-125`).
15. Path M-COST-15 (assertion): `valid_until > 0`, width valid, but start time is not before `valid_until`, fails `assert(..., "This asset minting has expired")` (`126`).
16. Path M-COST-16 (feature): `valid_until > 0`, both time assertions pass, returns computed cost (`127`).

### 5. `main(MINT, ctx)` (`minting.helios:132`, `136`)
1. Path M-MINT-1 (feature): settings loaded (`133`) via any `M-LOAD-SETTINGS-*` success path.
2. Path M-MINT-2 (assertion, defensive): `ctx.tx.minted.get_policy(...)` fails if current policy key absent in minted `Value` (`134`). Canonical minting transactions include the current policy key; this path is treated as defensive/static coverage.
3. Path M-MINT-3 (feature): if any minted asset starts with `444`, config loaded from ref input (`137`) via `M-LOAD-CONFIG-*`.
4. Path M-MINT-4 (feature): if no minted `444` assets, uses default config `MintConfig{#, [][]Int{}}` (`137`).
5. Path M-MINT-5 (feature): fold item key starts with `444` (`140`), calls `get_mint_cost` (`141`), updates:
   - payment: `+0` when `signed_by_owner=true`,
   - payment: `+minted_cost.payment * value` when `signed_by_owner=false`,
   - fee: always `+minted_cost.fee * value` (`142`).
6. Path M-MINT-6 (assertion): non-`444` key fails uniqueness check when multiple settings entries equal `key`, fails `assert(..., "Duplicate asset found: ...")` (`147`).
7. Path M-MINT-7 (feature): non-`444`, non-duplicate, key starts with `100` (`148`), enters reference-token mint path.
8. Path M-MINT-8 (assertion): in `100` path, matching-by-suffix settings list is not exactly one item, `.get_singleton()` throws (`151-153`).
9. Path M-MINT-9 (assertion): required UTxO from settings is not consumed, fails `assert(..., "Required UTxO is missing")` (`155-157`).
10. Path M-MINT-10 (assertion): `100` path not signed by settings owner, fails `assert(..., "Missing policy owner signature")` (`160`).
11. Path M-MINT-11 (assertion): no output contains exactly one minted reference token `AssetClass(policy, key)`, `find(...)` throws (`162-164`).
12. Path M-MINT-12 (assertion): reference-token output exists but wrong address, fails `assert(..., "Reference Token not sent to reference_token_address")` (`167`).
13. Path M-MINT-13 (assertion): `minted_assets.get(key) != 1`, fails `assert(..., "Only 1 Reference token can be minted with this asset name:...")` (`170`).
14. Path M-MINT-14 (feature): `100` path all checks pass; fold keeps previous costs unchanged (`171`).
15. Path M-MINT-15 (feature): non-`444`, non-`100`, key is empty `#` (`174`), enters royalties branch.
16. Path M-MINT-16 (assertion): royalties branch not signed by owner, fails `assert(..., "Missing policy owner signature")` (`175`).
17. Path M-MINT-17 (assertion): royalties branch has non-empty `settings.assets`, fails `assert(..., "There can be no Assets listed for a royalties mint")` (`176`).
18. Path M-MINT-18 (feature): royalties branch signed and assets empty; fold keeps costs unchanged (`177`).
19. Path M-MINT-19 (assertion): non-`444`/`100`/`#` key, fails `error("Invalid asset_name_label for this policy. Must be (100) or (444)")` (`179`).
20. Path M-MINT-20 (feature): after fold, `total.payment <= 0`, payment-output check bypassed (`183`).
21. Path M-MINT-21 (assertion): `total.payment > 0` and no output to `settings.payment_address` containing required lovelace, fails `assert(..., "Policy minting payment is unpaid: ...")` (`183-185`).
22. Path M-MINT-22 (feature): `total.payment > 0` and required payment output exists (`183-185`).
23. Path M-MINT-23 (feature): `total.fee <= 0`, fee-output check bypassed (`187`).
24. Path M-MINT-24 (assertion): `total.fee > 0` and no output to `config.fee_address` containing required lovelace, fails `assert(..., "Minting fee is unpaid")` (`187-189`).
25. Path M-MINT-25 (feature): `total.fee > 0` and required fee output exists (`187-189`).
26. Path M-MINT-26 (feature): all checks pass, returns `true` (`191`).

### 6. `main(BURN, ctx)` (`minting.helios:193`)
1. Path M-BURN-1 (assertion): minted set contains any asset not label `100` or any non-negative amount, fails `assert(..., "The BURN redeemer only allows reference tokens to be burnt")` (`194`).
2. Path M-BURN-2 (feature): all minted entries satisfy label `100` and `amount < 0`; continues per-asset checks (`194-206`).
3. Path M-BURN-3 (feature): for each burned asset, summed input holdings under current policy plus burn amount remains positive (`196-205`), so at least one reference token remains.
4. Path M-BURN-4 (assertion): for any burned asset, `total_input + amount <= 0`, fails `assert(..., "There should be at least one reference token remaining")` (`205`).
5. Path M-BURN-5 (feature): all per-asset checks pass, returns `true` (`207`).

### 7. Minting Contract Assertion Message Index
- `mint_config_444 reference input missing` (`50`)
- `settings input missing` (`64`)
- `Invalid credential hash` (`73`)
- `Asset is not a (444) token` (`88`)
- `Asset not found in policy` (`90`)
- `Invalid slot range for asset` (`125`)
- `This asset minting has expired` (`126`)
- `Duplicate asset found: ...` (`147`)
- `Required UTxO is missing` (`157`)
- `Missing policy owner signature` (`160`, `175`)
- `Reference Token not sent to reference_token_address` (`167`)
- `Only 1 Reference token can be minted with this asset name:...` (`170`)
- `There can be no Assets listed for a royalties mint` (`176`)
- `Invalid asset_name_label for this policy. Must be (100) or (444)` (`179`)
- `Policy minting payment is unpaid: ...` (`185`)
- `Minting fee is unpaid` (`189`)
- `The BURN redeemer only allows reference tokens to be burnt` (`194`)
- `There should be at least one reference token remaining` (`205`)

## `editing.helios` Code Paths

### 1. `load_settings(ctx)` (`editing.helios:42`)
This is functionally the same branch set as `minting.helios` `load_settings`:
1. Path E-LOAD-SETTINGS-1 (assertion): both ref-input and output settings missing -> `settings input missing` (`50`).
2. Path E-LOAD-SETTINGS-2 (feature): settings output branch -> returns settings + `signed_by_owner=true` (`52-54`).
3. Path E-LOAD-SETTINGS-3 (assertion): output datum not inline -> `get_inline_data()` throws (`53`).
4. Path E-LOAD-SETTINGS-4 (assertion): output datum decode fails (`53`).
5. Path E-LOAD-SETTINGS-5 (feature): ref-input branch + owner signature present -> returns settings + `true` (`56-62`).
6. Path E-LOAD-SETTINGS-6 (feature): ref-input branch + owner signature absent -> returns settings + `false` (`56-62`).
7. Path E-LOAD-SETTINGS-7 (assertion): non-pubkey owner credential -> `error("Invalid credential hash")` (`57-59`).
8. Path E-LOAD-SETTINGS-8 (assertion): ref-input datum not inline (`61`).
9. Path E-LOAD-SETTINGS-9 (assertion): ref-input datum decode fails (`61`).

### 2. `main(_, redeemer, ctx)` (`editing.helios:65`)
1. Path E-MAIN-1 (feature): `redeemer` is `UPDATE_REFERENCE_TOKEN` (`68`), enters update path.
2. Path E-MAIN-2 (assertion): no output contains exactly one token `AssetClass(MINTING_POLICY_ID, r.asset)`, fails `assert(..., "Reference token output missing")` (`69-73`).
3. Path E-MAIN-3 (assertion): matching output exists but address is not `settings.reference_token_address`, fails `assert(..., "Reference Token not sent to reference_token_address")` (`77`).
4. Path E-MAIN-4 (assertion): owner not signed, fails `assert(..., "Missing policy owner signature")` (`80`).
5. Path E-MAIN-5 (feature): update path passes all checks, returns `true` (`81`).
6. Path E-MAIN-6 (feature/deny-by-default): `switch` default case returns `false` (`83-85`).
7. Path E-MAIN-7 (parameter-dependent/defensive): `MintingPolicyHash::new(MINTING_POLICY_ID)` is executed on the update path (`70`). Behavior depends on parameter bytes and runtime matching; tests cover this via non-standard parameterization.

### 3. Editing Contract Assertion Message Index
- `settings input missing` (`50`)
- `Invalid credential hash` (`59`)
- `Reference token output missing` (`73`)
- `Reference Token not sent to reference_token_address` (`77`)
- `Missing policy owner signature` (`80`)

## Notes On Implicit Failure Paths
- Any `from_data(...)` decode is a hard assertion in practice: malformed datum/redeemer data causes evaluation failure.
- Any non-safe accessor (`find`, `get`, `unwrap`, `get_singleton`, `get_inline_data`, `get_policy`) introduces an implicit assertion path even without an explicit `assert(...)`.
- All path outcomes above are on-chain validator outcomes (success or script failure); there is no fallback behavior in either contract.
