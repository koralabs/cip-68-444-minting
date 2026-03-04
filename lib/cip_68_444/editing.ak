use aiken/collection/list
use aiken/primitive/bytearray
use cardano/assets
use cardano/transaction
use cip_68_444/common
use cip_68_444/types

pub fn validate(
  redeemer: types.EditRedeemer,
  settings_handle_name: ByteArray,
  minting_policy_id: ByteArray,
  tx: transaction.Transaction,
) -> Bool {
  let (settings, signed_by_owner) = common.load_settings(tx, settings_handle_name)

  when redeemer is {
    types.UpdateReferenceToken { asset } -> {
      expect bytearray.length(minting_policy_id) == 28
      let policy_id: assets.PolicyId = minting_policy_id

      let token_output_opt =
        list.find(
          tx.outputs,
          fn(output) { assets.quantity_of(output.value, policy_id, asset) >= 1 },
        )
      expect Some(token_output) = token_output_opt

      expect token_output.address == settings.reference_token_address
      expect signed_by_owner

      True
    }
    types.Invalid -> False
  }
}
