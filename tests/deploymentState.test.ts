import test from 'node:test';
import assert from 'node:assert/strict';

import { loadDesiredDeploymentState, parseDesiredDeploymentState } from '../src/deploymentState.ts';

const validDesiredYaml = `
schema_version: 2
network: PREVIEW
contract_slug: cip-68-444-config
assigned_handles:
  settings: [mint_config_444]
  scripts: []
ignored_settings: []
settings:
  type: cip_68_444_config
  values:
    mint_config_444:
      fee_address: " addr_test1abc "
      fee_schedule:
        - [0, 0]
        - [11000000, 2000000]
`;

test('loads desired-state YAML fixtures for all networks', async () => {
  const preview = await loadDesiredDeploymentState('deploy/preview/cip-68-444-settings.yaml');
  const preprod = await loadDesiredDeploymentState('deploy/preprod/cip-68-444-settings.yaml');
  const mainnet = await loadDesiredDeploymentState('deploy/mainnet/cip-68-444-settings.yaml');

  assert.equal(preview.network, 'preview');
  assert.equal(preprod.network, 'preprod');
  assert.equal(mainnet.network, 'mainnet');
  assert.deepEqual(preview.assignedHandles.settings, ['mint_config_444']);
  assert.equal(preview.settings.values.mint_config_444.fee_schedule.length, 3);
});

test('normalizes network and string fields from desired-state YAML', () => {
  const parsed = parseDesiredDeploymentState(validDesiredYaml, 'inline desired state');

  assert.equal(parsed.network, 'preview');
  assert.equal(parsed.settings.values.mint_config_444.fee_address, 'addr_test1abc');
  assert.deepEqual(parsed.settings.values.mint_config_444.fee_schedule, [
    [0, 0],
    [11000000, 2000000],
  ]);
});

test('rejects invalid YAML before field validation', () => {
  assert.throws(
    () => parseDesiredDeploymentState('schema_version: [', 'broken desired state'),
    /broken desired state is not valid YAML:/
  );
});

test('rejects YAML documents that are not objects', () => {
  assert.throws(
    () => parseDesiredDeploymentState('- just\n- a\n- list', 'list desired state'),
    /list desired state must be a YAML object/
  );
});

test('rejects observed-only fields in desired-state YAML', () => {
  assert.throws(
    () => parseDesiredDeploymentState(`
schema_version: 2
network: preview
contract_slug: cip-68-444-config
current_settings_utxo_ref: deadbeef#0
assigned_handles:
  settings: [mint_config_444]
  scripts: []
ignored_settings: []
settings:
  type: cip_68_444_config
  values:
    mint_config_444:
      fee_address: addr_test1abc
      fee_schedule:
        - [0, 0]
`),
    /must not include observed-only field `current_settings_utxo_ref`/
  );
});

test('rejects unsupported networks', () => {
  assert.throws(
    () => parseDesiredDeploymentState(validDesiredYaml.replace('PREVIEW', 'sanchonet'), 'inline desired state'),
    /inline desired state network must be one of preview, preprod, mainnet/
  );
});

test('rejects unsupported contract slugs', () => {
  assert.throws(
    () => parseDesiredDeploymentState(
      validDesiredYaml.replace('cip-68-444-config', 'cip-68-444-minting'),
      'inline desired state'
    ),
    /inline desired state contract_slug must be cip-68-444-config/
  );
});

test('rejects non-string assigned handles', () => {
  assert.throws(
    () => parseDesiredDeploymentState(
      validDesiredYaml.replace('settings: [mint_config_444]', 'settings: [mint_config_444, 7]'),
      'inline desired state'
    ),
    /inline desired state\.assigned_handles must include string array field `settings`/
  );
});

test('rejects non-numeric fee schedule rows', () => {
  assert.throws(
    () => parseDesiredDeploymentState(
      validDesiredYaml.replace('- [11000000, 2000000]', '- [11000000, bad]'),
      'inline desired state'
    ),
    /inline desired state\.settings\.values\.mint_config_444\.fee_schedule\[1\] must be an array of numbers/
  );
});
