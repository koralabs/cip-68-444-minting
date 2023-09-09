import * as helios from "@hyperionbt/helios";

// STRINGS
export const handle = 'xar12345'

// HASHES
export const admin_bytes = '#01234567890123456789012345678901234567890123456789000007';
const script_creds_bytes = '#01234567890123456789012345678901234567890123456789000001';
export const owner_bytes = '#12345678901234567890123456789012345678901234567890123456';
const script_hash = `ValidatorHash::new(${script_creds_bytes})`;
const treasury_bytes = '#01234567890123456789012345678901234567890123456789000002';
const ada_handles_bytes = '#01234567890123456789012345678901234567890123456789000003';
export const pz_provider_bytes = '#01234567890123456789012345678901234567890123456789000004';
const handles_policy = '#f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a';
export const bg_policy = '#f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9b';
export const pfp_policy = '#f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9c';

// TRANSACTION HASHES
const script_tx_hash = 'TxId::new(#0123456789012345678901234567890123456789012345678901234567891234)';
const owner_tx_hash = 'TxId::new(#0123456789012345678901234567890123456789012345678901234567891235)';
export const handles_tx_hash = 'TxId::new(#0123456789012345678901234567890123456789012345678901234567891236)';

// SIGNATURE HASHES
const owner_pubkey_hash = `PubKeyHash::new(${owner_bytes})`;

export class ScriptContext {
    inputs = [];
    referenceInputs = [];
    outputs = [];
    signers = [];
  
    constructor() {
    }
 
    render() {
      //console.log(this.inputs, this.referenceInputs, this.outputs)
      let renderedInputs = '';
      for (let i=0; i<this.inputs.length; i++){
        renderedInputs += this.inputs[i].render() + (i+1 == this.inputs.length ? '' : ', ');
      }
      let renderedRefs = '';
      for (let i=0; i<this.referenceInputs.length; i++){
        renderedRefs += this.referenceInputs[i].render() + (i+1 == this.referenceInputs.length ? '' : ', ');
      }
      let renderedOutputs = '';
      for (let i=0; i<this.outputs.length; i++){
        renderedOutputs += this.outputs[i].render() + (i+1 == this.outputs.length ? '' : ', ');
      }
      let renderedSigners = '';
      for (let i=0; i<this.signers.length; i++){
        renderedSigners += `PubKeyHash::new(${this.signers[i]})${i+1 == this.signers.length ? '' : ', '}`;
      }
      return `ScriptContext::new_spending(
          Tx::new(
            []TxInput{${renderedInputs}},
            []TxInput{${renderedRefs}},
            []TxOutput{${renderedOutputs}},
            Value::lovelace(160000),
            Value::ZERO,
            []DCert{},
            Map[StakingCredential]Int{},
            TimeRange::from(Time::new(1001)),
            []PubKeyHash{${renderedSigners}},
            Map[ScriptPurpose]Data{},
            Map[DatumHash]Data{},
            ${script_tx_hash}
          ),
          TxOutputId::new(${script_tx_hash}, 0)
      )`
    }
  }
  
  export class TxInput {
    hash = '';
    output;
  
    constructor(hash=`${pz_provider_bytes}`, output=(new TxOutput())) {
      this.hash = hash;
      this.output = output;
     }
  
    render() {
      return `
            TxInput::new(
                  TxOutputId::new(${this.hash}, 0), ${this.output.render()})`
    }
  }
  
  export class TxOutput {
    hashType = 'validator';
    datumType = 'none';
    hash = '';
    label = '';
    asset = '';
    lovelace = '10000000';
    datum = 'good_datum';
    policy = 'HANDLE_POLICY';
    value = '';
    
    constructor(hash=`${pz_provider_bytes}`, label='LBL_100', asset=`"${handle}"`, value=null) {
      if (hash != null) {
        this.hash = hash;
      }
      if (label != null) {
        this.label = label;
      }
      if (asset != null) {
        this.asset = asset;
      }
      this.value = value;
     }
  
    render() {
      if (this.asset != null && this.value == null) {
        this.value = `+ Value::new(AssetClass::new(${this.policy}, ${this.label}${this.label ? ' + ': ''}(${this.asset}.encode_utf8())), 1)`;
      }
      let hashString = 'validator(Validator';
      if (this.hashType == 'pubkey') {
        hashString = 'pubkey(PubKey';
      }
      let datumString = `none()`;
      if (this.datumType == 'inline') {
        datumString = `inline(${this.datum})`;
      }
  
      return `
                TxOutput::new(
                  Address::new(Credential::new_${hashString}Hash::new(${this.hash})), Option[StakingCredential]::None),
                  Value::lovelace(${this.lovelace}) ${this.value},
                  OutputDatum::new_${datumString})`
    }
  }
  
  export class PzRedeemer {
  
    constructor() { }
  
    render() {
        return `Redeemer::PERSONALIZE { handle: ${this.handle}, designer: ${this.renderDesigner()}}\n`;
    }
  
  }
  
  export class PzSettings {
    treasury_fee = '1500000'
    treasury_cred = `${treasury_bytes}`
    pz_min_fee = '3500000'
    pz_providers = `Map[ByteArray]ByteArray{${ada_handles_bytes}: ${ada_handles_bytes}, ${pz_provider_bytes}: ${pz_provider_bytes}}`
    valid_contracts = `[]ByteArray{${script_creds_bytes}}`
    admin_creds = `[]ByteArray{${admin_bytes}}`
    settings_cred = `${ada_handles_bytes}`
  
    constructor() {}
    render() {
        return `PzSettings {
            treasury_fee: ${this.treasury_fee},
            treasury_cred: ${this.treasury_cred},
            pz_min_fee: ${this.pz_min_fee},
            pz_providers: ${this.pz_providers},
            valid_contracts: ${this.valid_contracts},
            admin_creds: ${this.admin_creds},
            settings_cred: ${this.settings_cred}
        }`
    }
  }
  