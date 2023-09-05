import fs from "fs";
import * as tester from './contractTesting.js'
import { BackgroundDefaults, Datum, PzRedeemer, PzSettings, ScriptContext, 
    ApprovedPolicyIds, handle, pz_provider_bytes, pfp_policy, MigrateRedeemer, 
    owner_bytes, bg_policy, TxInput, TxOutput, handles_tx_hash, admin_bytes, ReturnRedeemer } from './testClasses.js'

let contract = fs.readFileSync("../contract.helios").toString();
contract = contract.replace(/ctx.get_current_validator_hash\(\)/g, 'ValidatorHash::new(#01234567890123456789012345678901234567890123456789000001)');

tester.init();

const pzRedeemer = new PzRedeemer();
const resetRedeemer = new MigrateRedeemer('RESET');
const migrateRedeemer = new MigrateRedeemer();
const returnRedeemer = new ReturnRedeemer();

Promise.all([
    // PERSONALIZE ENDPOINT - SHOULD APPROVE
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, pfp CIP-25, defaults forced", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.find(input => input.output.asset == '"pfp"' && input.output.label == 'LBL_222').output.label = '';
        context.referenceInputs.splice(context.referenceInputs.indexOf(context.referenceInputs.find(input => input.output.asset == '"pfp"' && input.output.label == 'LBL_100')), 1);
        const datum = new Datum(pzRedeemer.calculateCid());
        datum.extra.pfp_asset = `OutputDatum::new_inline(${pfp_policy}706670).data`;
        context.outputs.find(output => output.asset == `"${handle}"` && output.label == 'LBL_100').datum = datum.render();
        const pfpApproverList = new ApprovedPolicyIds();
        pfpApproverList.map[`${pfp_policy}`] = {'#706670': [0,0,0]}
        context.referenceInputs.find(input => input.output.asset == '"pfp_policy_ids"' && input.output.label == 'LBL_222').output.datum = pfpApproverList.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, no defaults", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const bg_ref = context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100');
        const defaults = new BackgroundDefaults();
        defaults.extra = {};
        bg_ref.output.datum = defaults.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, provider policies", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const bg_policy_input = context.referenceInputs.find(input => input.output.asset == '"bg_policy_ids"');
        bg_policy_input.output.asset = '"partner@bg_policy_ids"';
        bg_policy_input.output.hash = `${pz_provider_bytes}`;
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, good qr dot default", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_dot = 'OutputDatum::new_inline("square,#dddddd").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.qr_dot;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, good qr inner default", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_inner_eye = 'OutputDatum::new_inline("square,#dddddd").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.qr_inner_eye;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, good qr outer default", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_outer_eye = 'OutputDatum::new_inline("square,#dddddd").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.qr_outer_eye;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, no default shadow color", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.font_shadow_color = 'OutputDatum::new_inline(#dddddd).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.font_shadow_colors;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, no default pfp border", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.pfp_border_color = 'OutputDatum::new_inline(#dddddd).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.pfp_border_colors;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, no default bg border", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.bg_border_color = 'OutputDatum::new_inline(#dddddd).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.bg_border_colors;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, no default qr bg color", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_bg_color = 'OutputDatum::new_inline(#dddddd).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.qr_bg_color;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, no default offset", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.pfp_offset = 'OutputDatum::new_inline([]Int{1,1}).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.pfp_offset;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, no default shadow size", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.font_shadow_size = 'OutputDatum::new_inline([]Int{1,1,1}).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.font_shadow_size;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, no default zoom", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.pfp_zoom = 'OutputDatum::new_inline(145).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.pfp_zoom;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),

    // PERSONALIZE ENDPOINT - SHOULD DENY
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong handle name", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.find(input => input.output.asset == `"${handle}"` && input.output.label == 'LBL_222').output.asset = '"xar12346"'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Handle input not present"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong handle label", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.find(input => input.output.asset == `"${handle}"` && input.output.label == 'LBL_222').output.label = '#000653b0'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Handle input not present"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong handle policy", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.find(input => input.output.asset == `"${handle}"` && input.output.label == 'LBL_222').output.policy = 'MintingPolicyHash::new(#f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9b)'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Handle input not present"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, bad ref token name", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.outputs.find(output => output.asset == `"${handle}"` && output.label == 'LBL_100').asset = '"xar12346"'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Reference Token input not present"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, bad ref token label", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.outputs.find(output => output.asset == `"${handle}"` && output.label == 'LBL_100').label = 'LBL_444'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Reference Token input not present"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, bad ref token policy", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.outputs.find(output => output.asset == `"${handle}"` && output.label == 'LBL_100').policy = 'MintingPolicyHash::new(#123456789012345678901234567890123456789012345678901234af)'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Reference Token input not present"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, bad ref token output", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.outputs.find(output => output.asset == `"${handle}"` && output.label == 'LBL_100').hash = '#123456789012345678901234567890123456789012345678901234af'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Contract not found in valid contracts list"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, handle sig mismatch", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.find(input => input.output.asset == `"${handle}"` && input.output.label == 'LBL_222').output.hash = '#123456789012345678901234567890123456789012345678901234af'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Handle input not present"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, handle missing", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.splice(context.referenceInputs.indexOf(context.referenceInputs.find(input => input.output.asset == `"${handle}"` && input.output.label == 'LBL_222')), 1);
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Handle input not present"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, bg_policy_ids missing", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.splice(context.referenceInputs.indexOf(context.referenceInputs.find(input => input.output.asset == '"bg_policy_ids"' && input.output.label == 'LBL_222')), 1);
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "bg_policy_ids reference input not present or not from valid provider"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, bg_policy_ids wrong hash", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.find(input => input.output.asset == `"bg_policy_ids"` && input.output.label == 'LBL_222').output.hash = '#123456789012345678901234567890123456789012345678901234af'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "bg_policy_ids reference input not present or not from valid provider"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, pfp_policy_ids missing", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.splice(context.referenceInputs.indexOf(context.referenceInputs.find(input => input.output.asset == '"pfp_policy_ids"' && input.output.label == 'LBL_222')), 1);
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "pfp_policy_ids reference input not present or not from valid provider"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, pfp_policy_ids wrong hash", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.find(input => input.output.asset == `"pfp_policy_ids"` && input.output.label == 'LBL_222').output.hash = '#123456789012345678901234567890123456789012345678901234af'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "pfp_policy_ids reference input not present or not from valid provider"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, pz_settings missing", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.splice(context.referenceInputs.indexOf(context.referenceInputs.find(input => input.output.asset == '"pz_settings"' && input.output.label == 'LBL_222')), 1);
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "pz_settings reference input not present"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, pz_settings wrong hash", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.referenceInputs.find(input => input.output.asset == `"pz_settings"` && input.output.label == 'LBL_222').output.hash = '#123456789012345678901234567890123456789012345678901234af'
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "pz_settings reference input not from ADA Handle"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, bad script creds", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const datum = new PzSettings();
        datum.valid_contracts = '[]ByteArray{#123456789012345678901234567890123456789012345678901234af}';
        context.referenceInputs.find(input => input.output.asset == `"pz_settings"` && input.output.label == 'LBL_222').output.datum = datum.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Contract not found in valid contracts list"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, treas fee low", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.outputs.find(output => output.lovelace == 1500000).lovelace = 10;
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Handle treasury fee unpaid"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, treas fee no handle", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.outputs.find(output => output.lovelace == 1500000).datum = `"wrong".encode_utf8()`;
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Handle treasury fee unpaid"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, treas fee bad address", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.outputs.find(output => output.lovelace == 1500000).hash = '#123456789012345678901234567890123456789012345678901234af';
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Handle treasury fee unpaid"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, prov fee low", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.outputs.find(output => output.lovelace == 3500000).lovelace = 10;
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Personalization provider not found or fee unpaid"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, prov fee no handle", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.outputs.find(output => output.lovelace == 3500000).datum = `"wrong".encode_utf8()`;
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Personalization provider not found or fee unpaid"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, prov fee bad address", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.outputs.find(output => output.lovelace == 3500000).hash = '#123456789012345678901234567890123456789012345678901234af';
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Personalization provider not found or fee unpaid"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong bg_border", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.bg_border_color = 'OutputDatum::new_inline(#dddddd).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "bg_border_color is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong pfp_border", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.pfp_border_color = 'OutputDatum::new_inline(#dddddd).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "pfp_border_color is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong ribbon gradient", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.text_ribbon_gradient = 'OutputDatum::new_inline("radial").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "text_ribbon_gradient is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong gradient colors", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.text_ribbon_colors = 'OutputDatum::new_inline([]ByteArray{#aaaaaa, #bbbbbb}).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "text_ribbon_colors is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong gradient", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.text_ribbon_colors = 'OutputDatum::new_inline([]ByteArray{#aaaaaa}).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.text_ribbon_gradient;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "text_ribbon_gradient is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong ribbon colors", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.text_ribbon_colors = 'OutputDatum::new_inline([]ByteArray{#aaaaaa}).data';
        redeemer.designer.text_ribbon_gradient = 'OutputDatum::new_inline("").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.text_ribbon_gradient;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "text_ribbon_colors is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong font color", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.font_color = 'OutputDatum::new_inline(#aaaaaa).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "font_color is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong default font color", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.font_color = 'OutputDatum::new_inline(#aaaaaa).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.font_color;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "font_color is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong default font", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.font = 'OutputDatum::new_inline("this_really_cool_font").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.font;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "font is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong font color", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.font = 'OutputDatum::new_inline("this_really_cool_font").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "font is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong font shadow color", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.font_shadow_color = 'OutputDatum::new_inline(#dddddd).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "font_shadow_color is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong shadow size", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.font_shadow_size = 'OutputDatum::new_inline([]Int{1,1,1}).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "font_shadow_size is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong pfp zoom", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.pfp_zoom = 'OutputDatum::new_inline(145).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "pfp_zoom is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong pfp offset", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.pfp_offset = 'OutputDatum::new_inline([]Int{1,1}).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "pfp_offset is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong qr bg color", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_bg_color = 'OutputDatum::new_inline(#dddddd).data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "qr_bg_color is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong qr dots", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_dot = 'OutputDatum::new_inline("rounded,#dddddd").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "qr_dot is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong qr inner", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_inner_eye = 'OutputDatum::new_inline("rounded,#dddddd").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "qr_inner_eye is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong qr outer", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_outer_eye = 'OutputDatum::new_inline("rounded,#dddddd").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "qr_outer_eye is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong qr dot default", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_dot = 'OutputDatum::new_inline("rounded,#dddddd").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.qr_dot;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "qr_dot is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong qr inner default", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_inner_eye = 'OutputDatum::new_inline("rounded,#dddddd").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.qr_inner_eye;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "qr_inner_eye is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong qr outer default", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_outer_eye = 'OutputDatum::new_inline("rounded,#dddddd").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.qr_outer_eye;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "qr_outer_eye is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong qr image", () => {
        const redeemer = new PzRedeemer();
        redeemer.designer.qr_image = 'OutputDatum::new_inline("https://bad").data';
        const context = new ScriptContext().initPz(redeemer.calculateCid());
        const program = tester.createProgram(contract, new Datum().render(), redeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "qr_image is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, no default qr image", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        delete bgDefaults.extra.qr_image;
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "qr_image is not set correctly"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong pfp attr", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        bgDefaults.extra.require_pfp_attributes = 'OutputDatum::new_inline([]String{"attr:wrong"}).data';
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Required PFP attribute not present on PFP asset"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, wrong pfp", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const bgDefaults = new BackgroundDefaults();
        bgDefaults.extra.require_pfp_collections = 'OutputDatum::new_inline([]ByteArray{#badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbad}).data';
        context.referenceInputs.find(input => input.output.asset == '"bg"' && input.output.label == 'LBL_100').output.datum = bgDefaults.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Required PFP is not present in inputs"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, pfp not displayed", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const datum = new Datum(pzRedeemer.calculateCid());
        datum.extra.pfp_asset = `OutputDatum::new_inline(${pfp_policy}706670706670).data`;
        context.outputs.find(output => output.asset == `"${handle}"` && output.label == 'LBL_100').datum = datum.render();
        const goodPfpInput = new TxInput(`${handles_tx_hash}`, new TxOutput(`${owner_bytes}`, '', '"pfppfp"'));
        goodPfpInput.output.hashType = 'pubkey';
        goodPfpInput.output.policy = `MintingPolicyHash::new(${pfp_policy})`;
        context.referenceInputs.push(goodPfpInput);
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Required PFP isn't displayed in Handle"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, bad update address", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const datum = new Datum(pzRedeemer.calculateCid());
        datum.extra.last_update_address = `OutputDatum::new_inline(#6012345678901234567890123456789012345678901234567890123457).data`;
        context.outputs.find(output => output.asset == `"${handle}"` && output.label == 'LBL_100').datum = datum.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "last_update_address does not match Handle address"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, unsigned validator", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        context.signers = [owner_bytes];
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "validated_by is set but not signed"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, bg nsfw", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const approver =  new ApprovedPolicyIds();
        approver.map[bg_policy] = {"#001bc2806267": [1,0,0]}
        context.referenceInputs.find(input => input.output.asset == '"bg_policy_ids"' && input.output.label == 'LBL_222').output.datum = approver.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Trial/NSFW flags set incorrectly (BG)"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, bg trial", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const approver =  new ApprovedPolicyIds();
        approver.map[bg_policy] = {"#001bc2806267": [0,1,0]}
        context.referenceInputs.find(input => input.output.asset == '"bg_policy_ids"' && input.output.label == 'LBL_222').output.datum = approver.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Trial/NSFW flags set incorrectly (BG)"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, pfp nsfw", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const approver =  new ApprovedPolicyIds();
        approver.map[`${pfp_policy}`] = {'#000de140706670': [1,0,0],'#706670706670': [1,0,0]}
        context.referenceInputs.find(input => input.output.asset == '"pfp_policy_ids"' && input.output.label == 'LBL_222').output.datum = approver.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Trial/NSFW flags set incorrectly (PFP)"),
    tester.testCase(false, "PERSONALIZE", "reference inputs, CIP-68, defaults forced, pfp trial", () => {
        const context = new ScriptContext().initPz(pzRedeemer.calculateCid());
        const approver =  new ApprovedPolicyIds();
        approver.map[`${pfp_policy}`] = {'#000de140706670': [0,1,0],'#706670706670': [0,1,0]}
        context.referenceInputs.find(input => input.output.asset == '"pfp_policy_ids"' && input.output.label == 'LBL_222').output.datum = approver.render();
        const program = tester.createProgram(contract, new Datum().render(), pzRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Trial/NSFW flags set incorrectly (PFP)"),

    // MIGRATE ENDPOINT - SHOULD APPROVE
    tester.testCase(true, "MIGRATE", "admin, no owner", () => {
        const context = new ScriptContext().initMigrate();
        const program = tester.createProgram(contract, new Datum().render(), migrateRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(true, "MIGRATE", "hardcoded admin", () => {
        const context = new ScriptContext().initMigrate();
        context.signers = ['#4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e1']
        const program = tester.createProgram(contract, new Datum().render(), migrateRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),

    // MIGRATE ENDPOINT - SHOULD DENY
    tester.testCase(false, "MIGRATE", "wrong admin signer", () => {
        const context = new ScriptContext().initMigrate();
        context.signers = [`${owner_bytes}`];
        const program = tester.createProgram(contract, new Datum().render(), migrateRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Required admin signer(s) not present"),
    tester.testCase(false, "MIGRATE", "no admin signers", () => {
        const context = new ScriptContext().initMigrate();
        context.signers = [];
        const program = tester.createProgram(contract, new Datum().render(), migrateRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, "Required admin signer(s) not present"),

    // RESET ENDPOINT - SHOULD APPROVE
    tester.testCase(true, "RESET", "no pz signer, pfp mismatch", () => {
        const context = new ScriptContext().initReset(resetRedeemer);
        context.referenceInputs.find(input => input.output.asset == '"pfp"' && input.output.label == 'LBL_222').output.hash = '#123456789012345678901234567890123456789012345678901234af';
        context.signers = [];
        const program = tester.createProgram(contract, new Datum().render(), resetRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),

    // RESET ENDPOINT - SHOULD DENY
    tester.testCase(false, "RESET", "reset not allowed because all good", () => {
        const context = new ScriptContext().initReset(resetRedeemer);
        context.signers = [];
        const datum = new Datum();
        datum.extra.bg_asset = `OutputDatum::new_inline(${bg_policy}001bc2806267).data`;
        datum.extra.pfp_asset = `OutputDatum::new_inline(${pfp_policy}000de140706670).data`;
        delete datum.extra.validated_by;
        context.outputs.find(output => output.asset == `"${handle}"` && output.label == 'LBL_100').datum = datum.render();
        const program = tester.createProgram(contract, new Datum().render(), resetRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }, 'Reset is not allowed or not authorized'),

    // RETURN_TO_SENDER ENDPOINT - SHOULD DENY
    tester.testCase(false, "RETURN_TO_SENDER", "wrong admin signer", () => {
        const context = new ScriptContext().initReturnToSender();
        context.signers = [`${owner_bytes}`];
        const program = tester.createProgram(contract, new Datum().render(), returnRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    tester.testCase(false, "RETURN_TO_SENDER", "can't return a handle reference token", () => {
        const context = new ScriptContext().initReturnToSender();
        context.inputs[0].output.policy = 'HANDLE_POLICY';
        context.outputs[0].policy = 'HANDLE_POLICY';
        const program = tester.createProgram(contract, new Datum().render(), returnRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),

    // RETURN_TO_SENDER ENDPOINT - SHOULD APPROVE
    tester.testCase(true, "RETURN_TO_SENDER", "all good", () => {
        const context = new ScriptContext().initReturnToSender();
        const program = tester.createProgram(contract, new Datum().render(), returnRedeemer.render(), context.render());
        return { contract: program.compile(), params: ["datum", "redeemer", "context"].map((p) => program.evalParam(p)) };
    }),
    
]).then(() => {
    tester.displayStats()
})