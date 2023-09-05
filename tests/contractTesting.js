import {Color} from './colors.js'
import * as helios from "@hyperionbt/helios"
import fs from "fs";

let testCount;
let successCount;
let failCount;
let group;
let test;

export function init(groupName=null, testName=null) {
  testCount = 0;
  successCount = 0;
  failCount = 0;
  group = groupName;
  test = testName;
}

// evalParam(p) and runWithPrint(p[]). Look for unit "()" response
export async function testCase(shouldApprove, testGroup, testName, setup, message=null) {
  if (group == null || group == testGroup) {
    if (test == null || test == testName) {
      testCount++;
      const {contract, params} = setup();
      await contract.runWithPrint(params).then((res) => {
        logTest(shouldApprove, testGroup, testName, message, res);
      })
      .catch((err) => {
        logTest(shouldApprove, testGroup, testName, message, err);
      });
    }
  }
}

function logTest(shouldApprove, testGroup, testName, message=null, res) {
  const hasPrintStatements = Array.isArray(res) && res.length > 1 && res[1].length > 1;
  const assertion = Array.isArray(res) && (shouldApprove ? res[0].toString() == "()" : res[0].toString() != "()" && (!message || res[1][0] == message));
  const textColor = assertion ? Color.FgGreen : Color.FgRed
  
  if (!assertion || hasPrintStatements)
    console.log(`${textColor}------------------------------${Color.Reset}`)
  
  console.log(`${textColor}*${assertion ? "success" : "failure"}* - ${(shouldApprove ? "APPROVE" : "DENY").padEnd(7)} - ${testGroup.padEnd(25)} '${testName}'${Color.Reset}`);
  
  if (hasPrintStatements)
    console.log(`   ${Color.FgYellow}PRINT STATEMENTS:${Color.Reset}\n   ${res[1].join("\n   ")}`);
  
  if (assertion) {
    successCount++
  }
  else {
    failCount++
    console.log(`   ${Color.FgYellow}MESSAGE:${Color.Reset}`);
    if (Array.isArray(res))
      console.log(res[0]);
    console.log(`\n`)
    console.log(`   ${Color.FgYellow}EXPECTED:\n   ${Color.FgBlue}${message ? message : "success"}${Color.Reset}`);
    if (res.length > 1) {
      // Helios error() is always the last in the output/print statements res[1].length-1]
      console.log(`   ${Color.FgYellow}RECEIVED:\n   ${Color.FgRed}${res[1][res[1].length-1]}${Color.Reset}`);
    }
    else {
      console.log(res);
    }
  }
  
  if (!assertion || hasPrintStatements)
  console.log(`${textColor}------------------------------${Color.Reset}`)
}

export function displayStats() {
  console.log(`${Color.FgBlue}** SUMMARY **${Color.Reset}`)
  console.log(`${Color.FgBlue}${testCount.toString().padStart(5)} total tests${Color.Reset}`)
  if (successCount > 0)
    console.log(`${Color.FgGreen}${successCount.toString().padStart(5)} successful${Color.Reset}`)
  if (failCount > 0)
    console.log(`${Color.FgRed}${failCount.toString().padStart(5)} failed${Color.Reset}`)
}

export function getTotals() {
  return {testCount, successCount, failCount}
}

export function createProgram(contract, datum, redeemer, context) {
  const testingCode = `${contract}\n
    const datum: Datum::CIP68 = ${datum}\n
    const redeemer: ${redeemer.split(' ')[0]} = ${redeemer}\n
    const context: ScriptContext = ${context}\n`;
  if (test != null)
    fs.writeFileSync('testingCode.helios', testingCode);
  return helios.Program.new(testingCode);
}