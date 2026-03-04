use cardano/address.{Credential}
use cardano/assets.{PolicyId}
use cardano/transaction.{Transaction}
use cip_68_444/minting
use cip_68_444/types

validator cip_68_444_minting_observer(
  settings_handle_name: ByteArray,
  policy_id: PolicyId,
) {
  withdraw(
    redeemer: types.MintRedeemer,
    _account: Credential,
    tx: Transaction,
  ) {
    minting.validate(redeemer, settings_handle_name, policy_id, tx)
  }
}
