# CIP-68 (444) Minting Operating Model

## Purpose
This repository exists to define and validate the on-chain rules for minting CIP-68 label `444` assets and their companion label `100` reference tokens. It is not a wallet, storefront, API, or marketplace application. Its product role is narrower and more important than that: it is the source of truth for whether a minting or editing transaction is allowed to succeed on-chain.

In practical terms, the repo serves two different operating surfaces:

1. The contract surface used by collection operators and integrator services when they build minting, editing, or burn transactions.
2. The repo-level deployment-planning surface used by Kora operators to compare the desired global fee configuration against the live `mint_config_444` handle datum on `preview`, `preprod`, and `mainnet`.

That split matters when reading the rest of the docs. Most collection behavior is controlled per owner through settings data and transaction construction. The repository-wide deployment automation covers only the shared fee configuration handle and not each owner's individual collection rollout.

## Who Uses This Repo
### Policy owners and collection operators
These users decide which assets may be minted, what each asset costs, whether an asset has discount rules, which reference token address should receive label `100` tokens, and which specific UTxO must be consumed when a reference token is created. They are also responsible for signing privileged paths such as reference-token creation, royalties minting, and reference-token editing.

### Integrator services
These are off-chain services, scripts, or minting engines that build transactions against the policy. They must assemble the right reference inputs, proofs, outputs, and signatures. The contract does not repair malformed transactions. If the integrator misses a required witness or underpays an output, the transaction is expected to fail.

### Auditors and reviewers
Auditors use this repository to answer a simple question: "What exact rules determine whether a collection mint is valid?" They care about invariant coverage, failure modes, parameter shapes, and deployment boundaries.

### Deployment operators
These users do not deploy a single universal contract instance from this repo. Instead, they maintain the committed desired state for the shared `mint_config_444` handle and use the workflow automation to detect drift before a manual wallet-signing step.

## Core Product Concepts
### Label `444` assets
A label `444` asset is the primary collection token minted by this policy. A `444` token participates in pricing, optional discount checks, optional validity windows, and fee calculation. Public mint paths can require a payment output plus a fee output when the settings owner has not signed the transaction.

### Label `100` reference tokens
A label `100` asset is the reference token companion for a `444` asset. The policy treats it as privileged inventory. Creating one requires a matching asset definition in settings, consumption of the required UTxO, owner authorization, and delivery to the configured reference-token address. Burning is also tightly controlled: only `100` tokens may be burned through the `BURN` redeemer path, and at least one reference token must remain for each asset name after the burn.

### Settings handle
Each collection is governed by a settings datum identified by a parameterized settings handle name. That datum carries the collection payment address, reference-token address, governor script hashes, asset metadata list, MPF root hash, and optional extra details. The settings datum is the authoritative collection policy configuration for day-to-day minting behavior.

### Global config handle
The shared `mint_config_444` handle stores the fee destination and fee schedule. This is the only network-wide deployment state tracked by the repo's desired-state YAML files. If a transaction mints any `444` assets, the minting logic loads this config from a reference input and uses it to compute the fee owed for the transaction.

### Observer governors
The active Aiken design separates stable proxy scripts from upgradeable observer logic. Operators do not interact with the observers directly as end-user features, but they must understand them operationally. Minting and editing are only approved when the transaction includes a zero-withdrawal witness from the governor script hashes named in settings. That pattern keeps the stable policy and spending entrypoints fixed while allowing logic upgrades behind the scenes.

## End-To-End Minting Lifecycle
### 1. Collection setup
Before anyone can mint, the policy owner must publish or update the settings datum for the collection. That datum must include:

- the payment address that receives public mint proceeds,
- the address that must receive reference tokens,
- the mint and editing governor hashes,
- the list of allowed `444` asset definitions,
- the MPF root hash that commits to the allowed asset names,
- optional extra details for off-chain use.

For each allowed asset, the owner also defines the required UTxO for reference-token creation, the base price, the validity deadline, and any discount rules.

### 2. Public or owner-assisted mint transaction
An integrator builds a mint transaction for one or more assets under the current policy ID. If any minted asset has the `444` label, the transaction must also reference the global `mint_config_444` handle so the fee schedule can be loaded. The integrator includes an asset proof for each minted `444` asset, and the contract checks that the proof matches the MPF root stored in settings.

If the settings owner does not sign the transaction, the mint path accumulates payment and fee obligations. The final transaction must contain:

- enough lovelace at `settings.payment_address` to satisfy the collection payment portion, and
- enough lovelace at `config.fee_address` to satisfy the fee portion.

If the owner does sign, the contract still enforces the fee output but may waive the collection payment portion for `444` mints.

### 3. Reference-token creation
When a `100` token is minted, the integrator has to satisfy stricter rules than for a normal `444` mint:

- the asset name suffix must match exactly one configured `444` asset,
- the transaction must consume the configured required UTxO,
- the owner must sign,
- exactly one reference token must be minted for that asset name,
- an output must hold that token at the configured reference-token address.

This protects the reference-token supply from accidental duplication and prevents integrators from sending reference tokens to arbitrary destinations.

### 4. Editing reference-token state
The editing surface is intentionally narrow. It exists to approve controlled reference-token update transactions, not arbitrary mutable collection operations. The contract expects an `UpdateReferenceToken` redeemer, a matching output that still carries the relevant reference token, the correct destination address, and owner authorization. If any of those checks fail, the edit is denied.

### 5. Controlled burns
The `BURN` redeemer path is limited to negative-mint entries for `100` tokens only. This is not a general burn-anything mode. The policy sums the matching reference-token quantity across inputs and rejects the transaction if the requested burn would leave zero remaining tokens for that asset name.

## Pricing And Discount Expectations
The price model is deterministic and datum-driven. Each asset has a base price. Discount rules are attached to the asset and sorted by discounted price. A rule qualifies when outputs in the transaction contain enough tokens that match the configured policy-and-asset prefix. The contract then chooses the best qualifying rule, computes the fee tier from the global fee schedule, and splits the total into payment and fee components.

From an operations perspective, that means:

- the settings datum must describe discount inputs correctly,
- the transaction outputs must reflect the inventory that a discount rule expects,
- the fee schedule must be ordered sensibly because the contract chooses the highest threshold that the payment meets.

If those inputs are wrong, the mint either becomes unexpectedly expensive or fails outright.

## Time-Bound Assets
Assets can optionally enforce a `valid_until` cutoff. When this field is positive, the mint transaction must use a bounded validity range whose width is no more than fifteen minutes, and the transaction start time must occur before the asset deadline.

Operationally, this is designed to stop replay-like behavior around expiring sale windows. Integrators cannot leave the validity window open-ended. They must construct a deliberately narrow range, otherwise the contract rejects the mint even if every payment and proof is correct.

## What This Repo Does Not Promise
This repository does not promise a single repo-wide deployed contract hash for every environment. Each collection contract is built per owner or per handle context. The repo-level automation only tracks the shared `mint_config_444` settings handle because that is the stable, globally meaningful configuration surface.

It also does not provide off-chain recovery logic. There are no hidden retries, alternate acceptance paths, or automatic corrections. The intended behavior for malformed transactions is immediate on-chain failure so that incorrect state never lands.

## Operational Failure Modes To Expect
The most common failure categories are predictable:

- missing settings or config reference inputs,
- malformed inline datums,
- missing or mismatched MPF proofs,
- insufficient payment output,
- insufficient fee output,
- expired or invalid validity windows,
- missing owner signatures for privileged paths,
- missing required UTxO for reference-token creation,
- wrong destination for reference-token outputs,
- invalid observer withdrawal witness.

These are not edge cases to paper over. They are core product controls, and off-chain builders should treat them as normal validation outcomes during integration.

## Release And Verification Expectations
For documentation and operator readiness, the most useful verification commands in this repo are:

- `npm test` for the Helios scenario suite plus the TypeScript and Aiken parity tests,
- `./test_coverage.sh` for the coverage guardrail,
- `npx tsx scripts/generateDeploymentPlan.ts --desired <path> --artifacts-dir <dir>` for deployment-plan artifact generation.

The docs in `docs/spec/` should be read alongside this file:

- `spec.md` for the datum and validator model,
- `code-paths.md` for exhaustive legacy-path inventory and parity expectations,
- `contract-deployment-pipeline.md` for desired-state drift detection,
- `architecture.md` for how the repo is physically organized and how validation data moves through it.

## Product Readiness Summary
The repository is "ready" when operators can answer four questions without reading source code line by line:

1. Which data controls mint eligibility and fee behavior?
2. Which transaction witnesses are mandatory for each path?
3. Which failures are supposed to happen instead of being worked around?
4. Which network configuration is repo-level and which configuration is collection-specific?

This operating model is intended to make those answers explicit. The contract logic remains strict by design; the readiness work here is about making that strictness legible before changes are proposed or transactions are assembled.
