import * as helios from "@hyperionbt/helios";
import base58 from "bs58";

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

    initPz(designerCid=null) {
      this.addPzInputs();
      this.addFeeOutputs();
      const goodRefTokenOutput = new TxOutput(`${script_creds_bytes}`);
      goodRefTokenOutput.datumType = 'inline';
      goodRefTokenOutput.datum = new Datum(designerCid).render();
      this.outputs.push(goodRefTokenOutput);
      this.signers = [owner_bytes, pz_provider_bytes];
      return this;
    }

    addFeeOutputs() {
      const goodTreasuryOutput = new TxOutput(`${treasury_bytes}`, null, null, '');
      goodTreasuryOutput.datumType = 'inline';
      goodTreasuryOutput.datum = `"${handle}".encode_utf8()`;
      goodTreasuryOutput.lovelace = 1500000;
      const goodProviderOutput = new TxOutput(`${pz_provider_bytes}`, null, null, '');
      goodProviderOutput.datumType = 'inline';
      goodProviderOutput.datum = `"${handle}".encode_utf8()`;
      goodProviderOutput.lovelace = 3500000;
      this.outputs.push(goodTreasuryOutput);
      this.outputs.push(goodProviderOutput);
    }

    addPzInputs() {
      this.inputs = [new TxInput(`${script_tx_hash}`, new TxOutput(`${script_creds_bytes}`))];
  
      const goodBgInput = new TxInput(`${handles_tx_hash}`, new TxOutput(`${owner_bytes}`, 'LBL_444', '"bg"'));
      goodBgInput.output.hashType = 'pubkey';
      goodBgInput.output.policy = `MintingPolicyHash::new(${bg_policy})`;
      const goodBgInputRef = new TxInput(`${handles_tx_hash}`, new TxOutput(`${owner_bytes}`, 'LBL_100', '"bg"'));
      goodBgInputRef.output.hashType = 'pubkey';
      goodBgInputRef.output.datumType = 'inline';
      goodBgInputRef.output.datum = new BackgroundDefaults().render();
      goodBgInputRef.output.policy = `MintingPolicyHash::new(${bg_policy})`;
      const goodPfpInput = new TxInput(`${handles_tx_hash}`, new TxOutput(`${owner_bytes}`, 'LBL_222', '"pfp"'));
      goodPfpInput.output.hashType = 'pubkey';
      goodPfpInput.output.policy = `MintingPolicyHash::new(${pfp_policy})`;
      const goodPfpInputRef = new TxInput(`${handles_tx_hash}`, new TxOutput(`${owner_bytes}`, 'LBL_100', '"pfp"'));
      goodPfpInputRef.output.hashType = 'pubkey';
      goodPfpInputRef.output.datumType = 'inline';
      goodPfpInputRef.output.datum = new Datum().render();
      goodPfpInputRef.output.policy = `MintingPolicyHash::new(${pfp_policy})`;
      const goodBgListInput = new TxInput(`${handles_tx_hash}`, new TxOutput(`${ada_handles_bytes}`, 'LBL_222', '"bg_policy_ids"'));
      goodBgListInput.output.datumType = 'inline';
      goodBgListInput.output.datum = new ApprovedPolicyIds().render();
      const goodPfpListInput = new TxInput(`${handles_tx_hash}`, new TxOutput(`${ada_handles_bytes}`, 'LBL_222', '"pfp_policy_ids"'));
      goodPfpListInput.output.datumType = 'inline';
      const pfpApproverList = new ApprovedPolicyIds(); 
      pfpApproverList.map[`${pfp_policy}`] = {'#000de140706670': [0,0,0],'#706670706670': [0,0,0]}
      goodPfpListInput.output.datum = pfpApproverList.render();
      const goodPzInput = new TxInput(`${handles_tx_hash}`, new TxOutput(`${ada_handles_bytes}`, 'LBL_222', '"pz_settings"'));
      goodPzInput.output.datumType = 'inline';
      goodPzInput.output.datum = new PzSettings().render();
      const goodOwnerInput = new TxInput(`${owner_tx_hash}`, new TxOutput(`${owner_bytes}`, 'LBL_222', `"${handle}"`));
      goodOwnerInput.output.hashType = 'pubkey';
      this.referenceInputs = [goodBgInput, goodBgInputRef, goodPfpInput, goodPfpInputRef, goodBgListInput, goodPfpListInput, goodPzInput, goodOwnerInput];
    }

    initMigrate() {
      const goodRefTokenInput = new TxInput(`${script_tx_hash}`, new TxOutput(`${script_creds_bytes}`));
      this.inputs = [goodRefTokenInput];
      const goodRefTokenOutput = new TxOutput(`${script_creds_bytes}`);
      goodRefTokenOutput.datumType = 'inline';
      goodRefTokenOutput.datum = new Datum().render();
      this.outputs = [goodRefTokenOutput];
      const goodPzInput = new TxInput(`${handles_tx_hash}`, new TxOutput(`${ada_handles_bytes}`, 'LBL_222', '"pz_settings"'));
      goodPzInput.output.datumType = 'inline';
      goodPzInput.output.datum = new PzSettings().render();
      this.referenceInputs = [goodPzInput];
      this.signers = [`${admin_bytes}`];
      return this;
    }

    initReset() {
      this.addPzInputs();
      const goodRefTokenOutput = new TxOutput(`${script_creds_bytes}`);
      goodRefTokenOutput.datumType = 'inline';
      const datum = new Datum();
      datum.nft.image = datum.extra.standard_image;
      datum.extra.image_hash = datum.extra.standard_image_hash;
      delete datum.extra.designer;
      delete datum.extra.bg_asset; 
      delete datum.extra.pfp_asset;
      delete datum.extra.pfp_image;
      delete datum.extra.bg_image;
      delete datum.extra.svg_version;
      delete datum.extra.validated_by;
      goodRefTokenOutput.datum = datum.render();
      this.outputs.push(goodRefTokenOutput);
      this.signers = [];
      return this;
    }

    initReturnToSender() {
      const utxoToReturn = new TxInput(`${script_tx_hash}`, new TxOutput(`${script_creds_bytes}`));
      utxoToReturn.output.policy = 'MintingPolicyHash::new(#f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9b)';
      this.inputs = [utxoToReturn];
      const goodPzInput = new TxInput(`${handles_tx_hash}`, new TxOutput(`${ada_handles_bytes}`, 'LBL_222', '"pz_settings"'));
      goodPzInput.output.datumType = 'inline';
      goodPzInput.output.datum = new PzSettings().render();
      this.referenceInputs = [goodPzInput];
      const utxoOutput = new TxOutput(`${script_creds_bytes}`);
      utxoOutput.policy = 'MintingPolicyHash::new(#f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9b)';
      this.outputs = [utxoOutput];
      this.signers = [`${admin_bytes}`];
      return this; 
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
    handle = `"${handle}"`;
    designer = {
      pfp_border_color: 'OutputDatum::new_inline(#22d1af).data',
      qr_inner_eye: 'OutputDatum::new_inline("dots,#0a1fd4").data',
      qr_outer_eye: 'OutputDatum::new_inline("dots,#0a1fd5").data',
      qr_dot: 'OutputDatum::new_inline("dots,#0a1fd6").data',
      qr_bg_color: 'OutputDatum::new_inline(#0a1fd3).data',
      qr_image: 'OutputDatum::new_inline("https://img").data',
      pfp_zoom: 'OutputDatum::new_inline(100).data',
      pfp_offset: 'OutputDatum::new_inline([]Int{1, 2}).data',
      font: 'OutputDatum::new_inline("the font").data',
      font_color: 'OutputDatum::new_inline(#ffffff).data',
      font_shadow_size: 'OutputDatum::new_inline([]Int{12, 10, 8}).data',
      text_ribbon_colors: 'OutputDatum::new_inline([]ByteArray{#0a1fd3, #0a1fd4}).data',
      text_ribbon_gradient: 'OutputDatum::new_inline("linear-45").data',
      font_shadow_color: 'OutputDatum::new_inline(#22d1af).data',
      bg_color: 'OutputDatum::new_inline(#).data',
      bg_border_color: 'OutputDatum::new_inline(#22d1af).data',
      qr_link: 'OutputDatum::new_inline("").data',
      socials: 'OutputDatum::new_inline([]String{}).data',
      svg_version: 'OutputDatum::new_inline(1).data'
    };
  
    constructor() { }
  
    calculateCid() {
        const designer = this.renderDesigner();
        const src = `
            spending get_cid
            
            struct Datum {
                designer: Map[String]Data
            }

            func main(_, _, _) -> Bool {
                true
            }

            const DATUM: Datum = Datum { designer: ${designer} }`
        const program = helios.Program.new(src);
        // console.log(src);
        const myDatum = program.evalParam("DATUM");
        const hash = '01701220' + helios.bytesToHex(helios.Crypto.sha2_256(myDatum.data.toCbor()));
        //console.log('CID = ' +  'z' + base58.encode([...Buffer.from(hash, 'hex')]));
        return 'z' + base58.encode([...Buffer.from(hash, 'hex')]);   
    }

    renderDesigner() {
        let designer =  `Map[String]Data {\n`;
        Object.keys(this.designer).forEach((key) => {
            designer += `       "${key}": ${this.designer[key]},\n`
        })
        designer = designer.replace(/,\n$/g, '\n');
        designer += '   }';
        return designer;
    }
  
    render() {
        return `Redeemer::PERSONALIZE { handle: ${this.handle}, designer: ${this.renderDesigner()}}\n`;
    }
  
  }

  export class MigrateRedeemer {
    variant = '';
    handle = `"${handle}"`;
  
    constructor(variant='MIGRATE') {
      this.variant = variant;
    }
  
    render() {
        return `Redeemer::${this.variant} { ${this.handle} }`;
    }
  
  }

  export class ReturnRedeemer {
  
    constructor() {}
  
    render() {
        return `Redeemer::RETURN_TO_SENDER`;
    }
  
  }
  
  export class Datum {
    nft = {
      name: `OutputDatum::new_inline("${handle}").data`,
      image: 'OutputDatum::new_inline("ipfs://pfp").data',
      mediaType: 'OutputDatum::new_inline("image/jpeg").data',
      og: 'OutputDatum::new_inline(0).data',
      og_number: 'OutputDatum::new_inline(1).data',
      rarity: 'OutputDatum::new_inline("basic").data',
      length: 'OutputDatum::new_inline(8).data',
      characters: 'OutputDatum::new_inline("characters,numbers").data',
      numeric_modifiers: 'OutputDatum::new_inline("").data',
      version: 'OutputDatum::new_inline(1).data',
      attr: 'OutputDatum::new_inline("rtta").data'
    };
    version = 1;
    extra = {
      image_hash: 'OutputDatum::new_inline(#).data',
      standard_image: 'OutputDatum::new_inline("ipfs://cid").data',
      standard_image_hash: 'OutputDatum::new_inline(#).data',
      bg_image: 'OutputDatum::new_inline("ipfs://image_cid").data',
      pfp_image: 'OutputDatum::new_inline("ipfs://pfp").data',
      designer: 'OutputDatum::new_inline("ipfs://cid").data',
      bg_asset: `OutputDatum::new_inline(${bg_policy}001bc2806267).data`,
      pfp_asset: `OutputDatum::new_inline(${pfp_policy}000de140706670).data`,
      portal: 'OutputDatum::new_inline("ipfs://cid").data',
      socials: 'OutputDatum::new_inline("ipfs://cid").data',
      vendor: 'OutputDatum::new_inline("ipfs://cid").data',
      default: 'OutputDatum::new_inline(1).data',
      last_update_address: `OutputDatum::new_inline(#60 + ${owner_bytes}).data`,
      agreed_terms: 'OutputDatum::new_inline("https://tou").data',
      trial: 'OutputDatum::new_inline(0).data',
      nsfw: 'OutputDatum::new_inline(0).data',
      migrate_sig_required: 'OutputDatum::new_inline(0).data',
      validated_by: `OutputDatum::new_inline(${pz_provider_bytes}).data`
    };
  
    constructor(designerCid=null) {
        if (designerCid) {
            this.extra.designer = `OutputDatum::new_inline("ipfs://${designerCid}").data`;
        }
    }
  
    render() {
      let datum = `Datum::CIP68 {\n`;
      datum += '                nft: Map[String]Data {\n';
  
      Object.keys(this.nft).forEach((key) => {
        datum += `                  "${key}": ${this.nft[key]},\n`
      })
      datum = datum.replace(/,\n$/g, '\n');
      datum += '               },\n'
      datum += '               version: 1,\n'
      datum += '               extra: Map[String]Data {\n';
  
      Object.keys(this.extra).forEach((key) => {
        datum += `              "${key}": ${this.extra[key]},\n`
      })
      datum = datum.replace(/,\n$/g, '\n');
      datum += '            }}\n'
      return datum;
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
  
  export class ApprovedPolicyIds {
    map = {}
    constructor() {
      this.map[bg_policy] = {"#001bc2806267": [0,0,0]};
    }
    render() {
      let ids = 'Map[ByteArray]Map[ByteArray][]Int {\n';
      Object.keys(this.map).forEach((id) => {
        ids += `${id}: Map[ByteArray][]Int {\n`;
        Object.keys(this.map[id]).forEach((pattern) => {
            ids += `${pattern}: []Int{${this.map[id][pattern].join(',')}},\n`;
        })
        ids = ids.replace(/,\n$/g, '\n');
        ids += '},\n'
      });
      ids = ids.replace(/,\n$/g, '\n');
      ids += '}\n'
      return ids;
    }
  }

  export class BackgroundDefaults {
    nft = {
      name: `OutputDatum::new_inline("${handle}").data`,
      image: 'OutputDatum::new_inline("ipfs://image_cid").data',
      mediaType: 'OutputDatum::new_inline("image/jpeg").data',
      og: 'OutputDatum::new_inline(0).data',
      og_number: 'OutputDatum::new_inline(1).data',
      rarity: 'OutputDatum::new_inline("basic").data',
      length: 'OutputDatum::new_inline(8).data',
      characters: 'OutputDatum::new_inline("characters,numbers").data',
      numeric_modifiers: 'OutputDatum::new_inline("").data',
      version: 'OutputDatum::new_inline(1).data'
    };
    version = 1;
    extra = {
      qr_inner_eye: 'OutputDatum::new_inline("dots,#0a1fd4").data',
      qr_outer_eye: 'OutputDatum::new_inline("dots,#0a1fd5").data',
      qr_dot: 'OutputDatum::new_inline("dots,#0a1fd6").data',
      qr_image: 'OutputDatum::new_inline("https://img").data',
      qr_bg_color: 'OutputDatum::new_inline(#0a1fd3).data',
      pfp_zoom: 'OutputDatum::new_inline(100).data',
      pfp_offset: 'OutputDatum::new_inline([]Int{1, 2}).data',
      font: 'OutputDatum::new_inline("the font").data',
      font_color: 'OutputDatum::new_inline(#ffffff).data',
      font_shadow_size: 'OutputDatum::new_inline([]Int{12, 10, 8}).data',
      text_ribbon_colors: 'OutputDatum::new_inline([]ByteArray{#0a1fd3, #0a1fd4}).data',
      text_ribbon_gradient: 'OutputDatum::new_inline("linear-45").data',
      bg_border_colors: 'OutputDatum::new_inline([]ByteArray{#0a1fd3, #22d1af, #31bc23}).data',
      pfp_border_colors: 'OutputDatum::new_inline([]ByteArray{#0a1fd3, #22d1af, #31bc23}).data',
      font_shadow_colors: 'OutputDatum::new_inline([]ByteArray{#0a1fd3, #22d1af, #31bc23}).data',
      require_pfp_collections: `OutputDatum::new_inline([]ByteArray{${pfp_policy}000de140706670,${pfp_policy}706670}).data`,
      require_pfp_attributes: 'OutputDatum::new_inline([]String{"attr:rtta"}).data',
      require_pfp_displayed: 'OutputDatum::new_inline(1).data',
      price: 'OutputDatum::new_inline(125).data',
      force_creator_settings: 'OutputDatum::new_inline(1).data',
      custom_dollar_symbol: 'OutputDatum::new_inline(0).data'
    }

    constructor() {}
  
    render() {
      let datum = `Datum::CIP68 {\n`;
      datum += '          nft: Map[String]Data {\n';
  
      Object.keys(this.nft).forEach((key) => {
        datum += `            "${key}": ${this.nft[key]},\n`
      })
      datum = datum.replace(/,\n$/g, '\n');
      datum += '          },\n'
      datum += '          version: 1,\n'
      datum += '          extra: Map[String]Data {\n';
  
      Object.keys(this.extra).forEach((key) => {
        datum += `            "${key}": ${this.extra[key]},\n`
      })
      datum = datum.replace(/,\n$/g, '\n');
      datum += '          }}\n'
      return datum;
    }
  }