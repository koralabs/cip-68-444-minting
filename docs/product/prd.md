# CIP-68 (444) Minting PRD

## Summary
This project provides on-chain policy logic for minting and controlled burning of CIP-68 label `444` assets plus required label `100` reference tokens.

## Problem
Project teams need deterministic policy rules for:
- Which `444` assets can be minted.
- How payments/fees are enforced.
- How reference tokens (`100`) are minted and burned safely.
- How settings/config datums govern policy behavior.

## Users
- Policy owners and operators maintaining allowed assets/pricing rules.
- Integrator services submitting mint/burn transactions.
- Auditors validating minting constraints and payment rules.

## Goals
- Enforce asset allow-list and per-asset pricing from settings datum.
- Enforce fee schedule from config datum.
- Enforce required UTxO consumption when minting reference tokens.
- Restrict burn path to valid reference-token-only burns.
- Provide companion editing script for reference-token updates by owner signature.

## Non-Goals
- Not a web/API service.
- Not a generalized marketplace contract.
- Not a wallet UI implementation.

## Product Requirements
- `minting.helios` supports `MINT` and `BURN` redeemers.
- `editing.helios` supports `UPDATE_REFERENCE_TOKEN` spending validation.
- Minting flow must enforce:
  - asset label validation (`444` and `100` rules),
  - required payments and fees,
  - owner-signature requirements for privileged operations.
- Burn flow must enforce:
  - only `100` label tokens,
  - resulting positive remaining supply per burned asset.

## Success Criteria
- Test harness validates approve/deny contract scenarios for minting/editing paths.
- Repo-level coverage harness (`test_coverage.sh`) remains green for tracked test targets.
