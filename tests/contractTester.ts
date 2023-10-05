import * as helios from '@hyperionbt/helios'
import { EditingFixtures, Fixtures, LBL_100, LBL_444, MintingFixtures, arbitraryAddress } from './fixtures.js'
import { Color } from './colors.js';
helios.config.set({ IS_TESTNET: false });

export class Test {
  tx: helios.Tx;
  script: helios.UplcProgram;
  constructor (setupTx?: () => helios.Tx) {
    this.tx = setupTx ? setupTx() : new helios.Tx();   
  }
  reset(fixtures: Fixtures | undefined) {}
  build(): helios.Tx { return new helios.Tx(); }
}

export class EditingTest extends Test {
  input?: helios.TxInput;
  inputRefToken?: helios.TxInput;
  refInputSettings?: helios.TxInput;
  output100Token?: helios.TxOutput;
  signatories?: helios.PubKeyHash[];
  redeemer?: helios.UplcData;

  constructor (script: helios.UplcProgram, fixtures: () => EditingFixtures, setupTx?: () => helios.Tx) {
    super(setupTx);
    this.script = script;
    if (fixtures){
      const fixture = fixtures();
        this.input = fixture.defaultInput;
        this.inputRefToken = fixture.defaultInputRefToken;
        this.refInputSettings = fixture.defaultRefInputSettings;
        this.output100Token = fixture.defaultOutput100Token;
        this.signatories = fixture.signatories;
        this.redeemer = fixture.redeemer;
    }        
  }

  build(): helios.Tx {             
    // Add fees input (minting, execution, minUTxO)
    if (this.input)
      this.tx.addInput(this.input)

    // Add (100) ref token input
    if (this.inputRefToken)
      this.tx.addInput(this.inputRefToken, this.redeemer)
    
    // Add settings handle
    if (this.refInputSettings)
      this.tx.addRefInput(this.refInputSettings)

    // Add editing script
    this.tx.attachScript(this.script)

    // Add (100) ref token output
    if (this.output100Token)
      this.tx.addOutput(this.output100Token)

    if (this.signatories)
      this.signatories.forEach(this.tx.addSigner.bind(this.tx));
    
    return this.tx;
  }
}

export class MintingTest extends Test {
  input?: helios.TxInput;
  refInputConfig?: helios.TxInput;
  refInputSettings?: helios.TxInput;
  outputPayment?: helios.TxOutput;
  outputFee?: helios.TxOutput;
  output444Token?: helios.TxOutput;
  output100Token?: helios.TxOutput;
  signatories?: helios.PubKeyHash[];

  constructor (script: helios.UplcProgram, fixtures: () => MintingFixtures, setupTx?: () => helios.Tx) {
    super(setupTx);
    this.script = script;
    if (fixtures){
      const fixture = fixtures();
        this.input = fixture.defaultInput;
        this.refInputConfig = fixture.defaultRefInputConfig;
        this.refInputSettings = fixture.defaultRefInputSettings;
        this.outputPayment = fixture.defaultOutputPayment;
        this.outputFee = fixture.defaultOutputFee;
        this.output444Token = fixture.defaultOutput444Token;
        this.output100Token = fixture.defaultOutput100Token;
        this.signatories = fixture.signatories;
    }        
  }

  build() {            
    // Add fees input (minting, execution, minUTxO)
    if (this.input)
        this.tx.addInput(this.input)
    
    // Add settings handle
    if (this.refInputSettings)
        this.tx.addRefInput(this.refInputSettings)
    
    // Add config handle
    if (this.refInputConfig)
        this.tx.addRefInput(this.refInputConfig)
    
    // Add minting script
    this.tx.attachScript(this.script)
    
    // Mint a 444
    this.tx.mintTokens(this.script.mintingPolicyHash, [[`${LBL_444}74657374`, BigInt(1)], [`${LBL_444}7465737431`, BigInt(1)],[`${LBL_100}74657374`, BigInt(1)], [`${LBL_100}7465737431`, BigInt(1)]], helios.UplcData.fromCbor('d8799fff'))
    
    // Add destination for minted 444
    if (this.output444Token)
        this.tx.addOutput(this.output444Token)

    // Add destination for minted 100
    if (this.output100Token)
        this.tx.addOutput(this.output100Token)
    
    // Add minting payment
    if (this.outputPayment)
        this.tx.addOutput(this.outputPayment)
    
    // Add minting fee
    if (this.outputFee)
        this.tx.addOutput(this.outputFee)

    if (this.signatories)
      this.signatories.forEach(this.tx.addSigner.bind(this.tx));

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
  
    constructor () {
        this.consoleLog = console.log;
        this.consoleWarn = console.warn;
        this.consoleInfo = console.info;
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

    async logger(...message: any[]) {
      this.consoleMessages.push(...message);
    }

    cleanTestName() {
      return `${this.groupName}${this.testName}`.replace(/[^a-z0-9]/gi, '');
    }

    async test(group: string, name: string, test: Test, shouldApprove: boolean, message=null) {
        if (this.groupName == null || group == this.groupName) {
            if (this.testName == null || name == this.testName) {
              this.testCount++;

              // SETUP HELIOS MESSAGE DETECTION
              // ******************************
              const cb = {...helios.DEFAULT_UPLC_RTE_CALLBACKS, onPrint: this.logger, consoleMessages: []};
              const np = this.networkParams;
              const originalRun = test.script.run.bind(test.script);
              const newRun = async (args: any, callbacks: any, networkParams: any) => {
                return originalRun(args, cb, np);
              }
              test.script.run = newRun;
              //*******************************

              try {
                const tx = await test.build().finalize(this.networkParams, helios.Address.fromBech32(arbitraryAddress));
                //console.log(tx?.toCborHex())
                // SUCCESS
                this.logTest(shouldApprove, group, name, cb.consoleMessages, message);
              }
              catch (error: any) {
                  this.logTest(shouldApprove, group, name, cb.consoleMessages, message, error);
              }
            }
        }
    }
    
    logTest(shouldApprove: boolean, group: string, test: string, prints: string[], message=null, error?: any) {
      const hasPrintStatements = prints.length > 1;
      const assertion = (shouldApprove && !error) || (!shouldApprove && error && (!message || error.message.contains(message)));
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
          console.log(`   ${Color.FgRed}failure${Color.Reset}`);
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
