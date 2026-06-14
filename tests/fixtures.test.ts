import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'fs';
import https from 'https';
import { syncBuiltinESMExports } from 'node:module';
import os from 'os';
import path from 'path';

test('fixtures fallback path works when .env is not present', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cip-68-444-fixtures-'));

  try {
    process.chdir(tempDir);
    const fixtures = await import(`./fixtures.ts?fallback=${Date.now()}_${Math.random()}`);
    assert.ok(fixtures.walletAddress);
    assert.ok(fixtures.paymentAddress);
    assert.ok(fixtures.refTokenAddress);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('fixtures honors KORA_USER_AGENT when provided', async () => {
  const previous = process.env.KORA_USER_AGENT;
  process.env.KORA_USER_AGENT = 'unit-test-user-agent';

  try {
    const fixtures = await import(`./fixtures.ts?useragent=${Date.now()}_${Math.random()}`);
    assert.ok(fixtures.walletAddress);
    assert.ok(fixtures.paymentAddress);
  } finally {
    if (typeof previous === 'undefined') {
      delete process.env.KORA_USER_AGENT;
    } else {
      process.env.KORA_USER_AGENT = previous;
    }
  }
});

test('fixtures loads .env user agent and handles CBOR conversion request errors', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cip-68-444-fixtures-env-'));
  const previous = process.env.KORA_USER_AGENT;
  const originalRequest = https.request;
  let capturedBody = '';

  delete process.env.KORA_USER_AGENT;
  fs.writeFileSync(path.join(tempDir, '.env'), "KORA_USER_AGENT='env-file-agent'\n");

  try {
    process.chdir(tempDir);
    https.request = ((options: any, callback: (res: EventEmitter) => void) => {
      assert.equal(options.hostname, 'api.handle.me');
      assert.equal(options.headers['User-Agent'], 'env-file-agent');

      const req = new EventEmitter() as EventEmitter & { write(chunk: unknown): void; end(): void };
      req.write = (chunk: unknown) => {
        capturedBody += String(chunk);
      };
      req.end = () => {
        const res = new EventEmitter();
        callback(res);
        res.emit('data', 'cbor-data');
        res.emit('end');
      };
      return req;
    }) as typeof https.request;
    syncBuiltinESMExports();

    const fixtures = await import(`./fixtures.ts?envfile=${Date.now()}_${Math.random()}`);
    const common = new fixtures.CommonFixtures();
    const result = await common.convertJsontoCbor([1, 2]);

    assert.equal(result, 'cbor-data');
    assert.equal(capturedBody, JSON.stringify([1, 2]));

    const expectedError = new Error('network down');
    https.request = ((options: any) => {
      assert.equal(options.headers['User-Agent'], 'env-file-agent');

      const req = new EventEmitter() as EventEmitter & { write(chunk: unknown): void; end(): void };
      req.write = () => undefined;
      req.end = () => {
        req.emit('error', expectedError);
      };
      return req;
    }) as typeof https.request;
    syncBuiltinESMExports();

    await assert.rejects(
      () => common.convertJsontoCbor({ fail: true }),
      /network down/
    );
  } finally {
    process.chdir(originalCwd);
    https.request = originalRequest;
    syncBuiltinESMExports();
    if (typeof previous === 'undefined') {
      delete process.env.KORA_USER_AGENT;
    } else {
      process.env.KORA_USER_AGENT = previous;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
