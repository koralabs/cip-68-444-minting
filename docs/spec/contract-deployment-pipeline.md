# Contract Deployment Pipeline Spec

## Repository Scope
This repo is not a static network-wide deployed-contract target in the same way as the other contract repos.

Each new collection contract is built per user/handle, with that handle injected into the contract at build time. Because of that, this repo does not map to one canonical deployed contract hash on `preview`, `preprod`, or `mainnet`.

For deployment automation, the stable monitored state here is limited to the K.O.R.A.-owned settings UTxO that governs the launch flow. This repo should not be treated as the storage location for volatile live references such as current settings UTxO refs.

## State Model
- Desired state lives in committed YAML files in this repo.
- Observed live state is read from the K.O.R.A.-owned settings UTxO on-chain.
- Operational automation config lives outside this repo in orchestration/control-plane repos.
- Volatile fields such as `tx_hash`, `output_index`, and current UTxO refs belong in observed-state artifacts, not committed desired-state YAML.

## Desired State Files
The intended layout is:

```text
deploy/<network>/<contract_slug>.yaml
```

Each file should contain stable desired state only:

```yaml
schema_version: 1
network: preview
contract_slug: cip-68-444-settings
settings:
  type: cip_68_444_settings
  values:
    # K.O.R.A.-owned launch settings only
```

Required stable fields:
- `schema_version`
- `network`
- `contract_slug`
- `settings.type`
- `settings.values`

Observed-only fields that must not be committed into desired-state YAML:
- `current_settings_utxo_ref`
- `observed_at`
- `last_deployed_tx_hash`

The initial bootstrap job may populate these files from current chain state, but it must strip live-only references before commit.

## Drift Detection
Deployment automation should:
- load desired YAML from this repo,
- read live chain state for the K.O.R.A.-owned settings UTxO,
- classify drift as `settings_only` for this repo.

No deployment artifact should be created when desired and live state already match.

## Contract Hash Scope
- There is no single repo-wide deployed contract hash to monitor for this repo.
- The per-user collection contracts built from this repo are outside the scope of this deployment-monitoring pipeline.
- Contract-hash comparison should not be required for the repo-level automation artifacts.

## Artifact Contract
The deployment workflow for this repo should emit:
- `deployment-plan.json`
- `summary.md`
- `summary.json`
- one or more `tx-XX.cbor` artifacts
- optional observed-state snapshot artifacts for debugging and audit

The canonical observed-state artifact should be JSON and should include:

```json
{
  "schema_version": 1,
  "repo": "cip-68-444-minting",
  "network": "preview",
  "contract_slug": "cip-68-444-settings",
  "current_settings_utxo_ref": "<tx>#<ix>",
  "settings": {
    "type": "cip_68_444_settings",
    "values": {}
  },
  "observed_at": "<iso8601>"
}
```

If more than one transaction is required, the plan artifact must encode execution order and dependencies.

## Human Approval Boundary
Automation prepares deployment transactions and summaries.

Humans remain responsible for:
- downloading CBOR artifacts,
- uploading/signing/submitting in Eternl,
- approving the deployment at the wallet boundary.

Post-submit automation should verify that chain state converges to the desired YAML for the K.O.R.A.-owned settings UTxO.
