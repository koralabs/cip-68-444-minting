# Contract Deployment Pipeline Spec

## Repository Scope
This repo is not a static network-wide deployed-contract target in the same way as the other contract repos.

Each new collection contract is built per user/handle, with that handle injected into the contract at build time. Because of that, this repo does not map to one canonical deployed contract hash on `preview`, `preprod`, or `mainnet`.

For deployment automation, the stable monitored state here is limited to the global `mint_config_444` handle. Owner-scoped collection settings and per-owner `SETTINGS_HANDLE_NAME` contracts are outside this repo-level deployment-monitoring scope.

## State Model
- Desired state lives in committed YAML files in this repo.
- Observed live state is read from the global `mint_config_444` handle UTxO on-chain.
- Operational automation config lives outside this repo in orchestration/control-plane repos.
- Volatile fields such as `tx_hash`, `output_index`, and current UTxO refs belong in observed-state artifacts, not committed desired-state YAML.

## Desired State Files
The committed layout is:

```text
deploy/preview/cip-68-444-settings.yaml
deploy/preprod/cip-68-444-settings.yaml
deploy/mainnet/cip-68-444-settings.yaml
```

Each file contains stable desired state only:

```yaml
schema_version: 2
network: preview
contract_slug: cip-68-444-config
assigned_handles:
  settings:
    - mint_config_444
  scripts: []
ignored_settings: []
settings:
  type: cip_68_444_config
  values:
    mint_config_444:
      fee_address: <bech32>
      fee_schedule:
        - [0, 0]
```

Required stable fields:
- `schema_version`
- `network`
- `contract_slug`
- `assigned_handles.settings`
- `assigned_handles.scripts`
- `ignored_settings`
- `settings.type`
- `settings.values.mint_config_444`

Observed-only fields that must not be committed into desired-state YAML:
- `current_settings_utxo_ref`
- `observed_at`
- `last_deployed_tx_hash`

The initial bootstrap job may populate these files from current chain state, but it must strip live-only references before commit.

## Drift Detection
Deployment automation should:
- load desired YAML from this repo,
- read live chain state for the global `mint_config_444` handle UTxO,
- decode the inline CBOR datum into the comparable YAML shape,
- classify drift as `settings_only` for this repo.

No deployment artifact should be created when desired and live state already match.

## Contract Hash Scope
- There is no single repo-wide deployed contract hash to monitor for this repo.
- The per-user collection contracts built from this repo are outside the scope of this deployment-monitoring pipeline.
- Contract-hash comparison should not be required for the repo-level automation artifacts.

## Artifact Contract
The deployment workflow for this repo currently emits:
- `deployment-plan.json`
- `summary.md`
- `summary.json`

It does not emit `tx-XX.cbor` artifacts yet. The current rollout scope is settings drift detection plus approval-ready summary generation for `mint_config_444`.

## Human Approval Boundary
Automation prepares deployment transactions and summaries.

Humans remain responsible for:
- downloading CBOR artifacts,
- uploading/signing/submitting in Eternl,
- approving the deployment at the wallet boundary.

Post-submit automation should verify that chain state converges to the desired YAML for the global `mint_config_444` handle.
