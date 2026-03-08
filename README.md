# cip-68-444-minting

Smart contracts for minting and controlled burning of CIP-68 label `444` assets and label `100` reference tokens.

## Documentation
- `docs/index.md`
- `docs/product/index.md`
- `docs/spec/index.md`

## Tests
- Contract scenario suite: `npm test`
- Coverage guardrail: `./test_coverage.sh`
- Last coverage output: `./test_coverage.report`


## Contract Deployment Automation

This repo now carries committed settings-only desired-state YAML for `preview`, `preprod`, and `mainnet` under `deploy/`. The `Deployment Plan` workflow runs the repo-local planner against those files and uploads `summary.json`, `summary.md`, and `deployment-plan.json` artifacts.
