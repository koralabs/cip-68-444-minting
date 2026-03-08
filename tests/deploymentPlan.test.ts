import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDeploymentPlan, fetchLiveSettingsState } from '../src/deploymentPlan.ts';
import type { DesiredDeploymentState } from '../src/deploymentState.ts';

const desiredState: DesiredDeploymentState = {
  schemaVersion: 1,
  network: 'preview',
  contractSlug: 'cip-68-444-settings',
  settings: {
    type: 'cip_68_444_settings',
    values: {
      paymentAddress: 'addr_test1vzzra4003l0hlg97grcpd7t29xcw3uggt3ytmzadnlu9zvq9ezrv9',
      referenceTokenAddress: 'addr_test1vrhkwnpad0g9406cj4z356fkz9z5zf3n3jja97h7js4kz3gc3ffhz',
      assets: [
        {
          assetNameHex: '0x001bc28074657374',
          requiredUtxo: {
            txIdHex: '0x0000000000000000000000000000000000000000000000000000000000000001',
            index: 0,
          },
          priceLovelace: 0,
          validFrom: 0,
          discounts: [],
        },
      ],
    },
  },
};

test('treats missing live datum as manual drift instead of failing', async () => {
  const live = await fetchLiveSettingsState({
    network: 'preview',
    userAgent: 'codex-test',
    fetchFn: (async (url: string | URL) => {
      const target = String(url);
      if (target.includes('/handles/settings/utxo')) {
        return new Response(JSON.stringify({ datum: null }), { status: 200 });
      }
      if (target.includes('/handles/settings/datum')) {
        return new Response(null, { status: 404 });
      }
      return new Response(JSON.stringify({ utxo: 'tx#0' }), { status: 200 });
    }) as typeof fetch,
  });

  assert.deepEqual(live, {
    currentSettingsUtxoRef: 'tx#0',
    hasDatum: false,
    values: null,
  });
});

test('decodes datum JSON when the Handles API exposes it', async () => {
  const live = await fetchLiveSettingsState({
    network: 'preview',
    userAgent: 'codex-test',
    fetchFn: (async (url: string | URL, init?: RequestInit) => {
      const target = String(url);
      if (target.includes('/handles/settings/utxo')) {
        return new Response(JSON.stringify({ datum: 'present' }), { status: 200 });
      }
      if (target.includes('/handles/settings/datum')) {
        return new Response('deadbeef', { status: 200 });
      }
      if (target.includes('/datum?from=plutus_data_cbor&to=json&numeric_keys=true')) {
        assert.equal(init?.method, 'POST');
        return new Response(JSON.stringify([
          'pay',
          'ref',
          [['asset', ['tx', 1], 2, 3, [['discount', [1, 4]]]]],
        ]), { status: 200 });
      }
      return new Response(JSON.stringify({ utxo: 'tx#1' }), { status: 200 });
    }) as typeof fetch,
  });

  assert.deepEqual(live.values, {
    paymentAddress: 'pay',
    referenceTokenAddress: 'ref',
    assets: [{
      assetNameHex: 'asset',
      requiredUtxo: { txIdHex: 'tx', index: 1 },
      priceLovelace: 2,
      validFrom: 3,
      discounts: [{ assetNameHex: 'discount', amount: 4 }],
    }],
  });
});

test('builds settings-only summary entries', () => {
  const plan = buildDeploymentPlan({
    desired: desiredState,
    live: {
      currentSettingsUtxoRef: 'tx#0',
      hasDatum: false,
      values: null,
    },
  });

  assert.equal(plan.summaryJson.contracts[0].contract_slug, 'cip-68-444-settings');
  assert.equal(plan.summaryJson.contracts[0].drift_type, 'settings_only');
  assert.match(plan.summaryMarkdown, /missing_live_datum/);
});
