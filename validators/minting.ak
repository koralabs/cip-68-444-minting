use cardano/assets.{PolicyId}
use cardano/transaction.{Transaction}
use cip_68_444/minting_proxy

validator cip_68_444_minting(settings_handle_name: ByteArray) {
  mint(_redeemer: Data, _policy_id: PolicyId, tx: Transaction) {
    minting_proxy.validate(settings_handle_name, tx)
  }
}
