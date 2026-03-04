# Contract Spec

## Contract Files
- `minting.helios`: minting policy for CIP-68 `444` assets and `100` reference tokens.
- `editing.helios`: spending script for controlled reference-token update transactions.
- Detailed path-by-path inventory: `docs/spec/code-paths.md`.

## Data Model (Helios Structs)
- Minting policy structs:
  - `MintConfig`: fee address and fee schedule.
  - `MintSettings`: payment/reference destinations and allowed assets.
  - `MintAsset`: per-asset pricing, validity, and discount rules.
- Shared constants:
  - `LBL_444` (`001bc280`), `LBL_100` (`000643b0`), `LBL_222` (`000de140`).
  - Handle policy hash and settings/config asset-class derivations.

## Minting Policy Behavior (`minting.helios`)
- `MINT` redeemer:
  - Loads settings datum from settings reference input/output.
  - Loads config datum when mint includes `444` assets.
  - Validates each minted asset label and allow-list membership.
  - Computes per-asset mint cost (discount rules + fee schedule).
  - Requires lovelace outputs for payment and fee totals.
  - Enforces additional signature/UTxO constraints for `100` reference token minting.
- `BURN` redeemer:
  - Allows only negative mints of `100` label assets.
  - Ensures at least one reference token remains after burn.

## Editing Script Behavior (`editing.helios`)
- `UPDATE_REFERENCE_TOKEN`:
  - Resolves settings datum.
  - Requires output containing the target reference token.
  - Requires output address to match settings `reference_token_address`.
  - Requires owner signature path from settings handle.

## Test and Validation Tooling
- `tests/tests.ts` compiles contracts and executes approve/deny scenarios.
- `tests/contractTester.ts` builds/finalizes tx simulations and reports assertions.
- `tests/fixtures.ts` builds reusable UTxO/config/settings fixture data.

## Coverage Guardrail
- `test_coverage.sh` executes focused Node tests with built-in coverage.
- `test_coverage.report` stores latest line/branch summary used by unattended task tracking.
