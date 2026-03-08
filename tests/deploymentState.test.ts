import test from 'node:test';
import assert from 'node:assert/strict';

import { loadDesiredDeploymentState, parseDesiredDeploymentState } from '../src/deploymentState.ts';

test('loads desired-state YAML fixtures for all networks', async () => {
  const preview = await loadDesiredDeploymentState('deploy/preview/cip-68-444-settings.yaml');
  const preprod = await loadDesiredDeploymentState('deploy/preprod/cip-68-444-settings.yaml');
  const mainnet = await loadDesiredDeploymentState('deploy/mainnet/cip-68-444-settings.yaml');

  assert.equal(preview.network, 'preview');
  assert.equal(preprod.network, 'preprod');
  assert.equal(mainnet.network, 'mainnet');
  assert.equal(preview.settings.values.assets.length, 3);
});

test('rejects observed-only fields in desired-state YAML', () => {
  assert.throws(
    () => parseDesiredDeploymentState(`
schema_version: 1
network: preview
contract_slug: cip-68-444-settings
current_settings_utxo_ref: deadbeef#0
settings:
  type: cip_68_444_settings
  values:
    payment_address: addr_test1abc
    reference_token_address: addr_test1def
    assets: []
`),
    /must not include observed-only field `current_settings_utxo_ref`/
  );
});
