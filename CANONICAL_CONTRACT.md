# cip-68-444-minting canonical contract

## Purpose and authority

I am the on-chain program that mints and edits CIP-68 444 (rich-fungible) assets through a frozen proxy and swappable governors. Protected files are in [`.enclave`](./.enclave). The legacy Helios sources `minting.helios` and `editing.helios` are listed because a change there changes a script hash.

## Invariants that must never be violated

1. The policy id and editing script address are frozen. `validators/minting.ak` and `validators/editing.ak` hold no logic; logic moves only by swapping the `mint_governor` and `editing_governor` hashes in settings through a zero-ada withdrawal with an exact hash match. Not enforced by a test that pins the compiled hashes.
2. Only allow-listed assets mint. Each minted asset carries an MPF proof against `assets_root_hash`; price, discount, required UTxO and validity come from the settings token. Enforced in part by the Aiken tests in `lib/cip_68_444/path_tests.ak` (60 tests) and `tests/aikenPathParity.test.ts`.
3. Payments and fees go to `payment_address` as priced. Same tests as 2; payment amounts are covered only for the paths those tests exercise.
4. Reference tokens stay at `reference_token_address` and only the owner can edit them (`editing_observer.ak`). Covered by path tests; no end-to-end transaction test.

## Boundaries and known limits

Deployment (`src/deploymentPlan.ts`, `deploy/<network>/cip-68-444-settings.yaml`) is ordinary reviewed code. Nothing stops an agent signature outside preview except the multisig.

## Refactors needed to enforce this

- Pin the compiled script hashes in a test.
- Remove the legacy Helios sources once nothing deploys them, instead of enclaving them forever.
- Make the deploy plan refuse non-preview agent signatures (plan row 4.7).
## Authority and limits that apply to everything here

- Higher-risk and operator-approved only: any edit to an on-chain validator or to settings (settings handles, policy roots, `pers*@handle_settings` and handlecontract datums), anything that could double-mint, and any automated burn.
- I may sign for preview only. Preprod and mainnet always need humans on the multisig. Nothing in this repo authorises secret access, signing or spending by an agent.
- The `.enclave` lists only the on-chain source and these two files. It is path-only: a test-only change inside a listed file still asks for approval.
