import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
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
