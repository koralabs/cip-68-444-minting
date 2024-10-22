import * as helios from '@koralabs/helios'
import { convertJsontoCbor, Fixture, getAddressAtDerivation, getNewFakeUtxoId, handlesPolicy } from '@koralabs/kora-labs-contract-testing';
import { AssetNameLabel } from '@koralabs/kora-labs-common';
helios.config.set({ IS_TESTNET: false, AUTO_SET_VALIDITY_RANGE: true });

export const configHandle = `${AssetNameLabel.LBL_222}${Buffer.from('mint_config_444').toString('hex')}`;
export const settingsHandle = `${AssetNameLabel.LBL_002}${Buffer.from('settings').toString('hex')}`;
export const rootHandle = `${AssetNameLabel.LBL_222}${Buffer.from('settings').toString('hex')}`;


export const testSeedPhrase = ['hurdle', 'exile', 'essence', 'fitness', 'winter', 'unaware', 'coil', 'polar', 'vocal', 'like', 'tuition', 'story', 'consider', 'weasel', 'shove', 'donkey', 'effort', 'nice', 'any', 'buffalo', 'trip', 'amount', 'hundred', 'duty'];

export const walletAddress = (await getAddressAtDerivation(0)).toBech32();
export const paymentAddress =  (await getAddressAtDerivation(1)).toBech32();
export const refTokenAddress =  (await getAddressAtDerivation(2)).toBech32();
export const feeAddress =  (await getAddressAtDerivation(3)).toBech32();

export class CommonFixtures extends Fixture {
    settings:any[] = [];
    config:any[] = [];
    settingsCbor = '';
    configCbor = '';
    walletAddress = '';
    paymentAddress = '';
    feeAddress = '';
    refTokenAddress = '';

    constructor(validatorHash: helios.ValidatorHash) {
        super(validatorHash);
    }

    async initialize(settings?: any[], config?: any[]) {
        this.walletAddress = walletAddress;
        this.paymentAddress = paymentAddress;
        this.refTokenAddress = refTokenAddress;
        this.feeAddress = feeAddress;
        if (settings) {
            this.settings = settings;
        }
        else {
            this.settings = [
                `0x${helios.Address.fromBech32(this.paymentAddress).toHex()}`,
                `0x${helios.Address.fromBech32(this.refTokenAddress).toHex()}`,
                [
                    [
                        `0x${AssetNameLabel.LBL_444}74657374`, //test
                        ["0x0000000000000000000000000000000000000000000000000000000000000001", 0],
                        0,
                        0,
                        []
                    ],
                    [
                        `0x${AssetNameLabel.LBL_444}7465737431`, //test1
                        ["0x0000000000000000000000000000000000000000000000000000000000000001", 0],
                        10000000,
                        0,
                        []
                    ],
                    [
                        `0x${AssetNameLabel.LBL_444}7465737432`, //test2
                        ["0x0000000000000000000000000000000000000000000000000000000000000001", 0],
                        40000000,
                        Date.now(),
                        [
                            ['0x0000000000000000000000000000000000000000000000000000000274657374', [1, 35000000]],
                            ['0x0000000000000000000000000000000000000000000000000000000274657374', [2, 30000000]],
                            ['0x0000000000000000000000000000000000000000000000000000000274657374', [3, 25000000]],
                            ['0x0000000000000000000000000000000000000000000000000000000274657374', [4, 0]]
                        ]
                    ]
                ]
            ];
        }
        if (config) {
            this.config = config;
        }
        else {
            this.config = [
                `0x${helios.Address.fromBech32(this.feeAddress).toHex()}`,
                [
                    [0, 0],
                    [10000000, 1000000],
                    [40000000, 2000000],
                    [80000000, 3000000]
                ]
            ];

        }
        this.settingsCbor = await convertJsontoCbor(this.settings);
        // Need to hard code it until we fix numeric object keys in the API
        // this.settingsCbor = '9f581d61843ed5ef8fdf7fa0be40f016f96a29b0e8f1085c48bd8bad9ff85130581d61ef674c3d6bd05abf5895451a693611454126338ca5d2fafe942b61459f9f48001bc280746573749f5820000000000000000000000000000000000000000000000000000000000000000100ff0000a0ff9f49001bc28074657374319f5820000000000000000000000000000000000000000000000000000000000000000100ff1a0098968000a0ff9f49001bc28074657374329f5820000000000000000000000000000000000000000000000000000000000000000100ff1a02625a001b0000018f78e45444a3582000000000000000000000000000000000000000000000000000000002746573749f011a02160ec0ff582000000000000000000000000000000000000000000000000000000002746573749f021a01c9c380ff582000000000000000000000000000000000000000000000000000000002746573749f0400ffffffff';
        // console.log("settings", this.settingsCbor)
        this.configCbor = await convertJsontoCbor(this.config);
    }
}

export class EditingFixtures extends Fixture {
    policyId: string
    commonFixtures: CommonFixtures
    bgDatumCbor:string

    constructor(validatorHash: helios.ValidatorHash, policyId: string, commonFixtures: CommonFixtures, bgDatumCbor:string, scriptAddress: helios.Address) {
        super(validatorHash);
        this.policyId = policyId;
        this.commonFixtures = commonFixtures;
        this.bgDatumCbor = bgDatumCbor;
        this.scriptAddress = scriptAddress;
    }

    initialize = (): EditingFixtures =>
    {
        this.inputs = [new helios.TxInput(
            new helios.TxOutputId(getNewFakeUtxoId()),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress), new helios.Value(BigInt(100000000))
        )),
        new helios.TxInput(
            new helios.TxOutputId(getNewFakeUtxoId()),
            new helios.TxOutput(this.scriptAddress,
            new helios.Value(BigInt(5000000), new helios.Assets([[this.policyId, [[`${AssetNameLabel.LBL_100}74657374`, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(this.bgDatumCbor))
        )),
        new helios.TxInput(
            new helios.TxOutputId(getNewFakeUtxoId()),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[rootHandle, 1]]]]))
        ))];
    
        this.refInputs = [new helios.TxInput(
            new helios.TxOutputId(getNewFakeUtxoId()),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[settingsHandle, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(this.commonFixtures.settingsCbor))
        ))];
    
        this.outputs = [new helios.TxOutput(
            helios.Address.fromBech32(this.commonFixtures.refTokenAddress), new helios.Value(BigInt(5000000), new helios.Assets([[this.policyId, [[`${AssetNameLabel.LBL_100}74657374`, 1]]]]))
        ),
        new helios.TxOutput(
            helios.Address.fromBech32(this.commonFixtures.walletAddress), new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[rootHandle, 1]]]]))
        )];

        this.signatories = []

        this.redeemer = helios.UplcData.fromCbor('d8799f48000643b074657374ff');
        
        return this;
    }
}

export class MintingFixtures extends Fixture {
    policyId :string;
    commonFixtures: CommonFixtures;
    configCbor:string;

    constructor(validatorHash: helios.ValidatorHash, policyId: string, commonFixtures: CommonFixtures, configCbor:string) {
        super(validatorHash);
        this.policyId = policyId;
                this.commonFixtures = commonFixtures;
        this.configCbor = configCbor;
    }

    initialize = (): MintingFixtures =>
    {
        this.inputs = [new helios.TxInput(
            new helios.TxOutputId(getNewFakeUtxoId()),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress), new helios.Value(BigInt(200000000))
        ))];
        this.refInputs = [new helios.TxInput(
                new helios.TxOutputId(getNewFakeUtxoId()),
                new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress),
                new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[configHandle, 1]]]])),
                helios.Datum.inline(helios.UplcData.fromCbor(this.configCbor))
            )),  
            new helios.TxInput(
                new helios.TxOutputId(getNewFakeUtxoId()),
                new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress),
                new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[settingsHandle, 1]]]])),
                helios.Datum.inline(helios.UplcData.fromCbor(this.commonFixtures.settingsCbor))
            ))
        ];
    
        this.outputs = [new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.paymentAddress), new helios.Value(BigInt(94000000))),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.feeAddress), new helios.Value(BigInt(6000000))),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress), new helios.Value(BigInt(5000000), new helios.Assets([[this.policyId, [[`${AssetNameLabel.LBL_444}74657374`, 2],[`${AssetNameLabel.LBL_444}7465737431`, 2],[`${AssetNameLabel.LBL_444}7465737432`, 2]]]]))),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.refTokenAddress), new helios.Value(BigInt(5000000), new helios.Assets([[this.policyId, [[`${AssetNameLabel.LBL_100}74657374`, 1],[`${AssetNameLabel.LBL_100}7465737431`, 1],[`${AssetNameLabel.LBL_100}7465737432`, 1]]]])))
        ];

        this.signatories = [helios.PubKeyHash.fromHex(helios.Address.fromBech32(this.commonFixtures.walletAddress).pubKeyHash?.hex ?? '')]

        this.redeemer = helios.UplcData.fromCbor('d8799fff');

        this.minted = [[`${AssetNameLabel.LBL_444}74657374`, BigInt(2)], [`${AssetNameLabel.LBL_444}7465737431`, BigInt(2)], [`${AssetNameLabel.LBL_444}7465737432`, BigInt(2)], [`${AssetNameLabel.LBL_100}74657374`, BigInt(1)], [`${AssetNameLabel.LBL_100}7465737431`, BigInt(1)], [`${AssetNameLabel.LBL_100}7465737432`, BigInt(1)]];
        
        return this;
    }
        
}