import * as helios from '@hyperionbt/helios'
import * as https from 'https'
import { mnemonicToEntropy } from 'bip39';
import bip32 from '@stricahq/bip32ed25519';

helios.config.set({ IS_TESTNET: false, AUTO_SET_VALIDITY_RANGE: true });

export const handlesPolicy = helios.MintingPolicyHash.fromHex('f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a');
export const LBL_100 = '000643b0';
export const LBL_222 = '000de140';
export const LBL_444 = '001bc280';
export const configHandle = `${LBL_222}${Buffer.from('mint_config_444').toString('hex')}`;
export const settingsHandle = `${LBL_222}${Buffer.from('settings').toString('hex')}`;

export const getKeyFromSeedPhrase = async (seed: string[], derivation = 0): Promise<bip32.PrivateKey> => {
    const entropy = mnemonicToEntropy(seed.join(' '));
    const buffer = Buffer.from(entropy, 'hex');
    const rootKey = await bip32.Bip32PrivateKey.fromEntropy(buffer);
    return rootKey.derive(2147483648 + 1852).derive(2147483648 + 1815).derive(2147483648 + 0).derive(0).derive(derivation).toPrivateKey();
}

export const testSeedPhrase = ['hurdle', 'exile', 'essence', 'fitness', 'winter', 'unaware', 'coil', 'polar', 'vocal', 'like', 'tuition', 'story', 'consider', 'weasel', 'shove', 'donkey', 'effort', 'nice', 'any', 'buffalo', 'trip', 'amount', 'hundred', 'duty'];

export const walletAddress = helios.Address.fromHash(new helios.PubKeyHash([...(await getKeyFromSeedPhrase(testSeedPhrase)).toPublicKey().hash()])).toBech32();
export const paymentAddress = helios.Address.fromHash(new helios.PubKeyHash([...(await getKeyFromSeedPhrase(testSeedPhrase,1 )).toPublicKey().hash()])).toBech32();
export const refTokenAddress = helios.Address.fromHash(new helios.PubKeyHash([...(await getKeyFromSeedPhrase(testSeedPhrase, 2)).toPublicKey().hash()])).toBech32();
export const feeAddress = helios.Address.fromHash(new helios.PubKeyHash([...(await getKeyFromSeedPhrase(testSeedPhrase, 3)).toPublicKey().hash()])).toBech32();

export class Fixtures {
    inputs?: helios.TxInput[];
    refInputs?: helios.TxInput[];
    outputs?: helios.TxOutput[];
    signatories?: helios.PubKeyHash[];
    minted?: [helios.ByteArray | helios.ByteArrayProps, helios.HInt | helios.HIntProps][];
    redeemer?: helios.UplcData;
    constructor() {}
}

export class CommonFixtures extends Fixtures {
    settings:any[] = [];
    config:any[] = [];
    settingsCbor = '';
    configCbor = '';
    walletAddress = '';
    paymentAddress = '';
    feeAddress = '';
    refTokenAddress = '';

    constructor() {
        super();
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
                        `0x${LBL_444}74657374`, //test
                        ["0x0000000000000000000000000000000000000000000000000000000000000001", 0],
                        0,
                        0,
                        []
                    ],
                    [
                        `0x${LBL_444}7465737431`, //test1
                        ["0x0000000000000000000000000000000000000000000000000000000000000001", 0],
                        10000000,
                        0,
                        []
                    ],
                    [
                        `0x${LBL_444}7465737432`, //test2
                        ["0x0000000000000000000000000000000000000000000000000000000000000001", 0],
                        40000000,
                        Date.now(),
                        [
                            ['0x0000000000000000000000000000000000000000000000000000000274657374', [[1, 35000000]]],
                            ['0x0000000000000000000000000000000000000000000000000000000274657374', [[2, 30000000], [3, 25000000]]],
                            ['0x0000000000000000000000000000000000000000000000000000000274657374', [[4, 0]]]
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
        this.settingsCbor = await this.convertJsontoCbor(this.settings);
        // Need to hard code it until we fix numeric object keys in the API
        // this.settingsCbor = '9f581d61843ed5ef8fdf7fa0be40f016f96a29b0e8f1085c48bd8bad9ff85130581d61ef674c3d6bd05abf5895451a693611454126338ca5d2fafe942b61459f9f48001bc280746573749f5820000000000000000000000000000000000000000000000000000000000000000100ff0000a0ff9f49001bc28074657374319f5820000000000000000000000000000000000000000000000000000000000000000100ff1a0098968000a0ff9f49001bc28074657374329f5820000000000000000000000000000000000000000000000000000000000000000100ff1a02625a001b0000018f78e45444a3582000000000000000000000000000000000000000000000000000000002746573749f011a02160ec0ff582000000000000000000000000000000000000000000000000000000002746573749f021a01c9c380ff582000000000000000000000000000000000000000000000000000000002746573749f0400ffffffff';
        // console.log("settings", this.settingsCbor)
        this.configCbor = await this.convertJsontoCbor(this.config);
    }

    convertJsontoCbor = (json: any): Promise<string> => {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(json);
            const options = {
            hostname: 'preview.api.handle.me',
            port: 443,
            path: '/datum?from=json&to=plutus_data_cbor&numeric_keys=true',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
                'Accept': 'text/plain'
                }
            };
            let data = '';
            const req = https.request(options, (res) => {
                res.on('data', (d) => {
                    data += d;
                });
                res.on('end', () => {
                    resolve(data);
                })
            });
            
            req.on('error', (e) => {
                reject(e);
            });
            
            req.write(postData);
            req.end(); 
        });
    }

}

export class EditingFixtures extends Fixtures {
    policyId: string
    commonFixtures: CommonFixtures
    bgDatumCbor:string
    scriptAddress: helios.Address

    constructor(policyId: string, commonFixtures: CommonFixtures, bgDatumCbor:string, scriptAddress: helios.Address) {
        super();
        this.policyId = policyId;
        this.commonFixtures = commonFixtures;
        this.bgDatumCbor = bgDatumCbor;
        this.scriptAddress = scriptAddress;
    }

    initialize = (): EditingFixtures =>
    {
        this.inputs = [new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000001#0`),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress), new helios.Value(BigInt(100000000))
        )),
        new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000002#0`),
            new helios.TxOutput(this.scriptAddress,
            new helios.Value(BigInt(5000000), new helios.Assets([[this.policyId, [[`${LBL_100}74657374`, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(this.bgDatumCbor))
        ))];
    
        this.refInputs = [new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000003#0`),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[settingsHandle, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(this.commonFixtures.settingsCbor))
        ))];
    
        this.outputs = [new helios.TxOutput(
            helios.Address.fromBech32(this.commonFixtures.refTokenAddress), new helios.Value(BigInt(5000000), new helios.Assets([[this.policyId, [[`${LBL_100}74657374`, 1]]]]))
        )];

        this.signatories = [helios.PubKeyHash.fromHex(helios.Address.fromBech32(this.commonFixtures.walletAddress).pubKeyHash?.hex ?? '')]

        this.redeemer = helios.UplcData.fromCbor('d8799f48000643b074657374ff');
        
        return this;
    }
}

export class MintingFixtures extends Fixtures {
    policyId :string;
    commonFixtures: CommonFixtures;
    configCbor:string;

    constructor(policyId: string, commonFixtures: CommonFixtures, configCbor:string) {
        super();
        this.policyId = policyId;
        this.commonFixtures = commonFixtures;
        this.configCbor = configCbor;
    }

    initialize = (): MintingFixtures =>
    {
        this.inputs = [new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000001#0`),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress), new helios.Value(BigInt(200000000))
        ))];
        this.refInputs = [new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000002#0`),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[configHandle, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(this.configCbor))
        )),  
        new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000003#0`),
            new helios.TxOutput(helios.Address.fromBech32(this.commonFixtures.walletAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[settingsHandle, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(this.commonFixtures.settingsCbor))
        ))];
    
        this.outputs = [new helios.TxOutput(
            helios.Address.fromBech32(this.commonFixtures.paymentAddress), new helios.Value(BigInt(94000000))
        ),
        new helios.TxOutput(
            helios.Address.fromBech32(this.commonFixtures.feeAddress), new helios.Value(BigInt(6000000))
        ),
        new helios.TxOutput(
            helios.Address.fromBech32(this.commonFixtures.walletAddress), new helios.Value(BigInt(5000000), new helios.Assets([[this.policyId, [[`${LBL_444}74657374`, 2],[`${LBL_444}7465737431`, 2],[`${LBL_444}7465737432`, 2]]]]))
        ),
        new helios.TxOutput(
            helios.Address.fromBech32(this.commonFixtures.refTokenAddress), new helios.Value(BigInt(5000000), new helios.Assets([[this.policyId, [[`${LBL_100}74657374`, 1],[`${LBL_100}7465737431`, 1],[`${LBL_100}7465737432`, 1]]]]))
        )];

        this.signatories = [helios.PubKeyHash.fromHex(helios.Address.fromBech32(this.commonFixtures.walletAddress).pubKeyHash?.hex ?? '')]

        this.redeemer = helios.UplcData.fromCbor('d8799fff');

        this.minted = [[`${LBL_444}74657374`, BigInt(2)], [`${LBL_444}7465737431`, BigInt(2)], [`${LBL_444}7465737432`, BigInt(2)], [`${LBL_100}74657374`, BigInt(1)], [`${LBL_100}7465737431`, BigInt(1)], [`${LBL_100}7465737432`, BigInt(1)]];
        
        return this;
    }
        
}