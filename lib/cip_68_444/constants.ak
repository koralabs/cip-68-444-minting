use aiken/primitive/bytearray
use cardano/assets.{PolicyId}

pub const handle_policy: PolicyId =
  #"f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a"

pub const lbl_444: ByteArray = #"001bc280"
pub const lbl_222: ByteArray = #"000de140"
pub const lbl_100: ByteArray = #"000643b0"

pub fn settings_handle_asset_name(settings_handle_name: ByteArray) -> ByteArray {
  bytearray.concat(lbl_222, settings_handle_name)
}

pub fn config_handle_asset_name() -> ByteArray {
  bytearray.concat(lbl_222, "mint_config_444")
}
