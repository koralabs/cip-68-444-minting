import * as helios from '@hyperionbt/helios'
import * as https from 'https'

helios.config.set({ IS_TESTNET: false });

export const arbitraryAddress = 'addr1qy0vj5ktefac7mtsdrg7flef7yqhlrw8d60e86c78fctv7wz28dq2p72el5pgmwt0efgc626xkpyhswsqkyqkg622plspph4a7';
export const handlesPolicy = helios.MintingPolicyHash.fromHex('f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a');
export const LBL_222 = '000de140';
export const configHandle = `${LBL_222}${Buffer.from('mint_config_444').toString('hex')}`;
export const settingsHandle = `${LBL_222}${Buffer.from('settings').toString('hex')}`;

export class Fixtures {
    defaultInput: helios.TxInput
    defaultRefInputConfig: helios.TxInput
    defaultRefInputSettings: helios.TxInput
    defaultOutputPayment: helios.TxOutput
    defaultOutputFee: helios.TxOutput
    defaultOutput444Token: helios.TxOutput

    settings = [
        `0x${helios.Address.fromBech32(arbitraryAddress).toHex()}`,
        `0x${helios.Address.fromBech32(arbitraryAddress).toHex()}`,
        [
            "0x1822ab6f7488dd2eca47ad748d43812bb530eee7b0b6565f19f66feb",
            "0x739cb7063d554305850f21de780eb221b9c6066596e750db4b16f2bf"
        ],
        [
            [
                "0x001bc28074657374",
                ["0x2543867d70cde652580265fecfbfb04171bd3cdce76b8af3920ec13de8c67c4f", 0],
                0,
                0
            ],
            [
                "0x001bc2807465737431",
                ["0x2543867d70cde652580265fecfbfb04171bd3cdce76b8af3920ec13de8c67c4f", 0],
                100,
                0
            ],
            [
                "0x001bc2807465737432",
                ["0x2543867d70cde652580265fecfbfb04171bd3cdce76b8af3920ec13de8c67c4f", 0],
                0,
                0
            ]
        ]
    ]
    config = [
        `0x${helios.Address.fromBech32(arbitraryAddress).toHex()}`,
        [
            [0, 0],
            [10000000, 1000000],
            [45000000, 25000000]
        ]
    ]
    settingsCbor = '';
    configCbor = '';

    constructor() {}

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

    initialize = async (): Promise<void> =>
    {
        this.settingsCbor = await this.convertJsontoCbor(this.settings);
        this.configCbor = await this.convertJsontoCbor(this.config);

        this.defaultInput = new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000001#0`),
            new helios.TxOutput(helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(1000000000))
        ));
    
        this.defaultRefInputConfig = new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000002#0`),
            new helios.TxOutput(helios.Address.fromBech32(arbitraryAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[configHandle, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(this.configCbor))
        ));
    
        this.defaultRefInputSettings = new helios.TxInput(
            new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000003#0`),
            new helios.TxOutput(helios.Address.fromBech32(arbitraryAddress),
            new helios.Value(BigInt(5000000), new helios.Assets([[handlesPolicy, [[settingsHandle, 1]]]])),
            helios.Datum.inline(helios.UplcData.fromCbor(this.settingsCbor))
        ));
    
        this.defaultOutputPayment = new helios.TxOutput(
            helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(50000000))
        );
    
        this.defaultOutputFee = new helios.TxOutput(
            helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(2000000))
        );
    
        this.defaultOutput444Token = new helios.TxOutput(
            helios.Address.fromBech32(arbitraryAddress), new helios.Value(BigInt(50000000))
        );
    }
}