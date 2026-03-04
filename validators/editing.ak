use cardano/transaction.{OutputReference, Transaction}
use cip_68_444/editing_proxy

validator cip_68_444_editing(
  settings_handle_name: ByteArray,
  _minting_policy_id: ByteArray,
) {
  spend(
    _datum_opt: Option<Data>,
    _redeemer: Data,
    _own_ref: OutputReference,
    tx: Transaction,
  ) {
    editing_proxy.validate(settings_handle_name, tx)
  }
}
