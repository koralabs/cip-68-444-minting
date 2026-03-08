import crypto from 'node:crypto';

import type { DesiredDeploymentState } from './deploymentState.js';

const REPO_NAME = 'cip-68-444-minting';
const SETTINGS_HANDLE = 'settings';

interface LiveSettingsState {
  currentSettingsUtxoRef: string | null;
  hasDatum: boolean;
  values: DesiredDeploymentState['settings']['values'] | null;
}

const handlesApiBaseUrlForNetwork = (network: string): string => {
  if (network === 'preview') return 'https://preview.api.handle.me';
  if (network === 'preprod') return 'https://preprod.api.handle.me';
  return 'https://api.handle.me';
};

export const fetchLiveSettingsState = async ({
  network,
  userAgent,
  fetchFn = fetch,
}: {
  network: 'preview' | 'preprod' | 'mainnet';
  userAgent: string;
  fetchFn?: typeof fetch;
}): Promise<LiveSettingsState> => {
  const handleResponse = await fetchFn(
    `${handlesApiBaseUrlForNetwork(network)}/handles/${encodeURIComponent(SETTINGS_HANDLE)}`,
    { headers: { 'User-Agent': userAgent } }
  );
  if (handleResponse.status === 404) {
    return {
      currentSettingsUtxoRef: null,
      hasDatum: false,
      values: null,
    };
  }
  if (!handleResponse.ok) {
    throw new Error(`failed to load handle ${SETTINGS_HANDLE}: HTTP ${handleResponse.status}`);
  }
  const handlePayload = await handleResponse.json() as Record<string, unknown>;

  const utxoResponse = await fetchFn(
    `${handlesApiBaseUrlForNetwork(network)}/handles/${encodeURIComponent(SETTINGS_HANDLE)}/utxo`,
    { headers: { 'User-Agent': userAgent } }
  );
  if (!utxoResponse.ok) {
    throw new Error(`failed to load UTxO for ${SETTINGS_HANDLE}: HTTP ${utxoResponse.status}`);
  }
  const utxoPayload = await utxoResponse.json() as Record<string, unknown>;

  const datumResponse = await fetchFn(
    `${handlesApiBaseUrlForNetwork(network)}/handles/${encodeURIComponent(SETTINGS_HANDLE)}/datum`,
    { headers: { 'User-Agent': userAgent } }
  );
  if (datumResponse.status === 404) {
    return {
      currentSettingsUtxoRef: String(handlePayload.utxo ?? '').trim() || null,
      hasDatum: false,
      values: null,
    };
  }
  if (!datumResponse.ok) {
    throw new Error(`failed to load datum for ${SETTINGS_HANDLE}: HTTP ${datumResponse.status}`);
  }
  const datumHex = (await datumResponse.text()).trim();
  if (!datumHex) {
    return {
      currentSettingsUtxoRef: String(handlePayload.utxo ?? '').trim() || null,
      hasDatum: false,
      values: null,
    };
  }

  const values = await decodeDatumHexToSettingsValues({
    datumHex,
    network,
    userAgent,
    fetchFn,
  });

  return {
    currentSettingsUtxoRef: String(handlePayload.utxo ?? '').trim() || null,
    hasDatum: true,
    values,
  };
};

const decodeDatumHexToSettingsValues = async ({
  datumHex,
  network,
  userAgent,
  fetchFn,
}: {
  datumHex: string;
  network: 'preview' | 'preprod' | 'mainnet';
  userAgent: string;
  fetchFn: typeof fetch;
}): Promise<DesiredDeploymentState['settings']['values']> => {
  const response = await fetchFn(
    `${handlesApiBaseUrlForNetwork(network)}/datum?from=plutus_data_cbor&to=json&numeric_keys=true`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({ datum: datumHex }),
    }
  );
  if (!response.ok) {
    throw new Error(`failed to decode datum for ${SETTINGS_HANDLE}: HTTP ${response.status}`);
  }
  const payload = await response.json() as unknown;
  return parseDecodedSettingsValue(payload);
};

const parseDecodedSettingsValue = (payload: unknown): DesiredDeploymentState['settings']['values'] => {
  if (!Array.isArray(payload) || payload.length !== 3) {
    throw new Error('decoded settings datum must be a 3-item list');
  }
  const [paymentAddressHex, referenceTokenAddressHex, assetsValue] = payload;
  if (typeof paymentAddressHex !== 'string' || typeof referenceTokenAddressHex !== 'string' || !Array.isArray(assetsValue)) {
    throw new Error('decoded settings datum has invalid top-level fields');
  }
  return {
    paymentAddress: paymentAddressHex,
    referenceTokenAddress: referenceTokenAddressHex,
    assets: assetsValue.map((item, index) => parseDecodedAsset(item, `assets[${index}]`)),
  };
};

const parseDecodedAsset = (value: unknown, sourceLabel: string) => {
  if (!Array.isArray(value) || value.length !== 5) {
    throw new Error(`${sourceLabel} must be a 5-item list`);
  }
  const [assetNameHex, requiredUtxo, priceLovelace, validFrom, discounts] = value;
  if (typeof assetNameHex !== 'string') {
    throw new Error(`${sourceLabel}[0] must be a string`);
  }
  if (!Array.isArray(requiredUtxo) || requiredUtxo.length !== 2 || typeof requiredUtxo[0] !== 'string' || typeof requiredUtxo[1] !== 'number') {
    throw new Error(`${sourceLabel}[1] must be [string, number]`);
  }
  if (typeof priceLovelace !== 'number' || typeof validFrom !== 'number' || !Array.isArray(discounts)) {
    throw new Error(`${sourceLabel} has invalid numeric fields`);
  }
  return {
    assetNameHex,
    requiredUtxo: {
      txIdHex: requiredUtxo[0],
      index: requiredUtxo[1],
    },
    priceLovelace,
    validFrom,
    discounts: discounts.map((discount, index) => parseDecodedDiscount(discount, `${sourceLabel}.discounts[${index}]`)),
  };
};

const parseDecodedDiscount = (value: unknown, sourceLabel: string) => {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || !Array.isArray(value[1]) || value[1].length !== 2 || typeof value[1][1] !== 'number') {
    throw new Error(`${sourceLabel} must be [string, [number, number]]`);
  }
  return {
    assetNameHex: value[0],
    amount: value[1][1],
  };
};

export const buildDeploymentPlan = ({
  desired,
  live,
}: {
  desired: DesiredDeploymentState;
  live: LiveSettingsState;
}) => {
  const diffRows = collectDiffRows(live.values, desired.settings.values);
  if (!live.hasDatum) {
    diffRows.unshift({ path: 'missing_live_datum', current: null, desired: 'settings datum unavailable from Handles API' });
  }
  const driftType = diffRows.length > 0 ? 'settings_only' : 'no_change';
  const planId = crypto.createHash('sha256').update(JSON.stringify({
    network: desired.network,
    contract_slug: desired.contractSlug,
    current_settings_utxo_ref: live.currentSettingsUtxoRef,
    desired_values: desired.settings.values,
    diff_rows: diffRows,
  })).digest('hex');

  const expectedPostDeployState = {
    repo: REPO_NAME,
    network: desired.network,
    contract_slug: desired.contractSlug,
    settings: {
      type: desired.settings.type,
      values: desired.settings.values,
    },
  };

  const summaryJson = {
    plan_id: planId,
    repo: REPO_NAME,
    network: desired.network,
    contracts: [{
      contract_slug: desired.contractSlug,
      drift_type: driftType,
      current_settings_utxo_ref: live.currentSettingsUtxoRef,
      settings: {
        type: desired.settings.type,
        diff_rows: diffRows,
        desired_values: desired.settings.values,
      },
      expected_post_deploy_state: expectedPostDeployState,
    }],
    transaction_order: [],
  };

  const summaryMarkdown = [
    '# Contract Deployment Plan',
    '',
    `- Plan ID: \`${planId}\``,
    `- Repo: \`${REPO_NAME}\``,
    `- Network: \`${desired.network}\``,
    `- Contract: \`${desired.contractSlug}\``,
    `- Drift Type: \`${driftType}\``,
    `- Current Settings UTxO: \`${live.currentSettingsUtxoRef || ''}\``,
    '',
    '## Settings Drift',
    ...(diffRows.length > 0
      ? diffRows.map((row) => `- \`${row.path}\``)
      : ['- No settings changes.']),
    '',
    '## Transaction Order',
    '- No transaction artifact is generated for this repo yet.',
  ].join('\n');

  return {
    planId,
    summaryJson,
    summaryMarkdown,
    deploymentPlanJson: {
      plan_id: planId,
      repo: REPO_NAME,
      network: desired.network,
      contracts: [expectedPostDeployState],
      transaction_order: [],
    },
  };
};

const collectDiffRows = (
  current: DesiredDeploymentState['settings']['values'] | null,
  expected: DesiredDeploymentState['settings']['values'],
  prefix = ''
): Array<{ path: string; current: unknown; desired: unknown }> => {
  if (!current) {
    return [{ path: prefix || 'settings', current: null, desired: expected }];
  }
  const rows: Array<{ path: string; current: unknown; desired: unknown }> = [];
  walkDiff(rows, current, expected, prefix);
  return rows;
};

const walkDiff = (
  rows: Array<{ path: string; current: unknown; desired: unknown }>,
  current: unknown,
  expected: unknown,
  prefix: string
) => {
  if (Array.isArray(expected)) {
    if (JSON.stringify(current) !== JSON.stringify(expected)) {
      rows.push({ path: prefix, current, desired: expected });
    }
    return;
  }
  if (expected && typeof expected === 'object') {
    const currentRecord = current && typeof current === 'object' && !Array.isArray(current)
      ? current as Record<string, unknown>
      : {};
    for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
      walkDiff(rows, currentRecord[key], value, prefix ? `${prefix}.${key}` : key);
    }
    return;
  }
  if (current !== expected) {
    rows.push({ path: prefix, current, desired: expected });
  }
};
