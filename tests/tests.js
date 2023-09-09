import fs from "fs";
import * as tester from './contractTesting.js'
import { Datum, Redeemer, ScriptContext } from './testClasses.js'

let contract = fs.readFileSync("../minting.helios").toString();
contract = contract.replace(/ctx.get_current_validator_hash\(\)/g, 'ValidatorHash::new(#01234567890123456789012345678901234567890123456789000001)');

tester.init();

const pzRedeemer = new Redeemer();

Promise.all([
    // PERSONALIZE ENDPOINT - SHOULD APPROVE
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    
]).then(() => {
    tester.displayStats()
})