# cip-68-444-minting canonical contract

**Status: proposal (ecosystem-ownership-plan row 5.2). Operator review pending.**

These contracts mint CIP-68 444 tokens and guard edits to their reference tokens. Protected production source is listed in [`.enclave`](./.enclave);
other enforcement references below are not automatically enclave paths.

## Review scope and unchanged authority

Decision 2 clarification (2026-10-13): the human-review enclave is actual Aiken/Helios
on-chain source, listed as exact files in [`.enclave`](./.enclave), plus this contract
and the manifest's self-protection. Test-only sources, npm/package files, JS/TS,
builders, configuration, generated artifacts and workflows follow ordinary automated
tests and independent agent review; their location in a contract repository alone
never requires human approval. Existing unrelated holds remain in force.

Separately identifiable embedded Aiken `test` blocks and test-only helpers are testing
code, not protected on-chain behavior. Test-only edits to those blocks follow ordinary
agent review. Mixed files remain listed for their production definitions: the current
path-only merge gate cannot distinguish such hunks and may still request approval.
This is an enforcement limitation, not expanded human-review policy; no source was
split or changed in this documentation-only proposal.

This narrows code-review scope only. Actual on-chain validator or settings changes
(settings handles, policy roots, `pers*@handle_settings` and handlecontract datums),
anything that could double-mint, and automated burns or other irreversible on-chain
actions retain explicit operator authorization. Routine builder/package/test repairs
are not such actions merely because of their repository or filename. K.O.R.A. may
sign for preview only within existing authorization; preprod and mainnet always need
humans on the multisig. No signing, secret access or spending is authorized here.
Independent review pending; this proposal is not accepted and must not be merged.

## Source requirements

- Ecosystem `AGENTS.md` (koralabs root), "Critical Correctness": handle addresses correct 100% of
  the time, never double-mint, properties chain-accurate. "Merging": any edit to an on-chain
  contract/validator or to contract settings (settings handles, policy roots, `pers*@handle_settings`
  datums, handlecontract datums), anything that could double-mint, and any automated burn is
  higher-risk and needs operator approval before merge.
- kora-bot `v3/docs/ecosystem-ownership-plan.md` §6 decision 2: for contract repos the enclave holds
  Aiken/Helios on-chain source, excluding testing and npm/package code; K.O.R.A. may sign for preview only,
  preprod and mainnet always need humans on the multisig. Phase 5 row 5.2.
- kora-bot `v3/docs/tool-surface.md` (`merge_pr`): cards enclave paths merged into
  `master`/`main`/`mainnet`/`preprod`, reading a root `.enclave`.
- This repo: [`docs/spec/spec.md`](./docs/spec/spec.md) (observer pattern, MPF allow-list, mint
  and editing flows), [`docs/spec/contract-deployment-pipeline.md`](./docs/spec/contract-deployment-pipeline.md).

## Must never be violated

1. **The policy id and the editing script address are frozen.** `validators/minting.ak` and
   `validators/editing.ak` hold no logic and never change; logic moves only by swapping the
   `mint_governor` / `editing_governor` hashes in settings (zero-ada withdrawal, exact hash).
2. **Only allow-listed assets mint.** Every minted asset carries an MPF proof against
   `assets_root_hash`; price, discount, required UTxO and validity come from the settings token.
3. **Payments and fees are paid as priced** to `payment_address` and the fee schedule.
4. **Reference tokens stay at `reference_token_address`**, and only the owner can edit them.
5. **Signing:** K.O.R.A. may sign preview settings/deploy txs only; preprod and mainnet always
   need humans on the multisig.

## Where it is enforced today

| # | Code |
|---|---|
| 1 | `validators/minting.ak`, `validators/editing.ak`, `lib/cip_68_444/minting_proxy.ak`, `editing_proxy.ak` |
| 2, 3 | `validators/minting_observer.ak`, `lib/cip_68_444/minting.ak` |
| 4 | `validators/editing_observer.ak`, `lib/cip_68_444/editing.ak` |
| 5 | `deploy/<network>/cip-68-444-settings.yaml`, `src/deploymentPlan.ts` |

## Refactor needed for enforcement

- **The legacy Helios sources** (`minting.helios`, `editing.helios`) are kept for parity only;
  once nothing deploys them they should be removed rather than enclaved forever.
- **Rule 5 is prose only** (same gap as decentralized-minting; plan row 4.7).
