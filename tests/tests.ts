import fs from "fs";
import * as helios from '@hyperionbt/helios'
import { ContractTester, EditingTest, MintingTest } from './contractTester.js'
import { CommonFixtures, EditingFixtures, MintingFixtures } from "./fixtures.js";
helios.config.set({ IS_TESTNET: false });

const runTests = async () => {
    let mintingFile = fs.readFileSync("./minting.helios").toString();
    const mintingProgram = helios.Program.new(mintingFile);
    mintingProgram.parameters.SETTINGS_HANDLE_NAME = "settings";
    const mintingFixtures = new MintingFixtures();
    const mintingContract = mintingProgram.compile();

    let editingFile = fs.readFileSync("./editing.helios").toString();
    const editingProgram = helios.Program.new(editingFile);
    editingProgram.parameters.SETTINGS_HANDLE_NAME = "settings";
    editingProgram.parameters.MINTING_POLICY_ID = mintingContract.mintingPolicyHash.hex;
    const editingContract = editingProgram.compile();

    let commonFixtures = new CommonFixtures();
    await commonFixtures.initialize();

    await mintingFixtures.initialize(mintingContract.mintingPolicyHash.hex, commonFixtures.settingsCbor, commonFixtures.configCbor);

    const editingFixtures = new EditingFixtures();
    await editingFixtures.initialize(mintingContract.mintingPolicyHash.hex, commonFixtures.settingsCbor, commonFixtures.configCbor, helios.Address.fromHash(new helios.ValidatorHash(editingContract.validatorHash.hex)));
    
    const tester = new ContractTester();
    await tester.init();
    
    Promise.all([
        // Minting Contract - SHOULD APPROVE
        tester.test("MINTING", "happy path", new MintingTest(mintingContract, () => mintingFixtures), true),
        // tester.test("MINTING", "discounts", new MintingTest(mintingContract, () => mintingFixtures, () => {
        //     const tx = new helios.Tx
        //     tx.addInput(); //add the proof of discount UTxO
        //     return tx;
        // }), true),
        
        // Editing Contract - SHOULD APPROVE
        tester.test("EDITING", "happy path", new EditingTest(editingContract, () => editingFixtures), true),
    ]
    ).then(() => {tester.displayStats()});
}

(async()=> {
    await runTests()
})();