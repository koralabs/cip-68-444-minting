# CIP-68 (444) Minting Architecture And Data Flow

## Scope
This document explains how the repository is structured, how validation data moves through the Aiken and TypeScript surfaces, and where the important boundaries sit between stable on-chain identifiers, upgradeable logic, collection-specific settings, and repo-level deployment automation.

It complements the shorter `spec.md` file. Use `spec.md` for the compact statement of contract responsibilities and type names. Use this document when you need to understand how the pieces fit together in code.

## Repository Layout
The repo is organized into five meaningful areas:

### 1. Stable and observer validators
- `validators/minting.ak`
- `validators/minting_observer.ak`
- `validators/editing.ak`
- `validators/editing_observer.ak`

The stable validator files are the parameterized on-chain entrypoints that should keep their policy ID or script address stable across logic upgrades. The observer files hold the real business logic through withdrawal validators.

### 2. Shared Aiken library code
- `lib/cip_68_444/common.ak`
- `lib/cip_68_444/minting.ak`
- `lib/cip_68_444/editing.ak`
- `lib/cip_68_444/types.ak`
- `lib/cip_68_444/constants.ak`
- `lib/cip_68_444/path_tests.ak`

This folder contains the typed logic shared by validators plus the path-level tests that preserve behavioral parity with the historical Helios implementation.

### 3. Legacy Helios sources
- `minting.helios`
- `editing.helios`

These files are still valuable even though the active implementation now lives in Aiken. They serve as the original behavior baseline and remain the source material for `docs/spec/code-paths.md` and for the Helios-based scenario suite in `tests/tests.ts`.

### 4. Deployment-planning code
- `src/deploymentState.ts`
- `src/deploymentPlan.ts`
- `scripts/generateDeploymentPlan.ts`
- `deploy/<network>/cip-68-444-settings.yaml`
- `.github/workflows/deployment-plan.yml`

These files are responsible for parsing committed desired state, reading live state through the Handles API, comparing the two, and writing approval-ready artifacts.

### 5. Test harnesses
- `tests/tests.ts`
- `tests/*.test.ts`
- `test_coverage.sh`
- `test_coverage.report`

The repo intentionally tests both the contract logic and the deployment-planning utilities. That matters because documentation changes in this repo are expected to stay consistent with both surfaces.

## Stable Proxy Plus Observer Pattern
The most important architectural change from the old Helios-only model is the proxy-plus-observer split.

### Stable proxy role
`validators/minting.ak` and `validators/editing.ak` do almost no business work. They delegate to `minting_proxy.validate` and `editing_proxy.validate`, whose job is to confirm that the transaction includes a withdrawal of amount `0` from the expected governor script hash stored in settings.

The proxy layer therefore protects two stable identifiers:

- the minting policy ID for collection minting and burning,
- the spending script address for the reference-token editing surface.

### Observer role
`validators/minting_observer.ak` and `validators/editing_observer.ak` expose withdrawal validators. They deserialize typed redeemers and call the real logic in `lib/cip_68_444/minting.ak` and `lib/cip_68_444/editing.ak`.

### Why the pattern exists
Without this separation, changing the business logic would change the minting policy ID or editing script address. That is operationally expensive for a collection ecosystem. By storing the governor script hashes in the settings datum, Kora can upgrade the observer logic while keeping the stable outer identity intact.

The architectural consequence is that any off-chain builder must include the correct zero-withdrawal witness. Missing it, using the wrong hash, or using a non-zero withdrawal amount all cause validation failure before the business rules are even considered.

## Datum And Redeemer Shapes
The contract data model is defined in `lib/cip_68_444/types.ak`.

### `MintRedeemer`
`MintRedeemer` is either:

- `Mint { asset_proofs: List<AssetProof> }`
- `Burn`

This is a clean separation between positive mint flows and reference-token burn flows. The `Mint` branch carries the MPF proof bundle needed for `444` asset allow-list checks.

### `EditRedeemer`
`EditRedeemer` is either:

- `UpdateReferenceToken { asset: ByteArray }`
- `Invalid`

The explicit `Invalid` constructor is used as a deny-by-default branch. The editing logic returns `False` when it receives that value rather than silently accepting an unexpected shape.

### `MintConfig`
The global config datum holds:

- `fee_address`
- `fee_schedule`

This datum is loaded from the shared `mint_config_444` handle reference input when the transaction mints at least one `444` asset.

### `MintAsset`
Each collection asset definition includes:

- `name`
- `utxo`
- `price`
- `valid_until`
- `discounts`

The required UTxO is specifically used in the `100` reference-token creation path. The base price and discounts drive public mint payment calculation. `valid_until` supports time-boxed sale windows.

### `AssetProof`
An asset proof is a pair of:

- `name`
- `proof`

The proof is checked against the MPF root hash from settings. This architecture keeps the committed allow-list root compact while letting transactions prove membership for only the assets they actually mint.

### `MintSettings`
The per-collection settings datum contains:

- `payment_address`
- `reference_token_address`
- `mint_governor`
- `editing_governor`
- `assets`
- `assets_root_hash`
- `details`

This is the highest-impact datum in the system. It combines operational routing fields, upgrade governance hooks, the full asset metadata list, and the compact root used to authenticate asset-name membership.

## Mint Validation Flow
The Aiken mint flow is implemented in `lib/cip_68_444/minting.ak` and uses helper functions from `common.ak`.

### 1. Load settings and signer status
`common.load_settings` looks in two places:

- a reference input carrying the settings handle token,
- an output carrying the settings handle token.

If the output path is used, the function treats the settings as owner-signed and returns `signed_by_owner = True`. If the reference-input path is used, it inspects the payment credential of the settings-holding address and checks whether the corresponding verification key hash appears in `tx.extra_signatories`.

That dual-source behavior is important. It allows a transaction to use freshly updated settings from its own outputs, while also supporting the normal reference-input path for stable settings UTxOs.

### 2. Resolve minted assets under the current policy
The minting validator reads only the assets minted under its own `policy_id`. It explicitly expects the resulting token map to be non-empty. An empty policy-local mint set is treated as an invalid call site rather than a no-op.

### 3. Load global config only when necessary
If any minted asset name starts with the `444` label prefix, the validator loads the global config from the `mint_config_444` reference input through `common.load_config`.

If there are no `444` assets in the mint set, the code uses a synthetic default config with:

- `fee_address = settings.payment_address`
- `fee_schedule = [[0, 0]]`

This default path prevents `100`-only transactions from requiring the global config handle while still preserving typed fee logic.

### 4. Accumulate costs per minted asset
`accumulate_mint_costs` walks each minted asset name and amount.

For `444` assets it:

- requires an exact asset match in `settings.assets`,
- requires exactly one proof for that asset name,
- rebuilds the MPF root from `settings.assets_root_hash`,
- checks `mpf.has(...)` using the provided proof,
- computes the discounted price from transaction outputs,
- selects the fee tier from the fee schedule,
- enforces the validity-window rules when `valid_until > 0`.

If the owner has not signed, the payment component is charged to the buyer-facing payment output. The fee component is always accumulated.

For `100` assets it:

- requires at most one exact-name settings match,
- requires exactly one suffix-based match against a configured `444` asset,
- requires the configured UTxO to be consumed as an input,
- requires owner signature,
- requires an output that holds the reference token,
- requires that output to use `settings.reference_token_address`,
- requires the minted amount to equal `1`.

For the empty-name royalties path it:

- requires owner signature,
- requires `settings.assets` to be empty.

Any other non-empty asset-name label fails immediately.

### 5. Enforce payment and fee outputs
After all minted assets have been processed, the contract verifies that outputs exist which satisfy the accumulated totals:

- `settings.payment_address` must receive at least `total.payment` lovelace when `total.payment > 0`,
- `config.fee_address` must receive at least `total.fee` lovelace when `total.fee > 0`.

The contract deliberately checks destination and amount only. It does not require an exact-value output, which lets integrators include extra lovelace without breaking the path.

### 6. Burn validation
The `Burn` branch is intentionally simple and strict:

- every minted entry must be a label `100` asset,
- every amount must be negative,
- input holdings plus the burn amount must remain positive for each asset name.

This is the guardrail that prevents total elimination of a reference-token line item through the burn path.

## Discount And Validity Mechanics
The discount logic lives in `common.get_discounted_price`.

Rules are sorted by `discounted_price`, not by quantity threshold. The validator then picks the first rule whose `policy_prefix` and `min_quantity` requirement is satisfied by the transaction outputs. That means the cheapest qualifying rule wins.

`count_matching_tokens` has a small but important defensive behavior: if the `policy_prefix` is too short to contain both a 28-byte policy ID and an asset prefix, the function returns `0`. In other words, malformed discount prefixes do not accidentally match everything.

Time-bound validation uses `tx.validity_range` helpers from `common.ak`. When an asset has a positive `valid_until`:

- the window width must be at most fifteen minutes,
- the window start must occur before `valid_until`.

This is an anti-staleness control. It forces off-chain builders to commit to a narrow mint window instead of relying on very broad transaction validity.

## Editing Validation Flow
The editing surface in `lib/cip_68_444/editing.ak` is intentionally compact.

The validator first loads settings and owner-signature status using the same shared helper as the minting path. For `UpdateReferenceToken`, it then:

- checks that the `minting_policy_id` parameter is exactly 28 bytes long,
- converts it into an Aiken `PolicyId`,
- finds an output containing the requested reference token asset,
- requires that output to use `settings.reference_token_address`,
- requires owner signature.

There is no broader mutable command surface. If the redeemer is `Invalid`, the validator returns `False`.

## Handles And Constants
`lib/cip_68_444/constants.ak` centralizes the constants that tie the contracts to the wider Handles ecosystem:

- the Handles policy ID used to locate settings and config handle tokens,
- label prefixes `444`, `222`, and `100`,
- the helper that derives the settings handle asset name,
- the helper that derives the config handle asset name for `mint_config_444`.

These constants are where the on-chain policy links back to the shared Handles naming conventions. When docs describe "the settings handle" or "the config handle", these helpers are the concrete implementation.

## Deployment-Planning Architecture
The TypeScript planner is a separate but important subsystem.

### Desired-state parsing
`src/deploymentState.ts` parses YAML and validates a strict schema:

- `schema_version` must equal `2`,
- `network` must be one of `preview`, `preprod`, or `mainnet`,
- `contract_slug` must equal `cip-68-444-config`,
- `settings.type` must equal `cip_68_444_config`.

It also rejects observed-only fields such as `current_settings_utxo_ref`, `observed_at`, and `last_deployed_tx_hash`. That keeps committed YAML deterministic and reviewable.

### Live-state loading
`src/deploymentPlan.ts` fetches live state from the Handles API:

- `/handles/mint_config_444`
- `/handles/mint_config_444/utxo`
- `/datum?from=plutus_data_cbor&to=json&numeric_keys=true`

The planner uses `KORA_USER_AGENT` when available and falls back to a repo-specific default user agent string. If the handle or datum is missing, it records that as drift instead of crashing the plan-building flow.

### Diff and artifact generation
`buildDeploymentPlan` recursively compares desired values against live values and emits:

- `summary.json`
- `summary.md`
- `deployment-plan.json`

The current design intentionally emits no transaction artifacts. This repo's deployment automation is a drift-detection and approval-preparation surface, not an autonomous deployer.

### Workflow integration
`.github/workflows/deployment-plan.yml` delegates execution to the reusable workflow in `koralabs/adahandle-deployments`. The local repo owns:

- the desired-state YAML files,
- the local planner command,
- the Node install command,
- the user-agent wiring.

The shared deployment repo owns the reusable execution wrapper.

## Test Strategy
The test layout mirrors the mixed-implementation history of the repo.

### Legacy scenario suite
`tests/tests.ts` compiles the Helios contracts, builds fixture-driven transaction scenarios, and asserts approve or deny outcomes. This suite remains useful because it exercises the original business rules end to end.

### Aiken parity and path tests
`lib/cip_68_444/path_tests.ak` contains explicit tests for authorization, fee, discount, expiry, decoding, and observer-withdrawal paths. `tests/aikenPathParity.test.ts` enforces that the expected named scenarios continue to exist and then runs `aiken check` so the tests are not merely listed but actually executed.

### Deployment planner tests
`tests/deploymentState.test.ts` and `tests/deploymentPlan.test.ts` validate schema parsing, observed-field rejection, datum decoding, and summary generation behavior.

### Coverage guardrail
`test_coverage.sh` and the committed `test_coverage.report` provide a lightweight operational signal for scenario coverage across the tracked contract cases.

## Practical Reading Order
For most engineering tasks, the fastest reading order is:

1. `docs/product/operating-model.md` for the operator intent and boundaries.
2. `docs/spec/spec.md` for the concise contract type inventory.
3. `docs/spec/architecture.md` for the code-level composition.
4. `docs/spec/code-paths.md` for exhaustive assertions and parity references.
5. `src/deploymentPlan.ts` and `lib/cip_68_444/common.ak` for the highest-leverage implementation details.

That sequence moves from product intent to validation wiring to path-level rigor without forcing a reviewer to reverse-engineer the entire repo from raw source first.
