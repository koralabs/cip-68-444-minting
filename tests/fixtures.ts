import * as helios from '@hyperionbt/helios'
import * as https from 'https'
import { mnemonicToEntropy } from 'bip39';
import bip32 from '@stricahq/bip32ed25519';

helios.config.set({ IS_TESTNET: true });

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

    async initialize() {
        this.walletAddress = helios.Address.fromHash(new helios.PubKeyHash([...(await getKeyFromSeedPhrase(testSeedPhrase)).toPublicKey().hash()])).toBech32();
        this.paymentAddress = helios.Address.fromHash(new helios.PubKeyHash([...(await getKeyFromSeedPhrase(testSeedPhrase, 1)).toPublicKey().hash()])).toBech32();
        this.refTokenAddress = helios.Address.fromHash(new helios.PubKeyHash([...(await getKeyFromSeedPhrase(testSeedPhrase, 2)).toPublicKey().hash()])).toBech32();
        this.feeAddress = helios.Address.fromHash(new helios.PubKeyHash([...(await getKeyFromSeedPhrase(testSeedPhrase, 3)).toPublicKey().hash()])).toBech32();
        this.settings = [
            `0x${helios.Address.fromBech32(this.paymentAddress).toHex()}`,
            `0x${helios.Address.fromBech32(this.refTokenAddress).toHex()}`,
            [
                [
                    `0x${LBL_444}74657374`, //test
                    ["0x0000000000000000000000000000000000000000000000000000000000000001", 0],
                    0,
                    0,
                    {}
                ],
                [
                    `0x${LBL_444}7465737431`, //test1
                    ["0x0000000000000000000000000000000000000000000000000000000000000001", 0],
                    10000000,
                    0,
                    {}
                ],
                [
                    `0x${LBL_444}7465737432`, //test2
                    ["0x0000000000000000000000000000000000000000000000000000000000000001", 0],
                    40000000,
                    Date.now(),
                    {'0x0000000000000000000000000000000000000000000000000000000274657374': {2: 30000000}}
                ]
            ]
        ];
        this.config = [
            `0x${helios.Address.fromBech32(this.walletAddress).toHex()}`,
            [
                [0, 0],
                [10000000, 1000000],
                [40000000, 2000000],
                [80000000, 3000000]
            ]
        ];
        this.settingsCbor = await this.convertJsontoCbor(this.settings);
        // Need to hard code it until we fix numeric object keys in the API
        // this.settingsCbor = '83581D61B32D73A127613965D793AD6F7455A9373FB17AE604A24378F4ABA455581D61B32D73A127613965D793AD6F7455A9373FB17AE604A24378F4ABA455838548001BC280746573748258200000000000000000000000000000000000000000000000000000000000000001000000A08549001BC28074657374318258200000000000000000000000000000000000000000000000000000000000000001001A0098968000A08549001BC28074657374328258200000000000000000000000000000000000000000000000000000000000000001001A02625A001b0000018b03a25460A15824000000000000000000000000000000000000000000000000000000000000000274657374A102181E';
        //console.log("settings", this.settingsCbor)
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

    constructor() {
        super();
    }

    initialize = async (policyId: string, commonFixtures: CommonFixtures, bgDatumCbor:string, scriptAddress: helios.Address): Promise<void> =>
    {
        this.inputs = [new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000001#0`),
            new helios.TxOutput(helios.Address.fromBech32(commonFixtures.walletAddress), new helios.Value(BigInt(100000000))
        )),
        new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000002#0`),
            new helios.TxOutput(scriptAddress,
            new helios.Value(BigInt(5000000), new helios.Assets([[policyId, [[`${LBL_100}74657374`, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(bgDatumCbor))
        ))];
    
        this.refInputs = [new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000003#0`),
            new helios.TxOutput(helios.Address.fromBech32(commonFixtures.walletAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[settingsHandle, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(commonFixtures.settingsCbor))
        ))];
    
        this.outputs = [new helios.TxOutput(
            helios.Address.fromBech32(commonFixtures.refTokenAddress), new helios.Value(BigInt(5000000), new helios.Assets([[policyId, [[`${LBL_100}74657374`, 1]]]]))
        )];

        this.signatories = [helios.PubKeyHash.fromHex(helios.Address.fromBech32(commonFixtures.walletAddress).pubKeyHash?.hex ?? '')]

        this.redeemer = helios.UplcData.fromCbor([...Buffer.from('d8799f48000643b074657374ff', 'hex')]);
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
            helios.Address.fromBech32(this.commonFixtures.feeAddress), new helios.Value(BigInt(1000000))
        ),
        new helios.TxOutput(
            helios.Address.fromBech32(this.commonFixtures.walletAddress), new helios.Value(BigInt(5000000), new helios.Assets([[this.policyId, [[`${LBL_444}74657374`, 2],[`${LBL_444}7465737431`, 2],[`${LBL_444}7465737432`, 2]]]]))
        ),
        new helios.TxOutput(
            helios.Address.fromBech32(this.commonFixtures.refTokenAddress), new helios.Value(BigInt(5000000), new helios.Assets([[this.policyId, [[`${LBL_100}74657374`, 1],[`${LBL_100}7465737431`, 1],[`${LBL_100}7465737432`, 1]]]]))
        )];

        this.signatories = [helios.PubKeyHash.fromHex(helios.Address.fromBech32(this.commonFixtures.walletAddress).pubKeyHash?.hex ?? '')]

        this.minted = [[`${LBL_444}74657374`, BigInt(2)], [`${LBL_444}7465737431`, BigInt(2)], [`${LBL_444}7465737432`, BigInt(2)], [`${LBL_100}74657374`, BigInt(1)], [`${LBL_100}7465737431`, BigInt(1)], [`${LBL_100}7465737432`, BigInt(1)]];
        return this;
    }
        
}