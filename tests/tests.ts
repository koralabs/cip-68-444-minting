import fs from "fs";
import * as helios from '@hyperionbt/helios'
import { ContractTester, Test } from './contractTester.js'
import { CommonFixtures, EditingFixtures, LBL_100, LBL_444, MintingFixtures } from "./fixtures.js";
helios.config.set({ IS_TESTNET: false, AUTO_SET_VALIDITY_RANGE: true });

const runTests = async () => {
    let mintingFile = fs.readFileSync("./minting.helios").toString();
    const mintingProgram = helios.Program.new(mintingFile);
    mintingProgram.parameters.SETTINGS_HANDLE_NAME = "settings";
    const mintingContract = mintingProgram.compile();
    const policyId = mintingContract.mintingPolicyHash.hex;

    let editingFile = fs.readFileSync("./editing.helios").toString();
    const editingProgram = helios.Program.new(editingFile);
    editingProgram.parameters.SETTINGS_HANDLE_NAME = "settings";
    editingProgram.parameters.MINTING_POLICY_ID = mintingContract.mintingPolicyHash.hex;
    const editingContract = editingProgram.compile();

    let commonFixtures = new CommonFixtures();
    await commonFixtures.initialize();
    
    const mintingFixtures = new MintingFixtures(mintingContract.mintingPolicyHash.hex, commonFixtures, commonFixtures.configCbor);

    const editingFixtures = new EditingFixtures(mintingContract.mintingPolicyHash.hex, commonFixtures, commonFixtures.configCbor, helios.Address.fromHash(new helios.ValidatorHash(editingContract.validatorHash.hex)));
    
    const tester = new ContractTester(commonFixtures.walletAddress);
    await tester.init();
    
    Promise.all([
        // Minting Contract - SHOULD APPROVE
        tester.test("MINTING", "New Policy, 444 mints, 100 mints", new Test(mintingProgram, mintingFixtures.initialize)),
        tester.test("MINTING", "Multiple 444 mints", new Test(mintingProgram, () => {
            mintingFixtures.initialize();
            mintingFixtures.signatories = [];
            mintingFixtures.minted = mintingFixtures.minted?.slice(0,3);
            mintingFixtures.outputs = mintingFixtures.outputs?.slice(0,3);
            return mintingFixtures;
        })),
        tester.test("MINTING", "Multiple 444 mints w/ discount", new Test(mintingProgram, () => {
            mintingFixtures.initialize();
            mintingFixtures.signatories = [];
            mintingFixtures.minted = mintingFixtures.minted?.slice(0,3);
            mintingFixtures.inputs?.push(new helios.TxInput(
                new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000001#4`),
                new helios.TxOutput(helios.Address.fromBech32(commonFixtures.walletAddress), new helios.Value(BigInt(5000000), new helios.Assets([['00000000000000000000000000000000000000000000000000000002', [[`74657374`, 2]]]]))
            )));
            mintingFixtures.outputs = mintingFixtures.outputs?.slice(2,3);
            mintingFixtures.outputs?.push(new helios.TxOutput(
                helios.Address.fromBech32(commonFixtures.walletAddress), new helios.Value(BigInt(5000000), new helios.Assets([['00000000000000000000000000000000000000000000000000000002', [[`74657374`, 2]]]]))
            ));
            mintingFixtures.outputs?.push(new helios.TxOutput(
                helios.Address.fromBech32(commonFixtures.paymentAddress), new helios.Value(BigInt(76000000))
            ));
            mintingFixtures.outputs?.push(new helios.TxOutput(
                helios.Address.fromBech32(commonFixtures.feeAddress), new helios.Value(BigInt(4000000))
            ))
            return mintingFixtures;
        })),
        tester.test("MINTING", "Burn approved", new Test(mintingProgram, () => {
            mintingFixtures.initialize();
            mintingFixtures.inputs?.push(new helios.TxInput(
                new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000001#1`),
                new helios.TxOutput(helios.Address.fromBech32(commonFixtures.walletAddress), new helios.Value(BigInt(10000000), new helios.Assets([[policyId, [[`${LBL_100}74657374`, BigInt(2)], [`${LBL_100}7465737431`, BigInt(2)]]]]))
            )));
            mintingFixtures.minted = [[`${LBL_100}74657374`, BigInt(-1)], [`${LBL_100}7465737431`, BigInt(-1)]];
            mintingFixtures.outputs = [new helios.TxOutput(helios.Address.fromBech32(commonFixtures.refTokenAddress), 
                    new helios.Value(BigInt(5000000), new helios.Assets([[policyId, [[`${LBL_100}74657374`, 1],[`${LBL_100}7465737431`, 1]]]]))
            )];
            mintingFixtures.redeemer = helios.UplcData.fromCbor('d87a9fff');
            return mintingFixtures;
        })),

        // Minting Contract - SHOULD DENY
        tester.test("MINTING", "Multiple 444 mints, low payment", new Test(mintingProgram, () => {
            mintingFixtures.initialize();
            mintingFixtures.signatories = [];
            mintingFixtures.minted = mintingFixtures.minted?.slice(0,3);
            mintingFixtures.outputs = mintingFixtures.outputs?.slice(1,3);
            mintingFixtures.outputs?.push(new helios.TxOutput(
                helios.Address.fromBech32(commonFixtures.paymentAddress), new helios.Value(BigInt(90000000))
            ));
            return mintingFixtures;
        }), false, 'Policy minting payment is unpaid'),
        tester.test("MINTING", "Burn too many", new Test(mintingProgram, () => {
            mintingFixtures.initialize();
            mintingFixtures.inputs?.push(new helios.TxInput(
                new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000001#1`),
                new helios.TxOutput(helios.Address.fromBech32(commonFixtures.walletAddress), new helios.Value(BigInt(10000000), new helios.Assets([[policyId, [[`${LBL_100}74657374`, BigInt(2)], [`${LBL_100}7465737431`, BigInt(2)]]]]))
            )));
            mintingFixtures.minted = [[`${LBL_100}74657374`, BigInt(-2)], [`${LBL_100}7465737431`, BigInt(-2)]];
            mintingFixtures.outputs = undefined;
            mintingFixtures.redeemer = helios.UplcData.fromCbor('d87a9fff');
            return mintingFixtures;
        }), false, 'There should be at least one reference token remaining'),
        tester.test("MINTING", "Burn 444 token", new Test(mintingProgram, () => {
            mintingFixtures.initialize();
            mintingFixtures.inputs?.push(new helios.TxInput(
                new helios.TxOutputId(`0000000000000000000000000000000000000000000000000000000000000001#1`),
                new helios.TxOutput(helios.Address.fromBech32(commonFixtures.walletAddress), new helios.Value(BigInt(10000000), new helios.Assets([[policyId, [[`${LBL_100}74657374`, BigInt(2)], [`${LBL_444}7465737431`, BigInt(2)]]]]))
            )));
            mintingFixtures.minted = [[`${LBL_100}74657374`, BigInt(-1)], [`${LBL_444}7465737431`, BigInt(-1)]];
            mintingFixtures.outputs = undefined;
            mintingFixtures.redeemer = helios.UplcData.fromCbor('d87a9fff');
            return mintingFixtures;
        }), false, 'The BURN redeemer only allows reference tokens to be burnt'),
        
        // Editing Contract - SHOULD APPROVE
        tester.test("EDITING", "happy path", new Test(editingProgram, editingFixtures.initialize)),
    ]
    ).then(() => {tester.displayStats()});
}

(async()=> {
    await runTests()
})();