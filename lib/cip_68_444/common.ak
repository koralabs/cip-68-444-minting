use aiken/collection/dict
use aiken/collection/list
use aiken/interval
use aiken/merkle_patricia_forestry as mpf
use aiken/primitive/bytearray
use aiken/primitive/int
use cardano/address
use cardano/assets
use cardano/transaction
use cip_68_444/constants
use cip_68_444/types

pub fn load_config(tx: transaction.Transaction) -> types.MintConfig {
  let config_asset_name = constants.config_handle_asset_name()
  let config_input_opt =
    list.find(
      tx.reference_inputs,
      fn(input) {
        assets.quantity_of(
          input.output.value,
          constants.handle_policy,
          config_asset_name,
        ) == 1
      },
    )
  expect Some(config_input) = config_input_opt
  let config_data = inline_datum(config_input.output)
  expect config: types.MintConfig = config_data
  config
}

pub fn load_settings(
  tx: transaction.Transaction,
  settings_handle_name: ByteArray,
) -> (types.MintSettings, Bool) {
  let settings_asset_name = constants.settings_handle_asset_name(settings_handle_name)

  let settings_input_ref_opt =
    list.find(
      tx.reference_inputs,
      fn(input) {
        assets.quantity_of(
          input.output.value,
          constants.handle_policy,
          settings_asset_name,
        ) == 1
      },
    )
  let settings_output_opt =
    list.find(
      tx.outputs,
      fn(output) {
        assets.quantity_of(
          output.value,
          constants.handle_policy,
          settings_asset_name,
        ) == 1
      },
    )

  expect settings_input_ref_opt != None || settings_output_opt != None

  when settings_output_opt is {
    Some(output) -> {
      let settings_data = inline_datum(output)
      expect settings: types.MintSettings = settings_data
      (settings, True)
    }
    None -> {
      expect Some(settings_input_ref) = settings_input_ref_opt
      let signed =
        when settings_input_ref.output.address.payment_credential is {
          address.VerificationKey(hash) ->
            list.any(tx.extra_signatories, fn(sig) { sig == hash })
          address.Script(_) -> fail
        }
      let settings_data = inline_datum(settings_input_ref.output)
      expect settings: types.MintSettings = settings_data
      (settings, signed)
    }
  }
}

pub fn is_withdrawal_script_executed(
  tx: transaction.Transaction,
  script_hash: ByteArray,
) -> Bool {
  expect bytearray.length(script_hash) == 28
  let withdrawal_script: assets.PolicyId = script_hash
  list.any(
    tx.withdrawals,
    fn(entry) { entry.1st == address.Script(withdrawal_script) && entry.2nd == 0 },
  )
}

pub fn get_mint_fee(payment: Int, config: types.MintConfig) -> Int {
  let winner =
    list.foldl(
      config.fee_schedule,
      None,
      fn(row, acc) {
        expect [threshold, fee, .._] = row
        if payment >= threshold {
          when acc is {
            Some((best_threshold, _)) ->
              if threshold >= best_threshold {
                Some((threshold, fee))
              } else {
                acc
              }
            None -> Some((threshold, fee))
          }
        } else {
          acc
        }
      },
    )
  expect Some((_, mint_fee)) = winner
  mint_fee
}

pub fn proofs_for_name(
  asset_name: ByteArray,
  proofs: List<types.AssetProof>,
) -> List<types.AssetProof> {
  list.filter(proofs, fn(proof) { proof.name == asset_name })
}

pub fn settings_assets_for_name(
  asset_name: ByteArray,
  settings_assets: List<types.MintAsset>,
) -> List<types.MintAsset> {
  list.filter(settings_assets, fn(asset) { asset.name == asset_name })
}

pub fn settings_assets_for_suffix(
  reference_name_100: ByteArray,
  settings_assets: List<types.MintAsset>,
) -> List<types.MintAsset> {
  let suffix_100 = bytearray.drop(reference_name_100, bytearray.length(constants.lbl_100))
  list.filter(
    settings_assets,
    fn(asset) {
      let suffix_444 =
        bytearray.drop(asset.name, bytearray.length(constants.lbl_444))
      suffix_444 == suffix_100
    },
  )
}

pub fn get_mint_cost(
  asset_name: ByteArray,
  settings: types.MintSettings,
  config: types.MintConfig,
  proofs: List<types.AssetProof>,
  tx: transaction.Transaction,
) -> types.MintCost {
  expect bytearray.starts_with(asset_name, constants.lbl_444)

  let asset_matches = settings_assets_for_name(asset_name, settings.assets)
  expect list.length(asset_matches) == 1
  expect Some(mint_asset) = list.head(asset_matches)

  let proof_matches = proofs_for_name(asset_name, proofs)
  expect list.length(proof_matches) == 1
  expect Some(asset_proof) = list.head(proof_matches)
  expect asset_proof.name == asset_name

  let assets_root = mpf.from_root(settings.assets_root_hash)
  expect
    mpf.has(
      assets_root,
      asset_name,
      mpf_asset_marker(),
      asset_proof.proof,
    )

  let discounted_price = get_discounted_price(mint_asset, tx.outputs)
  let fee = get_mint_fee(discounted_price, config)
  let mint_cost = types.MintCost { payment: discounted_price - fee, fee: fee }

  if mint_asset.valid_until > 0 {
    let start = tx_range_start(tx.validity_range)
    let end = tx_range_end(tx.validity_range)
    expect end - start <= 15 * 60 * 1000
    expect start < mint_asset.valid_until
    mint_cost
  } else {
    mint_cost
  }
}

pub fn mpf_asset_marker() -> ByteArray {
  ""
}

fn get_discounted_price(
  mint_asset: types.MintAsset,
  outputs: List<transaction.Output>,
) -> Int {
  when mint_asset.discounts is {
    [] -> mint_asset.price
    _ -> {
      let sorted =
        list.sort(
          mint_asset.discounts,
          fn(a, b) { int.compare(a.discounted_price, b.discounted_price) },
        )

      let winning_rule =
        list.find(
          sorted,
          fn(discount) {
            count_matching_tokens(outputs, discount.policy_prefix) >= discount.min_quantity
          },
        )

      when winning_rule is {
        Some(discount) -> discount.discounted_price
        None -> mint_asset.price
      }
    }
  }
}

fn count_matching_tokens(
  outputs: List<transaction.Output>,
  policy_prefix: ByteArray,
) -> Int {
  if bytearray.length(policy_prefix) <= 28 {
    0
  } else {
    let policy_id = bytearray.take(policy_prefix, 28)
    let asset_prefix = bytearray.drop(policy_prefix, 28)
    list.foldl(
      outputs,
      0,
      fn(output, total) {
        let output_total =
          dict.to_pairs(assets.tokens(output.value, policy_id))
            |> list.foldl(
                0,
                fn(entry, acc) {
                  if bytearray.starts_with(entry.1st, asset_prefix) {
                    acc + entry.2nd
                  } else {
                    acc
                  }
                },
              )
        total + output_total
      },
    )
  }
}

pub fn inline_datum(output: transaction.Output) -> Data {
  when output.datum is {
    transaction.InlineDatum(data) -> data
    _ -> fail
  }
}

pub fn tx_range_start(validity_range: transaction.ValidityRange) -> Int {
  expect interval.Finite(start) = validity_range.lower_bound.bound_type
  start
}

pub fn tx_range_end(validity_range: transaction.ValidityRange) -> Int {
  expect interval.Finite(end) = validity_range.upper_bound.bound_type
  end
}
