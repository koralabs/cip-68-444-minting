use aiken/collection/dict
use aiken/collection/list
use aiken/primitive/bytearray
use cardano/assets
use cardano/transaction
use cip_68_444/common
use cip_68_444/constants
use cip_68_444/types

pub fn validate(
  redeemer: types.MintRedeemer,
  settings_handle_name: ByteArray,
  policy_id: assets.PolicyId,
  tx: transaction.Transaction,
) -> Bool {
  let (settings, signed_by_owner) = common.load_settings(tx, settings_handle_name)
  let minted_assets = assets.tokens(tx.mint, policy_id)
  expect !dict.is_empty(minted_assets)

  when redeemer is {
    types.Mint { asset_proofs } -> {
      let config =
        if has_lbl_444(dict.to_pairs(minted_assets)) {
          common.load_config(tx)
        } else {
          types.MintConfig {
            fee_address: settings.payment_address,
            fee_schedule: [[0, 0]],
          }
        }

      let total =
        accumulate_mint_costs(
          dict.to_pairs(minted_assets),
          signed_by_owner,
          settings,
          config,
          asset_proofs,
          policy_id,
          tx,
          types.MintCost { payment: 0, fee: 0 },
        )

      expect
        total.payment <= 0 || list.any(
          tx.outputs,
          fn(output) {
            output.address == settings.payment_address && assets.lovelace_of(
              output.value,
            ) >= total.payment
          },
        )

      expect
        total.fee <= 0 || list.any(
          tx.outputs,
          fn(output) {
            output.address == config.fee_address && assets.lovelace_of(
              output.value,
            ) >= total.fee
          },
        )

      True
    }
    types.Burn -> {
      let minted_pairs = dict.to_pairs(minted_assets)

      expect
        list.all(
          minted_pairs,
          fn(entry) {
            bytearray.starts_with(entry.1st, constants.lbl_100) && entry.2nd < 0
          },
        )

      expect burn_keeps_reference_token(minted_pairs, tx.inputs, policy_id)
      True
    }
  }
}

fn has_lbl_444(entries: Pairs<ByteArray, Int>) -> Bool {
  list.any(entries, fn(entry) { bytearray.starts_with(entry.1st, constants.lbl_444) })
}

fn accumulate_mint_costs(
  minted_entries: Pairs<ByteArray, Int>,
  signed_by_owner: Bool,
  settings: types.MintSettings,
  config: types.MintConfig,
  proofs: List<types.AssetProof>,
  policy_id: assets.PolicyId,
  tx: transaction.Transaction,
  acc: types.MintCost,
) -> types.MintCost {
  when minted_entries is {
    [] -> acc
    [entry, ..rest_entries] -> {
      let asset_name = entry.1st
      let amount = entry.2nd

      if bytearray.starts_with(asset_name, constants.lbl_444) {
        let minted_cost =
          common.get_mint_cost(asset_name, settings, config, proofs, tx)

        let next_acc =
          types.MintCost {
            payment: acc.payment + (if signed_by_owner { 0 } else { minted_cost.payment }) * amount,
            fee: acc.fee + minted_cost.fee * amount,
          }

        accumulate_mint_costs(
          rest_entries,
          signed_by_owner,
          settings,
          config,
          proofs,
          policy_id,
          tx,
          next_acc,
        )
      } else {
        expect list.length(common.settings_assets_for_name(asset_name, settings.assets)) <= 1

        if bytearray.starts_with(asset_name, constants.lbl_100) {
          let matches = common.settings_assets_for_suffix(asset_name, settings.assets)
          expect list.length(matches) == 1
          expect Some(asset_match) = list.head(matches)

          expect
            list.any(
              tx.inputs,
              fn(input) {
                input.output_reference.transaction_id == asset_match.utxo.hash && input.output_reference.output_index == asset_match.utxo.index
              },
            )

          expect signed_by_owner

          let token_output =
            list.find(
              tx.outputs,
              fn(output) {
                assets.quantity_of(output.value, policy_id, asset_name) >= 1
              },
            )
          expect Some(reference_output) = token_output
          expect reference_output.address == settings.reference_token_address
          expect amount == 1

          accumulate_mint_costs(
            rest_entries,
            signed_by_owner,
            settings,
            config,
            proofs,
            policy_id,
            tx,
            acc,
          )
        } else if asset_name == "" {
          expect signed_by_owner
          expect list.length(settings.assets) == 0

          accumulate_mint_costs(
            rest_entries,
            signed_by_owner,
            settings,
            config,
            proofs,
            policy_id,
            tx,
            acc,
          )
        } else {
          fail
        }
      }
    }
  }
}

fn burn_keeps_reference_token(
  minted_pairs: Pairs<ByteArray, Int>,
  inputs: List<transaction.Input>,
  policy_id: assets.PolicyId,
) -> Bool {
  when minted_pairs is {
    [] -> True
    [entry, ..rest] -> {
      let asset_name = entry.1st
      let amount = entry.2nd
      let total_input =
        list.foldl(
          inputs,
          0,
          fn(input, total) {
            total + assets.quantity_of(input.output.value, policy_id, asset_name)
          },
        )
      expect total_input + amount > 0
      burn_keeps_reference_token(rest, inputs, policy_id)
    }
  }
}
