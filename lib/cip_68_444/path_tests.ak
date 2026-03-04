use aiken/interval
use aiken/merkle_patricia_forestry as mpf
use cardano/assets
use cardano/transaction
use cip_68_444/common
use cip_68_444/constants
use cip_68_444/editing
use cip_68_444/editing_proxy
use cip_68_444/minting
use cip_68_444/minting_proxy
use cip_68_444/test_helpers as h
use cip_68_444/types

fn base_asset_proof(valid_until: Int) -> types.AssetProof {
  h.base_asset(valid_until) |> h.proof_for_asset
}

fn base_settings_with(valid_until: Int, assets_count: Int) -> types.MintSettings {
  let asset = h.base_asset(valid_until)
  let settings_assets =
    if assets_count == 0 {
      []
    } else {
      [asset]
    }
  let root =
    if assets_count == 0 {
      h.assets_root_with_names([])
    } else {
      h.assets_root_with_names([asset.name])
    }
  h.base_settings(root, settings_assets)
}

fn base_mint_tx(
  mint_value: assets.Value,
  outputs: List<transaction.Output>,
  signers: List<ByteArray>,
  settings: types.MintSettings,
  config: types.MintConfig,
  include_config_ref: Bool,
  include_settings_ref: Bool,
  include_required_utxo: Bool,
  validity: transaction.ValidityRange,
) -> transaction.Transaction {
  let inputs =
    if include_required_utxo {
      [
        h.input(
          h.tx_hash_1,
          0,
          h.owner_address(),
          assets.from_lovelace(10_000_000),
          transaction.NoDatum,
        ),
      ]
    } else {
      []
    }
  let refs0 =
    if include_settings_ref {
      [h.settings_ref_input(settings)]
    } else {
      []
    }
  let refs =
    if include_config_ref {
      [h.config_ref_input(config), ..refs0]
    } else {
      refs0
    }

  h.tx(inputs, refs, outputs, mint_value, signers, validity)
}

fn base_edit_tx(
  outputs: List<transaction.Output>,
  signers: List<ByteArray>,
  settings: types.MintSettings,
  include_settings_ref: Bool,
) -> transaction.Transaction {
  let refs =
    if include_settings_ref {
      [h.settings_ref_input(settings)]
    } else {
      []
    }
  h.tx([], refs, outputs, assets.zero, signers, h.default_validity_range())
}

test m_cost_1_asset_label_guard() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let tx =
    h.tx([], [], [], assets.zero, [], h.default_validity_range())

  expect _ =
    common.get_mint_cost(
    "74657374",
    settings,
    config,
    [base_asset_proof(1_000_000_000_000)],
    tx,
  )
}

test m_mint_2_rejects_missing_policy_mint_entry() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let tx =
    base_mint_tx(
      assets.zero,
      [],
      [h.owner_pkh],
      settings,
      config,
      True,
      True,
      True,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [base_asset_proof(1_000_000_000_000)] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test e_main_7_invalid_policy_id_param_len() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_edit_tx(
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      True,
    )

  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    #"01",
    tx,
  )
}

test mint_proxy_rejects_missing_observer_withdrawal() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      assets.zero,
      [],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )

  minting_proxy.validate(h.settings_handle_name, tx)
}

test mint_proxy_accepts_zero_withdraw_from_governor() {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      assets.zero,
      [],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )
      |> h.with_withdrawals(h.observer_withdrawal(h.mint_governor_hash, 0))

  minting_proxy.validate(h.settings_handle_name, tx)
}

test mint_proxy_rejects_wrong_governor_withdrawal() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      assets.zero,
      [],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )
      |> h.with_withdrawals(h.observer_withdrawal(h.alt_governor_hash, 0))

  minting_proxy.validate(h.settings_handle_name, tx)
}

test mint_proxy_rejects_non_zero_withdrawal() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      assets.zero,
      [],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )
      |> h.with_withdrawals(h.observer_withdrawal(h.mint_governor_hash, 1))

  minting_proxy.validate(h.settings_handle_name, tx)
}

test editing_proxy_rejects_missing_observer_withdrawal() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_edit_tx(
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      True,
    )

  editing_proxy.validate(h.settings_handle_name, tx)
}

test editing_proxy_accepts_zero_withdraw_from_governor() {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_edit_tx(
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      True,
    )
      |> h.with_withdrawals(h.observer_withdrawal(h.editing_governor_hash, 0))

  editing_proxy.validate(h.settings_handle_name, tx)
}

test editing_proxy_rejects_wrong_governor_withdrawal() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_edit_tx(
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      True,
    )
      |> h.with_withdrawals(h.observer_withdrawal(h.alt_governor_hash, 0))

  editing_proxy.validate(h.settings_handle_name, tx)
}

test editing_proxy_rejects_non_zero_withdrawal() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_edit_tx(
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      True,
    )
      |> h.with_withdrawals(h.observer_withdrawal(h.editing_governor_hash, 1))

  editing_proxy.validate(h.settings_handle_name, tx)
}

test mint_baseline_approve() {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let mint_value =
    h.mint_value([(h.asset_444_test2, 1), (h.asset_100_test2, 1)])
  let outputs = [
    h.output_with_asset(h.owner_address(), h.asset_444_test2, 1, 5_000_000),
    h.output_with_asset(h.reference_token_address(), h.asset_100_test2, 1, 5_000_000),
    h.fee_output(2_000_000),
  ]
  let tx =
    base_mint_tx(
      mint_value,
      outputs,
      [h.owner_pkh],
      settings,
      config,
      True,
      True,
      True,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_unsigned_owner_requires_payment_and_fee() {
  let proof_asset = h.plain_asset(h.asset_444_test1, 10_000_000)
  let proof = h.proof_for_asset(proof_asset)
  let settings = h.base_settings(h.assets_root_with_asset(proof_asset), [proof_asset])
  let config = h.base_config()
  let mint_value = h.mint_value([(h.asset_444_test1, 1)])
  let outputs = [h.payment_output(9_000_000), h.fee_output(1_000_000)]
  let tx =
    base_mint_tx(
      mint_value,
      outputs,
      [],
      settings,
      config,
      True,
      True,
      False,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_low_payment() fail {
  let proof_asset = h.plain_asset(h.asset_444_test1, 10_000_000)
  let proof = h.proof_for_asset(proof_asset)
  let settings = h.base_settings(h.assets_root_with_asset(proof_asset), [proof_asset])
  let config = h.base_config()
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test1, 1)]),
      [h.payment_output(8_000_000), h.fee_output(1_000_000)],
      [],
      settings,
      config,
      True,
      True,
      False,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_unpaid_fee() fail {
  let proof_asset = h.plain_asset(h.asset_444_test1, 10_000_000)
  let proof = h.proof_for_asset(proof_asset)
  let settings = h.base_settings(h.assets_root_with_asset(proof_asset), [proof_asset])
  let config = h.base_config()
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test1, 1)]),
      [h.payment_output(9_000_000)],
      [],
      settings,
      config,
      True,
      True,
      False,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_100_only_default_config_path() {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test2, 1)]),
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test2, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      config,
      False,
      True,
      True,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_settings_missing() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test2, 1)]),
      [h.fee_output(2_000_000)],
      [h.owner_pkh],
      settings,
      config,
      True,
      False,
      False,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_settings_output_branch_approve() {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test2, 1)]),
      [
        h.settings_output(settings),
        h.output_with_asset(h.reference_token_address(), h.asset_100_test2, 1, 5_000_000),
      ],
      [],
      settings,
      config,
      False,
      False,
      True,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_settings_output_requires_inline_datum() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test2, 1)]),
      [
        transaction.Output {
          address: h.owner_address(),
          value: assets.from_lovelace(5_000_000)
            |> assets.add(
                constants.handle_policy,
                constants.settings_handle_asset_name(h.settings_handle_name),
                1,
              ),
          datum: transaction.NoDatum,
          reference_script: None,
        },
      ],
      [],
      settings,
      config,
      False,
      False,
      True,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_settings_output_decode_fails() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test2, 1)]),
      [
        transaction.Output {
          address: h.owner_address(),
          value: assets.from_lovelace(5_000_000)
            |> assets.add(
                constants.handle_policy,
                constants.settings_handle_asset_name(h.settings_handle_name),
                1,
              ),
          datum: transaction.InlineDatum(0),
          reference_script: None,
        },
      ],
      [],
      settings,
      config,
      False,
      False,
      True,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_settings_ref_requires_inline_datum() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings_ref_no_datum =
    h.input(
      h.tx_hash_2,
      0,
      h.owner_address(),
      assets.from_lovelace(5_000_000)
        |> assets.add(
            constants.handle_policy,
            constants.settings_handle_asset_name(h.settings_handle_name),
            1,
          ),
      transaction.NoDatum,
    )
  let tx =
    h.tx(
      [h.input(h.tx_hash_1, 0, h.owner_address(), assets.from_lovelace(1), transaction.NoDatum)],
      [settings_ref_no_datum],
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test2, 1, 5_000_000)],
      h.mint_value([(h.asset_100_test2, 1)]),
      [h.owner_pkh],
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_settings_ref_decode_fails() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings_ref_bad_datum =
    h.input(
      h.tx_hash_2,
      0,
      h.owner_address(),
      assets.from_lovelace(5_000_000)
        |> assets.add(
            constants.handle_policy,
            constants.settings_handle_asset_name(h.settings_handle_name),
            1,
          ),
      transaction.InlineDatum(0),
    )
  let tx =
    h.tx(
      [h.input(h.tx_hash_1, 0, h.owner_address(), assets.from_lovelace(1), transaction.NoDatum)],
      [settings_ref_bad_datum],
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test2, 1, 5_000_000)],
      h.mint_value([(h.asset_100_test2, 1)]),
      [h.owner_pkh],
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_settings_ref_owner_must_be_pubkey() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let tx =
    h.tx(
      [h.input(h.tx_hash_1, 0, h.owner_address(), assets.from_lovelace(1), transaction.NoDatum)],
      [h.config_ref_input(config), h.settings_ref_input_script_owner(settings)],
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test2, 1, 5_000_000)],
      h.mint_value([(h.asset_100_test2, 1)]),
      [],
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_config_missing() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test2, 1)]),
      [h.fee_output(2_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_config_requires_inline_datum() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config_ref_no_datum =
    h.input(
      h.tx_hash_3,
      0,
      h.owner_address(),
      assets.from_lovelace(5_000_000)
        |> assets.add(constants.handle_policy, constants.config_handle_asset_name(), 1),
      transaction.NoDatum,
    )
  let tx =
    h.tx(
      [],
      [config_ref_no_datum, h.settings_ref_input(settings)],
      [h.fee_output(2_000_000)],
      h.mint_value([(h.asset_444_test2, 1)]),
      [h.owner_pkh],
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_config_decode_fails() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config_ref_bad_datum =
    h.input(
      h.tx_hash_3,
      0,
      h.owner_address(),
      assets.from_lovelace(5_000_000)
        |> assets.add(constants.handle_policy, constants.config_handle_asset_name(), 1),
      transaction.InlineDatum(0),
    )
  let tx =
    h.tx(
      [],
      [config_ref_bad_datum, h.settings_ref_input(settings)],
      [h.fee_output(2_000_000)],
      h.mint_value([(h.asset_444_test2, 1)]),
      [h.owner_pkh],
      h.default_validity_range(),
    )

  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_fee_schedule_no_match() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config =
    types.MintConfig { fee_address: h.fee_address(), fee_schedule: [[50_000_000, 1_000_000]] }
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test2, 1)]),
      [h.fee_output(2_000_000)],
      [h.owner_pkh],
      settings,
      config,
      True,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_fee_schedule_malformed_row() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = types.MintConfig { fee_address: h.fee_address(), fee_schedule: [[0]] }
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test2, 1)]),
      [h.fee_output(2_000_000)],
      [h.owner_pkh],
      settings,
      config,
      True,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_asset_not_in_root_proofs() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let tx =
    base_mint_tx(
      h.mint_value([(#"001bc280ffffffff", 1)]),
      [h.fee_output(2_000_000)],
      [h.owner_pkh],
      settings,
      config,
      True,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_discount_branch_selects_best_qualifying_rule() {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let config = h.base_config()
  let discount_output =
    transaction.Output {
      address: h.owner_address(),
      value: assets.from_lovelace(2_000_000)
        |> assets.add(
            #"00000000000000000000000000000000000000000000000000000002",
            #"74657374",
            2,
          ),
      datum: transaction.NoDatum,
      reference_script: None,
    }
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test2, 1)]),
      [discount_output, h.payment_output(29_000_000), h.fee_output(1_000_000)],
      [],
      settings,
      config,
      True,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_discount_short_policy_prefix_keeps_base_price() {
  let asset =
    types.MintAsset {
      name: h.asset_444_test2,
      utxo: types.Utxo { hash: h.tx_hash_1, index: 0 },
      price: 40_000_000,
      valid_until: 1_000_000_000_000,
      discounts: [
        types.DiscountRule {
          policy_prefix: #"00000000000000000000000000000000000000000000000000000002",
          min_quantity: 1,
          discounted_price: 0,
        },
      ],
    }
  let proof = h.proof_for_asset(asset)
  let settings = h.base_settings(h.assets_root_with_asset(asset), [asset])
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test2, 1)]),
      [h.payment_output(38_000_000), h.fee_output(2_000_000)],
      [],
      settings,
      h.base_config(),
      True,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_invalid_slot_window() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test2, 1)]),
      [h.fee_output(2_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      True,
      True,
      False,
      interval.between(1_000, 1_000 + 16 * 60 * 1000),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_expired_asset() fail {
  let proof = base_asset_proof(1)
  let settings = base_settings_with(1, 1)
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test2, 1)]),
      [h.fee_output(2_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      True,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_duplicate_non_444_asset_proofs() fail {
  let duplicate_asset = h.plain_asset(h.asset_100_test, 0)
  let settings =
    h.base_settings(
      h.assets_root_with_names([duplicate_asset.name]),
      [duplicate_asset, duplicate_asset],
    )
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test, 1)]),
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      True,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_reference_suffix_without_singleton_match() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test, 1)]),
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      True,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_required_utxo_missing() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test2, 1)]),
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test2, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_missing_owner_signature_for_100() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test2, 1)]),
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test2, 1, 5_000_000)],
      [],
      settings,
      h.base_config(),
      False,
      True,
      True,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_reference_output_missing() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test2, 1)]),
      [],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      True,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_reference_output_wrong_address() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test2, 1)]),
      [h.output_with_asset(h.owner_address(), h.asset_100_test2, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      True,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_deny_reference_amount_not_one() fail {
  let proof = base_asset_proof(1_000_000_000_000)
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test2, 2)]),
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test2, 2, 5_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      True,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_royalties_requires_owner_sig() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([("", 1)]),
      [h.output_with_asset(h.owner_address(), "", 1, 5_000_000)],
      [],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_royalties_requires_zero_assets_count() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([("", 1)]),
      [h.output_with_asset(h.owner_address(), "", 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_royalties_approve_when_assets_empty() {
  let settings = base_settings_with(1_000_000_000_000, 0)
  let tx =
    base_mint_tx(
      h.mint_value([("", 1)]),
      [h.output_with_asset(h.owner_address(), "", 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test mint_invalid_non_100_non_444_label_rejected() fail {
  let settings = base_settings_with(1_000_000_000_000, 0)
  let tx =
    base_mint_tx(
      h.mint_value([("74657374", 1)]),
      [h.output_with_asset(h.owner_address(), "74657374", 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test burn_rejects_non_reference_assets() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_100_test, -1), (h.asset_444_test1, -1)]),
      [],
      [h.owner_pkh],
      settings,
      h.base_config(),
      False,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(types.Burn, h.settings_handle_name, h.policy_id, tx)
}

test burn_rejects_when_none_left() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    h.tx(
      [
        h.input(
          h.tx_hash_1,
          1,
          h.owner_address(),
          assets.from_lovelace(5_000_000)
            |> assets.add(h.policy_id, h.asset_100_test, 2)
            |> assets.add(h.policy_id, h.asset_100_test1, 2),
          transaction.NoDatum,
        ),
      ],
      [h.settings_ref_input(settings)],
      [],
      h.mint_value([(h.asset_100_test, -2), (h.asset_100_test1, -2)]),
      [h.owner_pkh],
      h.default_validity_range(),
    )
  minting.validate(types.Burn, h.settings_handle_name, h.policy_id, tx)
}

test burn_approve_when_one_remains() {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    h.tx(
      [
        h.input(
          h.tx_hash_1,
          1,
          h.owner_address(),
          assets.from_lovelace(5_000_000)
            |> assets.add(h.policy_id, h.asset_100_test, 2)
            |> assets.add(h.policy_id, h.asset_100_test1, 2),
          transaction.NoDatum,
        ),
      ],
      [h.settings_ref_input(settings)],
      [],
      h.mint_value([(h.asset_100_test, -1), (h.asset_100_test1, -1)]),
      [h.owner_pkh],
      h.default_validity_range(),
    )
  minting.validate(types.Burn, h.settings_handle_name, h.policy_id, tx)
}

test editing_happy_path() {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_edit_tx(
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      True,
    )
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_missing_owner_signature() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_edit_tx(
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [],
      settings,
      True,
    )
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_settings_missing() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_edit_tx(
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      False,
    )
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_settings_output_branch_approve() {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    h.tx(
      [],
      [],
      [
        h.settings_output(settings),
        h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000),
      ],
      assets.zero,
      [],
      h.default_validity_range(),
    )
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_settings_output_requires_inline_datum() fail {
  let tx =
    h.tx(
      [],
      [],
      [
        transaction.Output {
          address: h.owner_address(),
          value: assets.from_lovelace(5_000_000)
            |> assets.add(
                constants.handle_policy,
                constants.settings_handle_asset_name(h.settings_handle_name),
                1,
              ),
          datum: transaction.NoDatum,
          reference_script: None,
        },
        h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000),
      ],
      assets.zero,
      [],
      h.default_validity_range(),
    )
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_settings_output_decode_fails() fail {
  let tx =
    h.tx(
      [],
      [],
      [
        transaction.Output {
          address: h.owner_address(),
          value: assets.from_lovelace(5_000_000)
            |> assets.add(
                constants.handle_policy,
                constants.settings_handle_asset_name(h.settings_handle_name),
                1,
              ),
          datum: transaction.InlineDatum(0),
          reference_script: None,
        },
        h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000),
      ],
      assets.zero,
      [],
      h.default_validity_range(),
    )
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_settings_ref_owner_must_be_pubkey() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    h.tx(
      [],
      [h.settings_ref_input_script_owner(settings)],
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      assets.zero,
      [h.owner_pkh],
      h.default_validity_range(),
    )
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_settings_ref_requires_inline_datum() fail {
  let settings_ref_no_datum =
    h.input(
      h.tx_hash_2,
      0,
      h.owner_address(),
      assets.from_lovelace(5_000_000)
        |> assets.add(
            constants.handle_policy,
            constants.settings_handle_asset_name(h.settings_handle_name),
            1,
          ),
      transaction.NoDatum,
    )
  let tx =
    h.tx(
      [],
      [settings_ref_no_datum],
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      assets.zero,
      [h.owner_pkh],
      h.default_validity_range(),
    )
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_settings_ref_decode_fails() fail {
  let settings_ref_bad_datum =
    h.input(
      h.tx_hash_2,
      0,
      h.owner_address(),
      assets.from_lovelace(5_000_000)
        |> assets.add(
            constants.handle_policy,
            constants.settings_handle_asset_name(h.settings_handle_name),
            1,
          ),
      transaction.InlineDatum(0),
    )
  let tx =
    h.tx(
      [],
      [settings_ref_bad_datum],
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      assets.zero,
      [h.owner_pkh],
      h.default_validity_range(),
    )
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_reference_output_missing() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx = base_edit_tx([], [h.owner_pkh], settings, True)
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_reference_output_wrong_address() fail {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_edit_tx(
      [h.output_with_asset(h.owner_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      True,
    )
  editing.validate(
    types.UpdateReferenceToken { asset: h.asset_100_test },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}

test editing_invalid_redeemer_returns_false() {
  let settings = base_settings_with(1_000_000_000_000, 1)
  let tx =
    base_edit_tx(
      [h.output_with_asset(h.reference_token_address(), h.asset_100_test, 1, 5_000_000)],
      [h.owner_pkh],
      settings,
      True,
    )
  !editing.validate(types.Invalid, h.settings_handle_name, h.policy_id, tx)
}

test mpf_proof_mismatch_rejected() fail {
  let asset = h.base_asset(1_000_000_000_000)
  let bad_proof =
    types.AssetProof {
      name: asset.name,
      proof: [mpf.Leaf { skip: 0, key: "bad", value: "bad" }],
    }
  let settings = h.base_settings(h.assets_root_with_asset(asset), [asset])
  let tx =
    base_mint_tx(
      h.mint_value([(h.asset_444_test2, 1)]),
      [h.fee_output(2_000_000)],
      [h.owner_pkh],
      settings,
      h.base_config(),
      True,
      True,
      False,
      h.default_validity_range(),
    )
  minting.validate(
    types.Mint { asset_proofs: [bad_proof] },
    h.settings_handle_name,
    h.policy_id,
    tx,
  )
}
