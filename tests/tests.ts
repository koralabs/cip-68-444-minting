import fs from "fs";
import * as helios from '@hyperionbt/helios'
import { ContractTester, MintingTest } from './contractTester.js'
import { CommonFixtures, MintingFixtures } from "./fixtures.js";
helios.config.set({ IS_TESTNET: false });

const runTests = async () => {

    let editingFile = fs.readFileSync("./editing.helios").toString();
    const editingProgram = helios.Program.new(editingFile);
    editingProgram.parameters.SETTINGS_HANDLE_NAME = "settings";
    const editingContract = editingProgram.compile();
    //const editingFixtures = new EditingFixtures();
    //await editingFixtures.initialize(editingContract.validatorHash.hex);

    let commonFixtures = new CommonFixtures(editingContract.validatorHash.hex);
    await commonFixtures.initialize();

    let mintingFile = fs.readFileSync("./minting.helios").toString();
    const mintingProgram = helios.Program.new(mintingFile);
    mintingProgram.parameters.SETTINGS_HANDLE_NAME = "settings";
    const mintingFixtures = new MintingFixtures();
    const mintingContract = mintingProgram.compile();
    await mintingFixtures.initialize(mintingContract.mintingPolicyHash.hex, commonFixtures.settingsCbor, commonFixtures.configCbor);
    
    const tester = new ContractTester();
    await tester.init();
    
    Promise.all([
        // MINT_ASSET ENDPOINT - SHOULD APPROVE
        tester.test(new MintingTest(mintingContract, mintingFixtures), true, "MINT_ASSET", "happy path")
    ]
    ).then(() => {tester.displayStats()});
}

(async()=> {
    await runTests()
})();