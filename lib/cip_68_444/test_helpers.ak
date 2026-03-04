use aiken/collection/dict
use aiken/collection/list
use aiken/interval
use aiken/merkle_patricia_forestry as mpf
use aiken/primitive/bytearray
use cardano/address
use cardano/assets
use cardano/transaction
use cip_68_444/common
use cip_68_444/constants
use cip_68_444/types

pub const settings_handle_name: ByteArray = "settings"

pub const policy_id: assets.PolicyId =
  #"10101010101010101010101010101010101010101010101010101010"

pub const owner_pkh: ByteArray =
  #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
pub const payment_pkh: ByteArray =
  #"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
pub const ref_token_pkh: ByteArray =
  #"cccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
pub const fee_pkh: ByteArray =
  #"dddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
pub const alt_pkh: ByteArray =
  #"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

pub const script_hash: ByteArray =
  #"abababababababababababababababababababababababababababab"
pub const mint_governor_hash: ByteArray =
  #"11111111111111111111111111111111111111111111111111111111"
pub const editing_governor_hash: ByteArray =
  #"22222222222222222222222222222222222222222222222222222222"
pub const alt_governor_hash: ByteArray =
  #"33333333333333333333333333333333333333333333333333333333"

pub fn owner_address() -> address.Address {
  address.from_verification_key(owner_pkh)
}

pub fn payment_address() -> address.Address {
  address.from_verification_key(payment_pkh)
}

pub fn reference_token_address() -> address.Address {
  address.from_verification_key(ref_token_pkh)
}

pub fn fee_address() -> address.Address {
  address.from_verification_key(fee_pkh)
}

pub fn script_address() -> address.Address {
  address.from_script(script_hash)
}

pub const asset_444_test: ByteArray = #"001bc28074657374"
pub const asset_444_test1: ByteArray = #"001bc2807465737431"
pub const asset_444_test2: ByteArray = #"001bc2807465737432"
pub const asset_100_test: ByteArray = #"000643b074657374"
pub const asset_100_test1: ByteArray = #"000643b07465737431"
pub const asset_100_test2: ByteArray = #"000643b07465737432"

pub const tx_hash_1: transaction.TransactionId =
  #"0101010101010101010101010101010101010101010101010101010101010101"
pub const tx_hash_2: transaction.TransactionId =
  #"0202020202020202020202020202020202020202020202020202020202020202"
pub const tx_hash_3: transaction.TransactionId =
  #"0303030303030303030303030303030303030303030303030303030303030303"

pub fn out_ref(tx_hash: transaction.TransactionId, index: Int) -> transaction.OutputReference {
  transaction.OutputReference { transaction_id: tx_hash, output_index: index }
}

pub fn base_discount_rules() -> List<types.DiscountRule> {
  let policy_prefix =
    bytearray.concat(
      #"00000000000000000000000000000000000000000000000000000002",
      #"74657374",
    )
  [
    types.DiscountRule {
      policy_prefix,
      min_quantity: 1,
      discounted_price: 35_000_000,
    },
    types.DiscountRule {
      policy_prefix,
      min_quantity: 2,
      discounted_price: 30_000_000,
    },
    types.DiscountRule {
      policy_prefix,
      min_quantity: 3,
      discounted_price: 25_000_000,
    },
    types.DiscountRule {
      policy_prefix,
      min_quantity: 4,
      discounted_price: 0,
    },
  ]
}

pub fn base_asset(valid_until: Int) -> types.MintAsset {
  types.MintAsset {
    name: asset_444_test2,
    utxo: types.Utxo { hash: tx_hash_1, index: 0 },
    price: 40_000_000,
    valid_until,
    discounts: base_discount_rules(),
  }
}

pub fn plain_asset(name: ByteArray, price: Int) -> types.MintAsset {
  types.MintAsset {
    name,
    utxo: types.Utxo { hash: tx_hash_1, index: 0 },
    price,
    valid_until: 0,
    discounts: [],
  }
}

pub fn proof_for_asset(asset: types.MintAsset) -> types.AssetProof {
  types.AssetProof { name: asset.name, proof: [] }
}

pub fn assets_root_with_asset(asset: types.MintAsset) -> ByteArray {
  assets_root_with_names([asset.name])
}

pub fn assets_root_with_names(names: List<ByteArray>) -> ByteArray {
  list.foldl(
    names,
    mpf.empty,
    fn(name, acc) { mpf.insert(acc, name, common.mpf_asset_marker(), []) },
  )
    |> mpf.root
}

pub fn base_settings(
  root: ByteArray,
  assets_list: List<types.MintAsset>,
) -> types.MintSettings {
  types.MintSettings {
    payment_address: payment_address(),
    reference_token_address: reference_token_address(),
    mint_governor: mint_governor_hash,
    editing_governor: editing_governor_hash,
    assets: assets_list,
    assets_root_hash: root,
    details: None,
  }
}

pub fn base_config() -> types.MintConfig {
  types.MintConfig {
    fee_address: fee_address(),
    fee_schedule: [[0, 0], [10_000_000, 1_000_000], [40_000_000, 2_000_000], [80_000_000, 3_000_000]],
  }
}

pub fn input(
  tx_hash: transaction.TransactionId,
  index: Int,
  address_value: address.Address,
  value: assets.Value,
  datum: transaction.Datum,
) -> transaction.Input {
  transaction.Input {
    output_reference: out_ref(tx_hash, index),
    output: transaction.Output {
      address: address_value,
      value,
      datum,
      reference_script: None,
    },
  }
}

pub fn settings_ref_input(settings: types.MintSettings) -> transaction.Input {
  input(
    tx_hash_2,
    0,
    owner_address(),
    assets.from_lovelace(5_000_000)
      |> assets.add(
          constants.handle_policy,
          constants.settings_handle_asset_name(settings_handle_name),
          1,
        ),
    transaction.InlineDatum(settings),
  )
}

pub fn settings_ref_input_script_owner(
  settings: types.MintSettings,
) -> transaction.Input {
  input(
    tx_hash_2,
    0,
    script_address(),
    assets.from_lovelace(5_000_000)
      |> assets.add(
          constants.handle_policy,
          constants.settings_handle_asset_name(settings_handle_name),
          1,
        ),
    transaction.InlineDatum(settings),
  )
}

pub fn config_ref_input(config: types.MintConfig) -> transaction.Input {
  input(
    tx_hash_3,
    0,
    owner_address(),
    assets.from_lovelace(5_000_000)
      |> assets.add(constants.handle_policy, constants.config_handle_asset_name(), 1),
    transaction.InlineDatum(config),
  )
}

pub fn settings_output(settings: types.MintSettings) -> transaction.Output {
  transaction.Output {
    address: owner_address(),
    value: assets.from_lovelace(5_000_000)
      |> assets.add(
          constants.handle_policy,
          constants.settings_handle_asset_name(settings_handle_name),
          1,
        ),
    datum: transaction.InlineDatum(settings),
    reference_script: None,
  }
}

pub fn output_with_asset(
  addr: address.Address,
  name: ByteArray,
  qty: Int,
  lovelace: Int,
) -> transaction.Output {
  transaction.Output {
    address: addr,
    value: assets.from_lovelace(lovelace) |> assets.add(policy_id, name, qty),
    datum: transaction.NoDatum,
    reference_script: None,
  }
}

pub fn payment_output(amount: Int) -> transaction.Output {
  transaction.Output {
    address: payment_address(),
    value: assets.from_lovelace(amount),
    datum: transaction.NoDatum,
    reference_script: None,
  }
}

pub fn fee_output(amount: Int) -> transaction.Output {
  transaction.Output {
    address: fee_address(),
    value: assets.from_lovelace(amount),
    datum: transaction.NoDatum,
    reference_script: None,
  }
}

pub fn default_validity_range() -> transaction.ValidityRange {
  interval.between(1_000, 1_000 + 10 * 60 * 1000)
}

pub fn tx(
  inputs: List<transaction.Input>,
  reference_inputs: List<transaction.Input>,
  outputs: List<transaction.Output>,
  mint_value: assets.Value,
  signers: List<ByteArray>,
  validity_range: transaction.ValidityRange,
) -> transaction.Transaction {
  transaction.Transaction {
    inputs,
    reference_inputs,
    outputs,
    fee: 0,
    mint: mint_value,
    certificates: [],
    withdrawals: [],
    validity_range,
    extra_signatories: signers,
    redeemers: [],
    datums: dict.empty,
    id: #"0000000000000000000000000000000000000000000000000000000000000000",
    votes: [],
    proposal_procedures: [],
    current_treasury_amount: None,
    treasury_donation: None,
  }
}

pub fn observer_withdrawal(
  script_hash: ByteArray,
  amount: Int,
) -> Pairs<address.Credential, Int> {
  expect bytearray.length(script_hash) == 28
  let script_credential: assets.PolicyId = script_hash
  [Pair(address.Script(script_credential), amount)]
}

pub fn with_withdrawals(
  tx: transaction.Transaction,
  withdrawals: Pairs<address.Credential, Int>,
) -> transaction.Transaction {
  let transaction.Transaction {
    inputs,
    reference_inputs,
    outputs,
    fee,
    mint,
    certificates,
    validity_range,
    extra_signatories,
    redeemers,
    datums,
    id,
    votes,
    proposal_procedures,
    current_treasury_amount,
    treasury_donation,
    ..
  } = tx

  transaction.Transaction {
    inputs,
    reference_inputs,
    outputs,
    fee,
    mint,
    certificates,
    withdrawals,
    validity_range,
    extra_signatories,
    redeemers,
    datums,
    id,
    votes,
    proposal_procedures,
    current_treasury_amount,
    treasury_donation,
  }
}

pub fn mint_value(assets_list: List<(ByteArray, Int)>) -> assets.Value {
  list.foldl(
    assets_list,
    assets.zero,
    fn(entry, acc) { assets.add(acc, policy_id, entry.1st, entry.2nd) },
  )
}
