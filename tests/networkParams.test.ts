import test from 'node:test';
import assert from 'node:assert/strict';
import * as helios from '@hyperionbt/helios';

import { loadNetworkParams } from './networkParams.js';

test('loadNetworkParams returns fetched network params when the CDN request succeeds', async () => {
  const calls: string[] = [];
  const params = await loadNetworkParams({
    url: 'https://example.test/mainnet.json',
    fetchFn: (async (url: string | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify(helios.rawNetworkEmulatorParams), { status: 200 });
    }) as typeof fetch,
  });

  assert.deepEqual(calls, ['https://example.test/mainnet.json']);
  assert.ok(params instanceof helios.NetworkParams);
  assert.equal(params.raw.latestParams.txFeeFixed, helios.rawNetworkEmulatorParams.latestParams.txFeeFixed);
});

test('loadNetworkParams falls back to bundled params when the CDN request fails', async () => {
  const rejectingParams = await loadNetworkParams({
    fetchFn: (async () => {
      throw new Error('offline');
    }) as typeof fetch,
  });
  const errorStatusParams = await loadNetworkParams({
    fetchFn: (async () => new Response(JSON.stringify({}), { status: 503 })) as typeof fetch,
  });

  assert.equal(rejectingParams.raw.latestParams.txFeeFixed, helios.rawNetworkEmulatorParams.latestParams.txFeeFixed);
  assert.equal(errorStatusParams.raw.latestParams.txFeeFixed, helios.rawNetworkEmulatorParams.latestParams.txFeeFixed);
});
