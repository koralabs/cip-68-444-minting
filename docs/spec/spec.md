# Contract Spec

## Contract Files
- `validators/minting.ak`: stable minting-policy proxy (policy ID stays stable).
- `validators/minting_observer.ak`: withdrawal validator that holds minting logic.
- `validators/editing.ak`: stable spending proxy for reference-token script address.
- `validators/editing_observer.ak`: withdrawal validator that holds editing logic.
- `lib/cip_68_444/*.ak`: shared logic, types, constants, proxy checks, and path tests.
- Legacy Helios sources remain for parity/reference:
  - `minting.helios`
  - `editing.helios`

## Data Model (Aiken)
- `MintConfig`: fee destination and fee schedule.
- `MintAsset`: per-asset metadata (`name`, required `utxo`, base price, validity, discount rules).
- `MintSettings`:
  - `payment_address`
  - `reference_token_address`
  - `mint_governor` (withdrawal script hash for mint observer)
  - `editing_governor` (withdrawal script hash for editing observer)
  - `assets` (full `MintAsset` metadata list)
  - `assets_root_hash`
  - `details`
- `AssetProof`: MPF proof bundle for one `MintAsset`.

## Observer Pattern (`withdraw 0` trick)
- The stable proxy scripts do not contain business logic.
- They require a withdrawal from the configured observer script hash in settings.
- Requirement is explicit `withdrawal amount == 0` and script hash match.
- By updating governor hashes in settings, logic can move to new observer scripts without changing:
  - minting policy ID (`validators/minting.ak`), or
  - editing script address (`validators/editing.ak`).

## MPF Storage Model
- Asset allow-list entries are stored in Merkle-Patricia-Forestry (`aiken-lang/merkle-patricia-forestry`) keyed by asset name.
- Mint transactions provide per-asset proofs (`AssetProof`) in the observer redeemer.
- MPF proves key membership only (`asset name` exists in allow-list root).
- Per-asset pricing/discount/UTxO metadata is read from `settings.assets` in the settings reference token.

## Mint Flow
- Minting policy proxy (`validators/minting.ak`):
  - Loads settings.
  - Requires `withdraw 0` from `mint_governor`.
- Mint observer (`validators/minting_observer.ak`):
  - Runs full mint/burn logic (`lib/cip_68_444/minting.ak`).
  - Enforces 444/100/royalty paths, pricing/discount/fees, UTxO/signature checks, payment/fee outputs, and burn invariants.

## Editing Flow
- Editing spend proxy (`validators/editing.ak`):
  - Loads settings.
  - Requires `withdraw 0` from `editing_governor`.
- Editing observer (`validators/editing_observer.ak`):
  - Runs full reference-token update logic (`lib/cip_68_444/editing.ak`).
  - Enforces token output existence, destination, and owner-signature constraints.

## Tests and Coverage
- Aiken path tests: `lib/cip_68_444/path_tests.ak`.
- Parity guard test: `tests/aikenPathParity.test.ts`.
  - Asserts all required parity scenarios are present.
  - Executes `aiken check` to ensure tests actually run and pass.
- Path tests include explicit observer/proxy scenarios for missing, wrong, and non-zero withdrawals.

## Path Documentation
- Baseline Helios path inventory: `docs/spec/code-paths.md`.
- Aiken tests preserve behavioral parity and add observer-proxy authorization paths.
