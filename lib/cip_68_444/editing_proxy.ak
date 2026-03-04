use cardano/transaction
use cip_68_444/common

pub fn validate(
  settings_handle_name: ByteArray,
  tx: transaction.Transaction,
) -> Bool {
  let (settings, _) = common.load_settings(tx, settings_handle_name)
  expect common.is_withdrawal_script_executed(tx, settings.editing_governor)
  True
}
