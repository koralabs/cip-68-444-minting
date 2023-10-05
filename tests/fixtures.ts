import * as helios from '@hyperionbt/helios'
import * as https from 'https'

helios.config.set({ IS_TESTNET: false });

export const arbitraryAddress = 'addr1qy0vj5ktefac7mtsdrg7flef7yqhlrw8d60e86c78fctv7wz28dq2p72el5pgmwt0efgc626xkpyhswsqkyqkg622plspph4a7';
export const handlesPolicy = helios.MintingPolicyHash.fromHex('f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a');
export const LBL_100 = '000643b0';
export const LBL_222 = '000de140';
export const LBL_444 = '001bc280';
export const configHandle = `${LBL_222}${Buffer.from('mint_config_444').toString('hex')}`;
export const settingsHandle = `${LBL_222}${Buffer.from('settings').toString('hex')}`;

export class Fixtures {
    constructor() {}
}

export class CommonFixtures extends Fixtures {
    settings = [
        `0x${helios.Address.fromBech32(arbitraryAddress).toHex()}`,
        `0x${helios.Address.fromBech32(arbitraryAddress).toHex()}`,
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
                {'0x000000000000000000000000000000000000000000000000000000000000000274657374': {2: 30}}
            ]
        ]
    ]
    config = [
        `0x${helios.Address.fromBech32(arbitraryAddress).toHex()}`,
        [
            [0, 0],
            [10000000, 1000000],
            [40000000, 2000000],
            [80000000, 3000000]
        ]
    ]
    settingsCbor = '';
    configCbor = '';

    constructor() {
        super();
    }

    async initialize() {
        this.settingsCbor = await this.convertJsontoCbor(this.settings);
        this.configCbor = await this.convertJsontoCbor(this.config);
    }

    convertJsontoCbor = (json: any): Promise<string> => {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(json);
            const options = {
            hostname: 'api.handle.me',
            port: 443,
            path: '/datum?from=json&to=plutus_data_cbor',
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
    defaultInput: helios.TxInput;
    defaultInputRefToken: helios.TxInput;
    defaultRefInputSettings: helios.TxInput;
    defaultOutput100Token: helios.TxOutput;
    signatories: helios.PubKeyHash[];
    redeemer: helios.UplcData;

    constructor() {
        super();
    }

    initialize = async (policyId: string, settingsCbor:string, bgDatumCbor:string, scriptAddress: helios.Address): Promise<void> =>
    {
        this.defaultInput = new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000001#0`),
            new helios.TxOutput(helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(100000000))
        ));
    
        this.defaultInputRefToken = new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000002#0`),
            new helios.TxOutput(scriptAddress,
            new helios.Value(BigInt(5000000), new helios.Assets([[policyId, [[`${LBL_100}74657374`, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(bgDatumCbor))
        ));
    
        this.defaultRefInputSettings = new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000003#0`),
            new helios.TxOutput(helios.Address.fromBech32(arbitraryAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[settingsHandle, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(settingsCbor))
        ));
    
        this.defaultOutput100Token = new helios.TxOutput(
            helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(5000000), new helios.Assets([[policyId, [[`${LBL_100}74657374`, 1]]]]))
        );

        this.signatories = [helios.PubKeyHash.fromHex(helios.Address.fromBech32(arbitraryAddress).pubKeyHash?.hex ?? '')]

        this.redeemer = helios.UplcData.fromCbor([...Buffer.from('d8799f48000643b074657374ff', 'hex')]);
    }
        
}

export class MintingFixtures extends Fixtures {
    defaultInput: helios.TxInput
    defaultRefInputConfig: helios.TxInput
    defaultRefInputSettings: helios.TxInput
    defaultOutputPayment: helios.TxOutput
    defaultOutputFee: helios.TxOutput
    defaultOutput444Token: helios.TxOutput
    defaultOutput100Token: helios.TxOutput
    signatories: helios.PubKeyHash[]

    constructor() {
        super();
    }

    initialize = async (policyId: string, settingsCbor:string, configCbor:string): Promise<void> =>
    {
        this.defaultInput = new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000001#0`),
            new helios.TxOutput(helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(100000000))
        ));
    
        this.defaultRefInputConfig = new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000002#0`),
            new helios.TxOutput(helios.Address.fromBech32(arbitraryAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[configHandle, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(configCbor))
        ));
    
        this.defaultRefInputSettings = new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000003#0`),
            new helios.TxOutput(helios.Address.fromBech32(arbitraryAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[settingsHandle, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(settingsCbor))
        ));
    
        this.defaultOutputPayment = new helios.TxOutput(
            helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(9000000))
        );
    
        this.defaultOutputFee = new helios.TxOutput(
            helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(1000000))
        );
    
        this.defaultOutput444Token = new helios.TxOutput(
            helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(5000000), new helios.Assets([[policyId, [[`${LBL_444}74657374`, 1],[`${LBL_444}7465737431`, 1]]]]))
        );
    
        this.defaultOutput100Token = new helios.TxOutput(
            helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(5000000), new helios.Assets([[policyId, [[`${LBL_100}74657374`, 1],[`${LBL_100}7465737431`, 1]]]]))
        );

        this.signatories = [helios.PubKeyHash.fromHex(helios.Address.fromBech32(arbitraryAddress).pubKeyHash?.hex ?? '')]
    }
        
}