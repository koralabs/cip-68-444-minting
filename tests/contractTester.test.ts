import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractTester, Test } from './contractTester.js';
import { walletAddress } from './fixtures.js';

const makeTx = (shouldFail = false, message = 'boom') => ({
  witnesses: { redeemers: [{ memCost: BigInt(2), cpuCost: BigInt(3) }] },
  body: {
    toCborHex() {
      return 'abcd';
    }
  },
  async finalize() {
    if (shouldFail) {
      throw new Error(message);
    }
  }
});

test('Test constructor and build path apply fixtures and tx actions', () => {
  const calls: Array<{ method: string; payload?: unknown }> = [];
  const tx = {
    addInput(input: unknown, redeemer: unknown) {
      calls.push({ method: 'addInput', payload: [input, redeemer] });
    },
    addRefInput(input: unknown) {
      calls.push({ method: 'addRefInput', payload: input });
    },
    attachScript(script: unknown) {
      calls.push({ method: 'attachScript', payload: script });
    },
    mintTokens(policy: unknown, minted: unknown, redeemer: unknown) {
      calls.push({ method: 'mintTokens', payload: [policy, minted, redeemer] });
    },
    addOutput(output: unknown) {
      calls.push({ method: 'addOutput', payload: output });
    },
    addSigner(signer: unknown) {
      calls.push({ method: 'addSigner', payload: signer });
    }
  };

  const script = {
    compile(optimized: boolean) {
      return { optimized, mintingPolicyHash: 'policy' };
    }
  };

  const subject = new Test(
    script as any,
    () =>
      ({
        inputs: ['in1', 'in2'],
        refInputs: ['ref1'],
        outputs: ['out1'],
        signatories: ['signer1'],
        minted: [['asset', BigInt(1)]],
        redeemer: 'redeemer'
      }) as any,
    () => tx as any,
    true
  );

  subject.build();

  assert.ok(calls.find((call) => call.method === 'addInput'));
  assert.ok(calls.find((call) => call.method === 'addRefInput'));
  assert.ok(calls.find((call) => call.method === 'attachScript'));
  assert.ok(calls.find((call) => call.method === 'mintTokens'));
  assert.ok(calls.find((call) => call.method === 'addOutput'));
  assert.ok(calls.find((call) => call.method === 'addSigner'));
});

test('ContractTester test() supports filters and approve/deny outcomes', async () => {
  const tester = new ContractTester(walletAddress);
  tester.networkParams = {} as any;

  await tester.test('groupA', 'nameA', { build: () => makeTx(false) } as any, true);
  assert.equal(tester.successCount, 1);
  assert.equal(tester.failCount, 0);

  tester.groupName = 'different-group';
  await tester.test('groupA', 'nameA', { build: () => makeTx(false) } as any, true);
  assert.equal(tester.testCount, 1);

  tester.groupName = undefined;
  tester.testName = 'different-name';
  await tester.test('groupA', 'nameA', { build: () => makeTx(false) } as any, true);
  assert.equal(tester.testCount, 1);

  tester.testName = undefined;
  await tester.test('groupA', 'nameB', { build: () => makeTx(true, 'expected') } as any, false, 'expected');
  assert.equal(tester.successCount, 2);

  await tester.test('groupA', 'nameC', { build: () => makeTx(true, 'unexpected') } as any, true);
  assert.equal(tester.failCount, 1);
});

test('ContractTester utility methods and init/group naming paths execute', async () => {
  const tester = new ContractTester(walletAddress);

  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => ({
    async json() {
      return {};
    }
  });

  try {
    await tester.init('Minting Group', 'Case 1');
  } finally {
    (globalThis as any).fetch = originalFetch;
  }

  assert.equal(tester.cleanTestName(), 'MintingGroupCase1');

  const originalConsoleLog = console.log;
  console.log = () => undefined;
  try {
    const tx = makeTx(false) as any;
    tester.logTest(tx, false, 'GRP', 'name', undefined, new Error('INFO one\nINFO two'));
    tester.displayStats();
  } finally {
    console.log = originalConsoleLog;
  }

  const totals = tester.getTotals();
  assert.equal(typeof totals.testCount, 'number');
  assert.equal(typeof totals.successCount, 'number');
  assert.equal(typeof totals.failCount, 'number');
});
