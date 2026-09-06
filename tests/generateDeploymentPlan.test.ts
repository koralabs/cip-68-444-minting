import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parseArgs, runGenerateDeploymentPlan } from '../scripts/generateDeploymentPlan.ts';

const feeAddressHex = '0x30195bde3deacb613b7e9eb6280b14db4e353e475e96d19f3f7a5e2d66195bde3deacb613b7e9eb6280b14db4e353e475e96d19f3f7a5e2d66';
const desiredYaml = `
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
      fee_address: addr_test1xqv4hh3aat9kzwm7n6mzszc5md8r20j8t6tdr8el0f0z6eset00rm6ktvyaha84k9q93fk6wx5lywh5k6x0n77j794nqp4vpze
      fee_schedule:
        - [0, 0]
        - [11000000, 2000000]
        - [35000000, 3000000]
`;

const withTempDir = async <T>(fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cip-68-444-plan-test-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

test('parseArgs collects option values and skips positional tokens', () => {
  assert.deepEqual(
    parseArgs(['preview', '--desired', 'deploy/preview.yaml', '--artifacts-dir', 'out']),
    {
      desired: 'deploy/preview.yaml',
      'artifacts-dir': 'out',
    }
  );
});

test('parseArgs rejects options without values', () => {
  assert.throws(
    () => parseArgs(['--desired', '--artifacts-dir', 'out']),
    /missing value for --desired/
  );
});

test('runGenerateDeploymentPlan writes all deployment artifacts from desired state and live Handles data', async () => {
  await withTempDir(async (dir) => {
    const desiredPath = path.join(dir, 'desired.yaml');
    const artifactsDir = path.join(dir, 'artifacts');
    await fs.writeFile(desiredPath, desiredYaml);

    const calls: Array<{ url: string; userAgent: string | null; method: string }> = [];
    const fetchFn = (async (url: string | URL, init?: RequestInit) => {
      const target = String(url);
      calls.push({
        url: target,
        userAgent: new Headers(init?.headers).get('User-Agent'),
        method: init?.method || 'GET',
      });
      if (target.endsWith('/handles/mint_config_444')) {
        return new Response(JSON.stringify({ utxo: 'live-tx#1' }), { status: 200 });
      }
      if (target.endsWith('/handles/mint_config_444/utxo')) {
        return new Response(JSON.stringify({ datum: 'abcd' }), { status: 200 });
      }
      if (target.includes('/datum?from=plutus_data_cbor')) {
        return new Response(JSON.stringify([
          feeAddressHex,
          [[0, 0], [11000000, 2000000]],
        ]), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as typeof fetch;

    await runGenerateDeploymentPlan({
      argv: ['--desired', desiredPath, '--artifacts-dir', artifactsDir],
      env: { KORA_USER_AGENT: 'codex-plan-test' },
      fetchFn,
    });

    const summaryJson = JSON.parse(await fs.readFile(path.join(artifactsDir, 'summary.json'), 'utf8'));
    const deploymentPlanJson = JSON.parse(await fs.readFile(path.join(artifactsDir, 'deployment-plan.json'), 'utf8'));
    const summaryMarkdown = await fs.readFile(path.join(artifactsDir, 'summary.md'), 'utf8');

    assert.equal(summaryJson.repo, 'cip-68-444-minting');
    assert.equal(summaryJson.network, 'preview');
    assert.equal(summaryJson.contracts[0].current_settings_utxo_ref, 'live-tx#1');
    assert.equal(summaryJson.contracts[0].drift_type, 'settings_only');
    assert.deepEqual(summaryJson.contracts[0].settings.diff_rows, [{
      path: 'mint_config_444.fee_schedule',
      current: [[0, 0], [11000000, 2000000]],
      desired: [[0, 0], [11000000, 2000000], [35000000, 3000000]],
    }]);
    assert.equal(summaryJson.tx_artifact_generated, false);
    assert.deepEqual(summaryJson.artifact_files, ['summary.json', 'summary.md', 'deployment-plan.json']);
    assert.deepEqual(deploymentPlanJson.contracts, [summaryJson.contracts[0].expected_post_deploy_state]);
    assert.equal(deploymentPlanJson.tx_artifact_generated, false);
    assert.match(summaryMarkdown, /Plan ID: `/);
    assert.match(summaryMarkdown, /mint_config_444\.fee_schedule/);
    assert.deepEqual(calls, [{
      url: 'https://preview.api.handle.me/handles/mint_config_444',
      userAgent: 'codex-plan-test',
      method: 'GET',
    }, {
      url: 'https://preview.api.handle.me/handles/mint_config_444/utxo',
      userAgent: 'codex-plan-test',
      method: 'GET',
    }, {
      url: 'https://preview.api.handle.me/datum?from=plutus_data_cbor&to=json&numeric_keys=true',
      userAgent: 'codex-plan-test',
      method: 'POST',
    }]);
  });
});

test('runGenerateDeploymentPlan rejects missing required CLI arguments', async () => {
  await assert.rejects(
    runGenerateDeploymentPlan({ argv: ['--desired', 'only.yaml'] }),
    /usage: --desired <path> --artifacts-dir <dir>/
  );
});
