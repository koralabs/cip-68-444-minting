use cardano/address.{Credential}
use cardano/transaction.{Transaction}
use cip_68_444/editing
use cip_68_444/types

validator cip_68_444_editing_observer(
  settings_handle_name: ByteArray,
  minting_policy_id: ByteArray,
) {
  withdraw(
    redeemer: types.EditRedeemer,
    _account: Credential,
    tx: Transaction,
  ) {
    editing.validate(redeemer, settings_handle_name, minting_policy_id, tx)
  }
}
