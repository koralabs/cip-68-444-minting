import fs from "fs";
import * as helios from '@hyperionbt/helios'
import { ContractTester, Test } from './contractTester.js'
import { CommonFixtures, EditingFixtures, MintingFixtures } from "./fixtures.js";
helios.config.set({ IS_TESTNET: false });

const runTests = async () => {
    let mintingFile = fs.readFileSync("./minting.helios").toString();
    const mintingProgram = helios.Program.new(mintingFile);
    mintingProgram.parameters.SETTINGS_HANDLE_NAME = "settings";
    const mintingContract = mintingProgram.compile();

    let editingFile = fs.readFileSync("./editing.helios").toString();
    const editingProgram = helios.Program.new(editingFile);
    editingProgram.parameters.SETTINGS_HANDLE_NAME = "settings";
    editingProgram.parameters.MINTING_POLICY_ID = mintingContract.mintingPolicyHash.hex;
    const editingContract = editingProgram.compile();

    let commonFixtures = new CommonFixtures();
    await commonFixtures.initialize();
    
    const mintingFixtures = new MintingFixtures(mintingContract.mintingPolicyHash.hex, commonFixtures, commonFixtures.configCbor);

    const editingFixtures = new EditingFixtures();
    await editingFixtures.initialize(mintingContract.mintingPolicyHash.hex, commonFixtures, commonFixtures.configCbor, helios.Address.fromHash(new helios.ValidatorHash(editingContract.validatorHash.hex)));
    
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
        
        // Editing Contract - SHOULD APPROVE
        tester.test("EDITING", "happy path", new Test(editingProgram, () => editingFixtures)),
    ]
    ).then(() => {tester.displayStats()});
}

(async()=> {
    await runTests()
})();