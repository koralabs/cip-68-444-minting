import fs from "fs";
import * as helios from '@hyperionbt/helios'
import { ContractTester, Test } from './contractTester.js'
import { Fixtures } from "./fixtures.js";

const runTests = async () => {
    let contract = fs.readFileSync("./editing.helios").toString();
    //contract = contract.replace(/ctx.get_current_validator_hash\(\)/g, 'ValidatorHash::new(#01234567890123456789012345678901234567890123456789000001)');
    const fixtures = new Fixtures();
    await fixtures.initialize();
    const program = helios.Program.new(contract);
    program.parameters.SETTINGS_HANDLE_NAME = "settings";
    const tester = new ContractTester();
    await tester.init();

    // Promise.all([
    //     // MINT_ASSET ENDPOINT - SHOULD APPROVE
    //     tester.test(new Test(program.compile(), fixtures), true, "MINT_ASSET", "happy path")
    // ]
    // ).then(() => {tester.displayStats()});
}

(async()=> {
    await runTests()
})();