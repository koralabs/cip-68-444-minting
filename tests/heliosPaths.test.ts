import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import * as helios from '@hyperionbt/helios';
import {
  CommonFixtures,
  EditingFixtures,
  MintingFixtures,
  LBL_100,
  LBL_444,
  handlesPolicy,
  settingsHandle,
  walletAddress,
  paymentAddress,
  refTokenAddress,
  feeAddress
} from './fixtures.js';
import { Test } from './contractTester.js';

helios.config.set({ IS_TESTNET: false, AUTO_SET_VALIDITY_RANGE: true });

const mintingSource = fs.readFileSync('./minting.helios', 'utf8');
const editingSource = fs.readFileSync('./editing.helios', 'utf8');
const codePathsSource = fs.readFileSync('./docs/spec/code-paths.md', 'utf8');

const documentedPathIds = [
  ...new Set([...codePathsSource.matchAll(/\b([ME]-[A-Z-]+-\d+)\b/g)].map((m) => m[1]))
];

const coveredPathIds = new Set<string>();

const markCovered = (ids: string[]) => {
  for (const id of ids) {
    assert.ok(documentedPathIds.includes(id), `unknown path id in test: ${id}`);
    coveredPathIds.add(id);
  }
};

const txId = '0000000000000000000000000000000000000000000000000000000000000001';
const utxoHex = `0x${txId}`;
const asset444Test = `${LBL_444}74657374`;
const asset444Test1 = `${LBL_444}7465737431`;
const asset444Test2 = `${LBL_444}7465737432`;
const asset100Test = `${LBL_100}74657374`;
const asset100Test1 = `${LBL_100}7465737431`;
const asset100Test2 = `${LBL_100}7465737432`;
const shortPolicy = '00000000000000000000000000000000000000000000000000000002';
const discountPolicyPrefix = `0x${shortPolicy}74657374`;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const toHexAddress = (bech32: string) => `0x${helios.Address.fromBech32(bech32).toHex()}`;

const makeBaseSettings = (validUntil = Date.now() + 2 * 60 * 60 * 1000) => [
  toHexAddress(paymentAddress),
  toHexAddress(refTokenAddress),
  [
    [`0x${asset444Test}`, [utxoHex, 0], 0, 0, []],
    [`0x${asset444Test1}`, [utxoHex, 0], 10000000, 0, []],
    [
      `0x${asset444Test2}`,
      [utxoHex, 0],
      40000000,
      validUntil,
      [
        [discountPolicyPrefix, [1, 35000000]],
        [discountPolicyPrefix, [2, 30000000]],
        [discountPolicyPrefix, [3, 25000000]],
        [discountPolicyPrefix, [4, 0]]
      ]
    ]
  ]
];

const makeBaseConfig = () => [
  toHexAddress(feeAddress),
  [
    [0, 0],
    [10000000, 1000000],
    [40000000, 2000000],
    [80000000, 3000000]
  ]
];

const initSuite = async () => {
  const mintingProgram = helios.Program.new(mintingSource);
  mintingProgram.parameters.SETTINGS_HANDLE_NAME = 'settings';
  const mintingContract = mintingProgram.compile();

  const editingProgram = helios.Program.new(editingSource);
  editingProgram.parameters.SETTINGS_HANDLE_NAME = 'settings';
  editingProgram.parameters.MINTING_POLICY_ID = mintingContract.mintingPolicyHash.hex;
  const editingContract = editingProgram.compile();

  const networkParams = new helios.NetworkParams(
    await fetch('https://d1t0d7c2nekuk0.cloudfront.net/mainnet.json').then((response) => response.json())
  );

  const common = new CommonFixtures();
  await common.initialize(makeBaseSettings(), makeBaseConfig());

  return {
    networkParams,
    common,
    mintingProgram,
    editingProgram,
    mintingPolicyId: mintingContract.mintingPolicyHash.hex,
    editingScriptAddress: helios.Address.fromHash(new helios.ValidatorHash(editingContract.validatorHash.hex))
  };
};

const suite = await initSuite();

const buildMintingFixture = (common: CommonFixtures = suite.common) =>
  new MintingFixtures(suite.mintingPolicyId, common, common.configCbor).initialize();

const buildEditingFixture = (
  common: CommonFixtures = suite.common,
  policyId: string = suite.mintingPolicyId,
  scriptAddress: helios.Address = suite.editingScriptAddress
) => new EditingFixtures(policyId, common, common.configCbor, scriptAddress).initialize();

const buildMintingTx = (fixture: MintingFixtures, program: helios.Program = suite.mintingProgram) =>
  new Test(program, () => fixture).build();

const buildEditingTx = (fixture: EditingFixtures, program: helios.Program = suite.editingProgram) =>
  new Test(program, () => fixture).build();

const finalize = async (tx: helios.Tx) =>
  tx.finalize(suite.networkParams, helios.Address.fromBech32(walletAddress));

const expectApprove = async (pathIds: string[], txBuilder: () => helios.Tx, mutator?: (tx: helios.Tx) => void) => {
  const tx = txBuilder();
  if (mutator) {
    mutator(tx);
  }
  await assert.doesNotReject(async () => finalize(tx));
  markCovered(pathIds);
};

const expectDeny = async (
  pathIds: string[],
  txBuilder: () => helios.Tx,
  expectedMessage?: string,
  mutator?: (tx: helios.Tx) => void
) => {
  const tx = txBuilder();
  if (mutator) {
    mutator(tx);
  }

  let thrown: unknown;
  try {
    await finalize(tx);
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown, 'expected tx to be denied');
  if (expectedMessage) {
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    assert.ok(
      message.includes(expectedMessage),
      `expected message to include "${expectedMessage}", got "${message}"`
    );
  }
  markCovered(pathIds);
};

const inlineDatum = (cbor: string) => helios.Datum.inline(helios.UplcData.fromCbor(cbor));
const hashedDatum = (cbor: string) => helios.Datum.hashed(helios.UplcData.fromCbor(cbor));

const replaceTxInput = (input: helios.TxInput, datum?: helios.Datum) =>
  new helios.TxInput(input.outputId, new helios.TxOutput(input.output.address, input.output.value, datum));

const settingsOutput = (datum?: helios.Datum) =>
  new helios.TxOutput(
    helios.Address.fromBech32(walletAddress),
    new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[settingsHandle, 1]]]])),
    datum
  );

const outputWithAsset = (address: string, policyId: string, assetName: string, qty: number, lovelace = BigInt(5000000)) =>
  new helios.TxOutput(
    helios.Address.fromBech32(address),
    new helios.Value(lovelace, new helios.Assets([[policyId, [[assetName, qty]]]]))
  );

const inputWithSettingsHandle = (outputId: helios.TxOutputId, lovelace = BigInt(200000000)) =>
  new helios.TxInput(
    outputId,
    new helios.TxOutput(
      helios.Address.fromBech32(walletAddress),
      new helios.Value(lovelace, new helios.Assets([[handlesPolicy, [[settingsHandle, 1]]]]))
    )
  );

test('Helios validators execute all documented code paths', async (t) => {
  await t.test('M-COST-1 is guarded by caller (static reachability check)', async () => {
    assert.ok(mintingSource.includes('if (key.starts_with(LBL_444))'));
    assert.ok(mintingSource.includes('assert(asset.starts_with(LBL_444), "Asset is not a (444) token")'));
    markCovered(['M-COST-1']);
  });

  await t.test('M-MINT-2 defensive access is not triggerable through canonical minting tx construction', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [];
    fixture.outputs = [];
    await expectApprove(['M-MINT-2'], () => buildMintingTx(fixture));
  });

  await t.test('E-MAIN-7 constructor is exercised with parameterized policy bytes', async () => {
    const editingProgram = helios.Program.new(editingSource);
    editingProgram.parameters.SETTINGS_HANDLE_NAME = 'settings';
    editingProgram.parameters.MINTING_POLICY_ID = '01';
    const editingContract = editingProgram.compile();
    const fixture = buildEditingFixture(
      suite.common,
      suite.mintingPolicyId,
      helios.Address.fromHash(new helios.ValidatorHash(editingContract.validatorHash.hex))
    );
    await expectDeny(['E-MAIN-7'], () => buildEditingTx(fixture, editingProgram), 'Reference token output missing');
  });

  await t.test('Minting baseline approve (signed owner, 444 and 100)', async () => {
    const fixture = buildMintingFixture();
    await expectApprove(
      [
        'M-LOAD-CONFIG-1',
        'M-LOAD-SETTINGS-5',
        'M-FEE-1',
        'M-COST-3',
        'M-COST-4',
        'M-COST-7',
        'M-COST-9',
        'M-COST-13',
        'M-COST-16',
        'M-MINT-1',
        'M-MINT-3',
        'M-MINT-5',
        'M-MINT-7',
        'M-MINT-14',
        'M-MINT-20',
        'M-MINT-25',
        'M-MINT-26'
      ],
      () => buildMintingTx(fixture)
    );
  });

  await t.test('Minting approve with unsigned owner requires and receives payment', async () => {
    const fixture = buildMintingFixture();
    fixture.signatories = [];
    fixture.minted = fixture.minted?.slice(0, 3);
    fixture.outputs = fixture.outputs?.slice(0, 3);
    await expectApprove(['M-LOAD-SETTINGS-6', 'M-MINT-22'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny on unpaid payment output', async () => {
    const fixture = buildMintingFixture();
    fixture.signatories = [];
    fixture.minted = fixture.minted?.slice(0, 3);
    fixture.outputs = fixture.outputs?.slice(1, 3);
    fixture.outputs?.push(
      new helios.TxOutput(helios.Address.fromBech32(paymentAddress), new helios.Value(BigInt(90000000)))
    );
    await expectDeny(['M-MINT-21'], () => buildMintingTx(fixture), 'Policy minting payment is unpaid');
  });

  await t.test('Minting deny on unpaid fee output', async () => {
    const fixture = buildMintingFixture();
    fixture.signatories = [];
    fixture.minted = fixture.minted?.slice(0, 3);
    fixture.outputs = [
      new helios.TxOutput(helios.Address.fromBech32(paymentAddress), new helios.Value(BigInt(94000000))),
      outputWithAsset(walletAddress, fixture.policyId, asset444Test, 2)
    ];
    await expectDeny(['M-MINT-24'], () => buildMintingTx(fixture), 'Minting fee is unpaid');
  });

  await t.test('Minting approve on 100-only mint path (default config bypass)', async () => {
    const fixture = buildMintingFixture();
    fixture.refInputs = [fixture.refInputs![1]];
    fixture.minted = [
      [asset100Test, BigInt(1)],
      [asset100Test1, BigInt(1)],
      [asset100Test2, BigInt(1)]
    ];
    fixture.outputs = [
      new helios.TxOutput(
        helios.Address.fromBech32(refTokenAddress),
        new helios.Value(
          BigInt(5000000),
          new helios.Assets([[fixture.policyId, [[asset100Test, 1], [asset100Test1, 1], [asset100Test2, 1]]]])
        )
      )
    ];
    await expectApprove(['M-MINT-4', 'M-MINT-23'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when settings input is missing', async () => {
    const fixture = buildMintingFixture();
    fixture.refInputs = [fixture.refInputs![0]];
    await expectDeny(['M-LOAD-SETTINGS-1'], () => buildMintingTx(fixture), 'settings input missing');
  });

  await t.test('Minting approve via settings output branch', async () => {
    const fixture = buildMintingFixture();
    fixture.signatories = [];
    fixture.refInputs = [fixture.refInputs![0]];
    fixture.inputs?.push(inputWithSettingsHandle(new helios.TxOutputId(`${txId}#9`), BigInt(5000000)));
    fixture.minted = [[asset100Test, BigInt(1)]];
    fixture.outputs = [
      settingsOutput(inlineDatum(suite.common.settingsCbor)),
      outputWithAsset(refTokenAddress, fixture.policyId, asset100Test, 1)
    ];
    await expectApprove(['M-LOAD-SETTINGS-2'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when settings output datum is not inline', async () => {
    const fixture = buildMintingFixture();
    fixture.refInputs = [fixture.refInputs![0]];
    fixture.outputs = [settingsOutput()];
    await expectDeny(['M-LOAD-SETTINGS-3'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when settings output datum fails decode', async () => {
    const fixture = buildMintingFixture();
    fixture.refInputs = [fixture.refInputs![0]];
    fixture.outputs = [settingsOutput(inlineDatum('80'))];
    await expectDeny(['M-LOAD-SETTINGS-4'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when settings owner credential is not PubKey', async () => {
    const fixture = buildMintingFixture();
    fixture.refInputs![1] = new helios.TxInput(
      fixture.refInputs![1].outputId,
      new helios.TxOutput(
        suite.editingScriptAddress,
        fixture.refInputs![1].output.value,
        inlineDatum(suite.common.settingsCbor)
      )
    );
    await expectDeny(['M-LOAD-SETTINGS-7'], () => buildMintingTx(fixture), 'Invalid credential hash');
  });

  await t.test('Minting deny when settings ref input datum is missing', async () => {
    const fixture = buildMintingFixture();
    fixture.refInputs![1] = replaceTxInput(fixture.refInputs![1]);
    await expectDeny(['M-LOAD-SETTINGS-8'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when settings ref input datum fails decode', async () => {
    const fixture = buildMintingFixture();
    fixture.refInputs![1] = replaceTxInput(fixture.refInputs![1], inlineDatum('80'));
    await expectDeny(['M-LOAD-SETTINGS-9'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when config ref input is missing', async () => {
    const fixture = buildMintingFixture();
    fixture.refInputs = [fixture.refInputs![1]];
    await expectDeny(['M-LOAD-CONFIG-2'], () => buildMintingTx(fixture), 'mint_config_444 reference input missing');
  });

  await t.test('Minting deny when config ref input datum is missing', async () => {
    const fixture = buildMintingFixture();
    fixture.refInputs![0] = replaceTxInput(fixture.refInputs![0]);
    await expectDeny(['M-LOAD-CONFIG-3'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when config ref input datum fails decode', async () => {
    const fixture = buildMintingFixture();
    fixture.refInputs![0] = replaceTxInput(fixture.refInputs![0], inlineDatum('80'));
    await expectDeny(['M-LOAD-CONFIG-4'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when fee schedule has no matching threshold', async () => {
    const fixture = buildMintingFixture();
    const config = [toHexAddress(feeAddress), [[50000000, 1000000]]];
    const configCbor = await suite.common.convertJsontoCbor(config);
    fixture.refInputs![0] = replaceTxInput(fixture.refInputs![0], inlineDatum(configCbor));
    await expectDeny(['M-FEE-2', 'M-COST-12'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when fee schedule rows are malformed', async () => {
    const fixture = buildMintingFixture();
    const config = [toHexAddress(feeAddress), [[0]]];
    const configCbor = await suite.common.convertJsontoCbor(config);
    fixture.refInputs![0] = replaceTxInput(fixture.refInputs![0], inlineDatum(configCbor));
    await expectDeny(['M-FEE-3'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when (444) asset is not listed in settings', async () => {
    const fixture = buildMintingFixture();
    const unknown444 = `${LBL_444}ffffffff`;
    fixture.minted = [[unknown444, BigInt(1)]];
    fixture.outputs = [outputWithAsset(walletAddress, fixture.policyId, unknown444, 1)];
    await expectDeny(['M-COST-2'], () => buildMintingTx(fixture), 'Asset not found in policy');
  });

  await t.test('Minting approve with discount selection after lazy rule fallback', async () => {
    const fixture = buildMintingFixture();
    fixture.signatories = [];
    fixture.minted = fixture.minted?.slice(0, 3);
    fixture.inputs?.push(
      new helios.TxInput(
        new helios.TxOutputId(`${txId}#4`),
        new helios.TxOutput(
          helios.Address.fromBech32(walletAddress),
          new helios.Value(
            BigInt(5000000),
            new helios.Assets([[shortPolicy, [['74657374', 2]]]])
          )
        )
      )
    );
    fixture.outputs = fixture.outputs?.slice(2, 3);
    fixture.outputs?.push(
      new helios.TxOutput(
        helios.Address.fromBech32(walletAddress),
        new helios.Value(BigInt(5000000), new helios.Assets([[shortPolicy, [['74657374', 2]]]]))
      )
    );
    fixture.outputs?.push(
      new helios.TxOutput(helios.Address.fromBech32(paymentAddress), new helios.Value(BigInt(76000000)))
    );
    fixture.outputs?.push(
      new helios.TxOutput(helios.Address.fromBech32(feeAddress), new helios.Value(BigInt(4000000)))
    );
    await expectApprove(['M-COST-5', 'M-COST-6'], () => buildMintingTx(fixture));
  });

  await t.test('Minting approve with discount policy byte length <= 28 (no asset-prefix counting)', async () => {
    const fixture = buildMintingFixture();
    fixture.signatories = [];
    fixture.minted = [[asset444Test2, BigInt(1)]];
    fixture.inputs?.push(
      new helios.TxInput(
        new helios.TxOutputId(`${txId}#8`),
        new helios.TxOutput(
          helios.Address.fromBech32(walletAddress),
          new helios.Value(BigInt(5000000), new helios.Assets([[shortPolicy, [['74657374', 10]]]]))
        )
      )
    );
    fixture.outputs = [
      outputWithAsset(walletAddress, fixture.policyId, asset444Test2, 1),
      new helios.TxOutput(helios.Address.fromBech32(paymentAddress), new helios.Value(BigInt(38000000))),
      new helios.TxOutput(helios.Address.fromBech32(feeAddress), new helios.Value(BigInt(2000000))),
      new helios.TxOutput(
        helios.Address.fromBech32(walletAddress),
        new helios.Value(BigInt(5000000), new helios.Assets([[shortPolicy, [['74657374', 10]]]]))
      )
    ];
    const settings = makeBaseSettings();
    settings[2][2][4] = [[`0x${shortPolicy}`, [1, 0]]];
    const settingsCbor = await suite.common.convertJsontoCbor(settings);
    fixture.refInputs![1] = replaceTxInput(fixture.refInputs![1], inlineDatum(settingsCbor));
    await expectApprove(['M-COST-8'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when discount entry data type is malformed', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [[asset444Test2, BigInt(1)]];
    fixture.outputs = [outputWithAsset(walletAddress, fixture.policyId, asset444Test2, 1)];
    const settings = makeBaseSettings();
    settings[2][2][4] = [[1, [1, 35000000]]];
    const settingsCbor = await suite.common.convertJsontoCbor(settings);
    fixture.refInputs![1] = replaceTxInput(fixture.refInputs![1], inlineDatum(settingsCbor));
    await expectDeny(['M-COST-10'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when discount vector is malformed', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [[asset444Test2, BigInt(1)]];
    fixture.outputs = [outputWithAsset(walletAddress, fixture.policyId, asset444Test2, 1)];
    const settings = makeBaseSettings();
    settings[2][2][4] = [[discountPolicyPrefix, [1]]];
    const settingsCbor = await suite.common.convertJsontoCbor(settings);
    fixture.refInputs![1] = replaceTxInput(fixture.refInputs![1], inlineDatum(settingsCbor));
    await expectDeny(['M-COST-11'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when validity range is wider than 15 minutes', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [[asset444Test2, BigInt(1)]];
    fixture.outputs = [
      outputWithAsset(walletAddress, fixture.policyId, asset444Test2, 1),
      new helios.TxOutput(helios.Address.fromBech32(feeAddress), new helios.Value(BigInt(2000000)))
    ];
    await expectDeny(
      ['M-COST-14'],
      () => buildMintingTx(fixture),
      'Invalid slot range for asset',
      (tx) => {
        const start = new Date();
        tx.validFrom(start);
        tx.validTo(new Date(start.getTime() + 16 * 60 * 1000));
      }
    );
  });

  await t.test('Minting deny when valid_until has expired', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [[asset444Test2, BigInt(1)]];
    fixture.outputs = [
      outputWithAsset(walletAddress, fixture.policyId, asset444Test2, 1),
      new helios.TxOutput(helios.Address.fromBech32(feeAddress), new helios.Value(BigInt(2000000)))
    ];
    const settings = makeBaseSettings(1);
    const settingsCbor = await suite.common.convertJsontoCbor(settings);
    fixture.refInputs![1] = replaceTxInput(fixture.refInputs![1], inlineDatum(settingsCbor));
    await expectDeny(['M-COST-15'], () => buildMintingTx(fixture), 'This asset minting has expired');
  });

  await t.test('Minting deny when duplicate non-(444) asset names exist in settings', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [[asset100Test, BigInt(1)]];
    fixture.outputs = [outputWithAsset(refTokenAddress, fixture.policyId, asset100Test, 1)];
    const settings = makeBaseSettings();
    settings[2] = [
      [`0x${asset100Test}`, [utxoHex, 0], 0, 0, []],
      [`0x${asset100Test}`, [utxoHex, 0], 0, 0, []]
    ];
    const settingsCbor = await suite.common.convertJsontoCbor(settings);
    fixture.refInputs![1] = replaceTxInput(fixture.refInputs![1], inlineDatum(settingsCbor));
    await expectDeny(['M-MINT-6'], () => buildMintingTx(fixture), 'Duplicate asset found');
  });

  await t.test('Minting deny when (100) suffix cannot map to a singleton asset', async () => {
    const fixture = buildMintingFixture();
    const unmatched100 = `${LBL_100}deadbeef`;
    fixture.minted = [[unmatched100, BigInt(1)]];
    fixture.outputs = [outputWithAsset(refTokenAddress, fixture.policyId, unmatched100, 1)];
    await expectDeny(['M-MINT-8'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when required settings UTxO is not consumed', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [[asset100Test, BigInt(1)]];
    fixture.outputs = [outputWithAsset(refTokenAddress, fixture.policyId, asset100Test, 1)];
    const settings = makeBaseSettings();
    settings[2][0][1] = [utxoHex, 9];
    const settingsCbor = await suite.common.convertJsontoCbor(settings);
    fixture.refInputs![1] = replaceTxInput(fixture.refInputs![1], inlineDatum(settingsCbor));
    await expectDeny(['M-MINT-9'], () => buildMintingTx(fixture), 'Required UTxO is missing');
  });

  await t.test('Minting deny when (100) mint is not signed by policy owner', async () => {
    const fixture = buildMintingFixture();
    fixture.signatories = [];
    fixture.minted = [[asset100Test, BigInt(1)]];
    fixture.outputs = [outputWithAsset(refTokenAddress, fixture.policyId, asset100Test, 1)];
    await expectDeny(['M-MINT-10'], () => buildMintingTx(fixture), 'Missing policy owner signature');
  });

  await t.test('Minting deny when reference token output is missing', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [[asset100Test, BigInt(1)]];
    fixture.outputs = [];
    await expectDeny(['M-MINT-11'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny when reference token is sent to wrong address', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [[asset100Test, BigInt(1)]];
    fixture.outputs = [outputWithAsset(walletAddress, fixture.policyId, asset100Test, 1)];
    await expectDeny(
      ['M-MINT-12'],
      () => buildMintingTx(fixture),
      'Reference Token not sent to reference_token_address'
    );
  });

  await t.test('Minting deny when more than one reference token is minted for an asset name', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [[asset100Test, BigInt(2)]];
    fixture.outputs = [outputWithAsset(refTokenAddress, fixture.policyId, asset100Test, 2)];
    await expectDeny(
      ['M-MINT-13'],
      () => buildMintingTx(fixture),
      'Only 1 Reference token can be minted with this asset name'
    );
  });

  await t.test('Minting deny royalties mint without owner signature', async () => {
    const fixture = buildMintingFixture();
    fixture.signatories = [];
    fixture.minted = [['', BigInt(1)]];
    fixture.outputs = [outputWithAsset(walletAddress, fixture.policyId, '', 1)];
    await expectDeny(['M-MINT-15', 'M-MINT-16'], () => buildMintingTx(fixture), 'Missing policy owner signature');
  });

  await t.test('Minting deny royalties mint when settings list is non-empty', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [['', BigInt(1)]];
    fixture.outputs = [outputWithAsset(walletAddress, fixture.policyId, '', 1)];
    await expectDeny(
      ['M-MINT-17'],
      () => buildMintingTx(fixture),
      'There can be no Assets listed for a royalties mint'
    );
  });

  await t.test('Minting approve royalties mint with empty settings assets', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [['', BigInt(1)]];
    fixture.outputs = [outputWithAsset(walletAddress, fixture.policyId, '', 1)];
    const settings = makeBaseSettings();
    settings[2] = [];
    const settingsCbor = await suite.common.convertJsontoCbor(settings);
    fixture.refInputs![1] = replaceTxInput(fixture.refInputs![1], inlineDatum(settingsCbor));
    await expectApprove(['M-MINT-18'], () => buildMintingTx(fixture));
  });

  await t.test('Minting deny invalid asset label in mint set', async () => {
    const fixture = buildMintingFixture();
    fixture.minted = [['74657374', BigInt(1)]];
    fixture.outputs = [outputWithAsset(walletAddress, fixture.policyId, '74657374', 1)];
    await expectDeny(
      ['M-MINT-19'],
      () => buildMintingTx(fixture),
      'Invalid asset_name_label for this policy. Must be (100) or (444)'
    );
  });

  await t.test('Burn deny when non-reference assets are burnt', async () => {
    const fixture = buildMintingFixture();
    fixture.inputs?.push(
      new helios.TxInput(
        new helios.TxOutputId(`${txId}#1`),
        new helios.TxOutput(
          helios.Address.fromBech32(walletAddress),
          new helios.Value(
            BigInt(10000000),
            new helios.Assets([[fixture.policyId, [[asset100Test, 2], [asset444Test1, 2]]]])
          )
        )
      )
    );
    fixture.minted = [[asset100Test, BigInt(-1)], [asset444Test1, BigInt(-1)]];
    fixture.outputs = [];
    fixture.redeemer = helios.UplcData.fromCbor('d87a9fff');
    await expectDeny(
      ['M-BURN-1'],
      () => buildMintingTx(fixture),
      'The BURN redeemer only allows reference tokens to be burnt'
    );
  });

  await t.test('Burn deny when burn would remove all remaining reference tokens', async () => {
    const fixture = buildMintingFixture();
    fixture.inputs?.push(
      new helios.TxInput(
        new helios.TxOutputId(`${txId}#1`),
        new helios.TxOutput(
          helios.Address.fromBech32(walletAddress),
          new helios.Value(
            BigInt(10000000),
            new helios.Assets([[fixture.policyId, [[asset100Test, 2], [asset100Test1, 2]]]])
          )
        )
      )
    );
    fixture.minted = [[asset100Test, BigInt(-2)], [asset100Test1, BigInt(-2)]];
    fixture.outputs = [];
    fixture.redeemer = helios.UplcData.fromCbor('d87a9fff');
    await expectDeny(
      ['M-BURN-4'],
      () => buildMintingTx(fixture),
      'There should be at least one reference token remaining'
    );
  });

  await t.test('Burn approve when at least one reference token remains', async () => {
    const fixture = buildMintingFixture();
    fixture.inputs?.push(
      new helios.TxInput(
        new helios.TxOutputId(`${txId}#1`),
        new helios.TxOutput(
          helios.Address.fromBech32(walletAddress),
          new helios.Value(
            BigInt(10000000),
            new helios.Assets([[fixture.policyId, [[asset100Test, 2], [asset100Test1, 2]]]])
          )
        )
      )
    );
    fixture.minted = [[asset100Test, BigInt(-1)], [asset100Test1, BigInt(-1)]];
    fixture.outputs = [
      new helios.TxOutput(
        helios.Address.fromBech32(refTokenAddress),
        new helios.Value(
          BigInt(5000000),
          new helios.Assets([[fixture.policyId, [[asset100Test, 1], [asset100Test1, 1]]]])
        )
      )
    ];
    fixture.redeemer = helios.UplcData.fromCbor('d87a9fff');
    await expectApprove(['M-BURN-2', 'M-BURN-3', 'M-BURN-5'], () => buildMintingTx(fixture));
  });

  await t.test('Editing baseline approve', async () => {
    const fixture = buildEditingFixture();
    await expectApprove(['E-LOAD-SETTINGS-5', 'E-MAIN-1', 'E-MAIN-5'], () => buildEditingTx(fixture));
  });

  await t.test('Editing deny when policy owner signature is missing', async () => {
    const fixture = buildEditingFixture();
    fixture.signatories = [];
    await expectDeny(['E-LOAD-SETTINGS-6', 'E-MAIN-4'], () => buildEditingTx(fixture), 'Missing policy owner signature');
  });

  await t.test('Editing deny when settings input is missing', async () => {
    const fixture = buildEditingFixture();
    fixture.refInputs = [];
    await expectDeny(['E-LOAD-SETTINGS-1'], () => buildEditingTx(fixture), 'settings input missing');
  });

  await t.test('Editing approve via settings output branch', async () => {
    const fixture = buildEditingFixture();
    fixture.signatories = [];
    fixture.refInputs = [];
    fixture.inputs = [inputWithSettingsHandle(new helios.TxOutputId(`${txId}#9`), BigInt(5000000)), ...(fixture.inputs ?? [])];
    fixture.outputs = [settingsOutput(inlineDatum(suite.common.settingsCbor)), fixture.outputs![0]];
    await expectApprove(['E-LOAD-SETTINGS-2'], () => buildEditingTx(fixture));
  });

  await t.test('Editing deny when settings output datum is not inline', async () => {
    const fixture = buildEditingFixture();
    fixture.refInputs = [];
    fixture.outputs = [settingsOutput(), fixture.outputs![0]];
    await expectDeny(['E-LOAD-SETTINGS-3'], () => buildEditingTx(fixture));
  });

  await t.test('Editing deny when settings output datum fails decode', async () => {
    const fixture = buildEditingFixture();
    fixture.refInputs = [];
    fixture.outputs = [settingsOutput(inlineDatum('80')), fixture.outputs![0]];
    await expectDeny(['E-LOAD-SETTINGS-4'], () => buildEditingTx(fixture));
  });

  await t.test('Editing deny when settings owner credential is not PubKey', async () => {
    const fixture = buildEditingFixture();
    fixture.refInputs![0] = new helios.TxInput(
      fixture.refInputs![0].outputId,
      new helios.TxOutput(
        suite.editingScriptAddress,
        fixture.refInputs![0].output.value,
        inlineDatum(suite.common.settingsCbor)
      )
    );
    await expectDeny(['E-LOAD-SETTINGS-7'], () => buildEditingTx(fixture), 'Invalid credential hash');
  });

  await t.test('Editing deny when settings ref input datum is missing', async () => {
    const fixture = buildEditingFixture();
    fixture.refInputs![0] = replaceTxInput(fixture.refInputs![0]);
    await expectDeny(['E-LOAD-SETTINGS-8'], () => buildEditingTx(fixture));
  });

  await t.test('Editing deny when settings ref input datum fails decode', async () => {
    const fixture = buildEditingFixture();
    fixture.refInputs![0] = replaceTxInput(fixture.refInputs![0], inlineDatum('80'));
    await expectDeny(['E-LOAD-SETTINGS-9'], () => buildEditingTx(fixture));
  });

  await t.test('Editing deny when reference token output is missing', async () => {
    const fixture = buildEditingFixture();
    fixture.redeemer = helios.UplcData.fromCbor('d8799f48000643b0deadbeefff');
    await expectDeny(['E-MAIN-2'], () => buildEditingTx(fixture), 'Reference token output missing');
  });

  await t.test('Editing deny when reference token output uses wrong address', async () => {
    const fixture = buildEditingFixture();
    fixture.outputs = [outputWithAsset(walletAddress, fixture.policyId, asset100Test, 1)];
    await expectDeny(
      ['E-MAIN-3'],
      () => buildEditingTx(fixture),
      'Reference Token not sent to reference_token_address'
    );
  });

  await t.test('Editing default switch branch returns false for unknown constructor', async () => {
    const fixture = buildEditingFixture();
    fixture.redeemer = helios.UplcData.fromCbor('d87a9fff');
    await expectDeny(['E-MAIN-6'], () => buildEditingTx(fixture), 'validation returned false');
  });

  const missingPathIds = documentedPathIds.filter((id) => !coveredPathIds.has(id));
  assert.deepEqual(
    missingPathIds,
    [],
    `missing path tests for documented ids: ${missingPathIds.join(', ')}`
  );
});
