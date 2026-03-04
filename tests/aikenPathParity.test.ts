import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const source = fs.readFileSync('./lib/cip_68_444/path_tests.ak', 'utf8');

const requiredTests = [
  'm_cost_1_asset_label_guard',
  'm_mint_2_rejects_missing_policy_mint_entry',
  'e_main_7_invalid_policy_id_param_len',
  'mint_proxy_rejects_missing_observer_withdrawal',
  'mint_proxy_accepts_zero_withdraw_from_governor',
  'mint_proxy_rejects_wrong_governor_withdrawal',
  'mint_proxy_rejects_non_zero_withdrawal',
  'editing_proxy_rejects_missing_observer_withdrawal',
  'editing_proxy_accepts_zero_withdraw_from_governor',
  'editing_proxy_rejects_wrong_governor_withdrawal',
  'editing_proxy_rejects_non_zero_withdrawal',
  'mint_baseline_approve',
  'mint_unsigned_owner_requires_payment_and_fee',
  'mint_deny_low_payment',
  'mint_deny_unpaid_fee',
  'mint_100_only_default_config_path',
  'mint_deny_settings_missing',
  'mint_settings_output_branch_approve',
  'mint_settings_output_requires_inline_datum',
  'mint_settings_output_decode_fails',
  'mint_settings_ref_requires_inline_datum',
  'mint_settings_ref_decode_fails',
  'mint_settings_ref_owner_must_be_pubkey',
  'mint_deny_config_missing',
  'mint_deny_config_requires_inline_datum',
  'mint_deny_config_decode_fails',
  'mint_deny_fee_schedule_no_match',
  'mint_deny_fee_schedule_malformed_row',
  'mint_deny_asset_not_in_root_proofs',
  'mint_discount_branch_selects_best_qualifying_rule',
  'mint_discount_short_policy_prefix_keeps_base_price',
  'mint_deny_invalid_slot_window',
  'mint_deny_expired_asset',
  'mint_deny_duplicate_non_444_asset_proofs',
  'mint_deny_reference_suffix_without_singleton_match',
  'mint_deny_required_utxo_missing',
  'mint_deny_missing_owner_signature_for_100',
  'mint_deny_reference_output_missing',
  'mint_deny_reference_output_wrong_address',
  'mint_deny_reference_amount_not_one',
  'mint_royalties_requires_owner_sig',
  'mint_royalties_requires_zero_assets_count',
  'mint_royalties_approve_when_assets_empty',
  'mint_invalid_non_100_non_444_label_rejected',
  'burn_rejects_non_reference_assets',
  'burn_rejects_when_none_left',
  'burn_approve_when_one_remains',
  'editing_happy_path',
  'editing_missing_owner_signature',
  'editing_settings_missing',
  'editing_settings_output_branch_approve',
  'editing_settings_output_requires_inline_datum',
  'editing_settings_output_decode_fails',
  'editing_settings_ref_owner_must_be_pubkey',
  'editing_settings_ref_requires_inline_datum',
  'editing_settings_ref_decode_fails',
  'editing_reference_output_missing',
  'editing_reference_output_wrong_address',
  'editing_invalid_redeemer_returns_false',
  'mpf_proof_mismatch_rejected'
] as const;

const discoveredTests = [
  ...source.matchAll(/^\s*test\s+([a-zA-Z0-9_]+)\s*\(/gm)
].map((match) => match[1]);

test('Aiken path tests include all required parity scenarios', () => {
  const missing = requiredTests.filter((name) => !discoveredTests.includes(name));
  const unexpected = discoveredTests.filter((name) => !requiredTests.includes(name as (typeof requiredTests)[number]));

  assert.deepEqual(
    missing,
    [],
    `Missing Aiken parity tests: ${missing.join(', ')}`
  );

  assert.deepEqual(
    unexpected,
    [],
    `Unexpected Aiken path tests (update required list intentionally): ${unexpected.join(', ')}`
  );
});

test('Aiken path tests execute successfully', () => {
  execFileSync('aiken', ['check'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });
});
