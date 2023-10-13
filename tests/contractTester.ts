import * as helios from '@hyperionbt/helios'
import { Fixtures } from './fixtures.js'
import { Color } from './colors.js';
helios.config.set({ IS_TESTNET: false });

export class Test {
  tx: helios.Tx;
  script: helios.UplcProgram;
  inputs?: helios.TxInput[];
  refInputs?: helios.TxInput[];
  outputs?: helios.TxOutput[];
  signatories?: helios.PubKeyHash[];
  minted?: [helios.ByteArray | helios.ByteArrayProps, helios.HInt | helios.HIntProps][];
  redeemer?: helios.UplcData;
  
  constructor (script: helios.Program, fixtures: () => Fixtures, setupTx?: () => helios.Tx) {
    this.script = script.compile(); // We have to compile again for each test due to shared console logging.
    this.tx = setupTx ? setupTx() : new helios.Tx();   
    if (fixtures){
      const fixture = fixtures();
      this.inputs = fixture.inputs;
      this.refInputs = fixture.refInputs;
      this.outputs = fixture.outputs;
      this.signatories = fixture.signatories;
      this.minted = fixture.minted;
      this.redeemer = fixture.redeemer;
    }        
  }

  reset(fixtures: Fixtures | undefined) {}

  build() {
    if (this.inputs)
        this.inputs.forEach((input, index) => this.tx.addInput(input, index == (this.inputs?.length ?? 0) - 1 && !this.minted ? this.redeemer : undefined));

    if (this.refInputs)
      this.refInputs.forEach((input) => this.tx.addRefInput(input));
    
    this.tx.attachScript(this.script)
    
    if (this.minted)
      this.tx.mintTokens(this.script.mintingPolicyHash, this.minted, this.redeemer ?? null);
    
    if (this.outputs)
      this.outputs.forEach((output) => this.tx.addOutput(output));

    if (this.signatories)
      this.signatories.forEach((signer) => this.tx.addSigner(signer));

    return this.tx;
  }
}

export class ContractTester {
    networkParams: helios.NetworkParams;
    successCount = 0;
    failCount = 0;
    testCount = 0;
    testName: string | undefined;
    groupName: string | undefined;
    consoleMessages: string[] = [];
    consoleLog: any;
    consoleWarn:any;
    consoleInfo:any;
    changeAddress: string;
  
    constructor (changeAddress: string) {
        this.consoleLog = console.log;
        this.consoleWarn = console.warn;
        this.consoleInfo = console.info;
        this.changeAddress = changeAddress;
    }

    async init (groupName?: string, testName?: string) {
      this.groupName = groupName;
      this.testName = testName;
        this.networkParams = new helios.NetworkParams(
            await fetch(`https://d1t0d7c2nekuk0.cloudfront.net/mainnet.json`).then((response) =>
                response.json()
            )
        );
    }

    cleanTestName() {
      return `${this.groupName}${this.testName}`.replace(/[^a-z0-9]/gi, '');
    }

    async test(group: string, name: string, test: Test, shouldApprove = true, message?:string) {
        if (this.groupName == null || group == this.groupName) {
            if (this.testName == null || name == this.testName) {
              this.testCount++;

              // SETUP HELIOS MESSAGE DETECTION
              // ******************************
              const consoleMessages:string[] = [];
              const cb = {
                onPrint: async (msg: string) => {consoleMessages.push(msg)},
                onStartCall: helios.DEFAULT_UPLC_RTE_CALLBACKS.onStartCall,
                onEndCall: helios.DEFAULT_UPLC_RTE_CALLBACKS.onEndCall,
                onIncrCost: helios.DEFAULT_UPLC_RTE_CALLBACKS.onIncrCost,
              };
              const np = this.networkParams;
              const originalRun = test.script.run.bind(test.script);
              const newRun = async (args: any, callbacks: any, networkParams: any) => {
                return originalRun(args, cb, np);
              }
              test.script.run = newRun;
              //*******************************

              let tx = test.build();
              try {
                tx = await tx.finalize(this.networkParams, helios.Address.fromBech32(this.changeAddress));
                //console.log(JSON.stringify(tx?.dump()));
                // SUCCESS
                this.logTest(shouldApprove, group, name, consoleMessages, message);
              }
              catch (error: any) {
                //console.log(JSON.stringify(tx.dump()));
                this.logTest(shouldApprove, group, name, consoleMessages, message, error);
              }
            }
        }
    }
    
    logTest(shouldApprove: boolean, group: string, test: string, prints: string[], message?: string, error?: any) {
      const hasPrintStatements = prints.length > 1;
      const assertion: boolean = (shouldApprove && !error) || (!shouldApprove && error && (!message || error.message.includes(message)));
      const textColor = assertion ? Color.FgGreen : Color.FgRed
      
      if (!assertion || hasPrintStatements)
        console.log(`${textColor}------------------------------${Color.Reset}`)
      
      console.log(`${textColor}*${assertion ? "success" : "failure"}* - ${(shouldApprove ? "APPROVE" : "DENY").padEnd(7)} - ${group.padEnd(25)} '${test}'${Color.Reset}`);
      
      if (hasPrintStatements)
        console.log(`   ${Color.FgYellow}PRINT STATEMENTS:${Color.Reset}\n   ${prints.join("\n   ")}`);
      
      if (assertion) {
        this.successCount++
      }
      else {
        this.failCount++
        console.log(`   ${Color.FgYellow}ERROR:${Color.Reset}`);
        if (error)
          console.log(error);
        console.log(`\n`)
        console.log(`   ${Color.FgYellow}EXPECTED:\n   ${Color.FgBlue}${message ? message : "success"}${Color.Reset}`);
        console.log(`   ${Color.FgYellow}RECEIVED:`);
        if (prints.length > 0) {
          // Helios error() is always the last in the output/print statements res[1].length-1]
          console.log(`   ${Color.FgRed}${prints[prints.length-1]}${Color.Reset}`);
        }
        else {
          console.log(`   ${Color.FgRed}${shouldApprove ? "tx denied" : "tx approved"}${Color.Reset}`);
        }
      }
      
      if (!assertion || hasPrintStatements)
      console.log(`${textColor}------------------------------${Color.Reset}`)
    }
    
    displayStats() {
      console.log(`${Color.FgBlue}** SUMMARY **${Color.Reset}`)
      console.log(`${Color.FgBlue}${this.testCount.toString().padStart(5)} total tests${Color.Reset}`)
      if (this.successCount > 0)
        console.log(`${Color.FgGreen}${this.successCount.toString().padStart(5)} successful${Color.Reset}`)
      if (this.failCount > 0)
        console.log(`${Color.FgRed}${this.failCount.toString().padStart(5)} failed${Color.Reset}`)
    }
    
    getTotals() {
      return {testCount: this.testCount, successCount: this.successCount, failCount: this.failCount}
    }

}
