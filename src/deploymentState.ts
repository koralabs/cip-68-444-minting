import fs from 'node:fs/promises';

import YAML from 'yaml';

const OBSERVED_ONLY_FIELDS = new Set([
  'current_settings_utxo_ref',
  'observed_at',
  'last_deployed_tx_hash',
]);
const ALLOWED_NETWORKS = new Set(['preview', 'preprod', 'mainnet']);

export interface DesiredDeploymentState {
  schemaVersion: 1;
  network: 'preview' | 'preprod' | 'mainnet';
  contractSlug: 'cip-68-444-settings';
  settings: {
    type: 'cip_68_444_settings';
    values: {
      paymentAddress: string;
      referenceTokenAddress: string;
      assets: Array<{
        assetNameHex: string;
        requiredUtxo: {
          txIdHex: string;
          index: number;
        };
        priceLovelace: number;
        validFrom: number;
        discounts: Array<{
          assetNameHex: string;
          amount: number;
        }>;
      }>;
    };
  };
}

export const loadDesiredDeploymentState = async (path: string): Promise<DesiredDeploymentState> => {
  const raw = await fs.readFile(path, 'utf8');
  return parseDesiredDeploymentState(raw, path);
};

export const parseDesiredDeploymentState = (
  raw: string,
  sourceLabel = 'desired deployment state'
): DesiredDeploymentState => {
  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (error) {
    throw new Error(
      `${sourceLabel} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${sourceLabel} must be a YAML object`);
  }

  const value = parsed as Record<string, unknown>;
  const observedOnlyField = Object.keys(value).find((key) => OBSERVED_ONLY_FIELDS.has(key));
  if (observedOnlyField) {
    throw new Error(`${sourceLabel} must not include observed-only field \`${observedOnlyField}\``);
  }

  const schemaVersion = requireNumber(value, 'schema_version', sourceLabel);
  if (schemaVersion !== 1) {
    throw new Error(`${sourceLabel} schema_version must equal 1`);
  }

  const network = requireString(value, 'network', sourceLabel).toLowerCase();
  if (!ALLOWED_NETWORKS.has(network)) {
    throw new Error(`${sourceLabel} network must be one of preview, preprod, mainnet`);
  }

  const contractSlug = requireString(value, 'contract_slug', sourceLabel);
  if (contractSlug !== 'cip-68-444-settings') {
    throw new Error(`${sourceLabel} contract_slug must be cip-68-444-settings`);
  }

  const settings = requireObject(value, 'settings', sourceLabel);
  const settingsType = requireString(settings, 'type', `${sourceLabel}.settings`);
  if (settingsType !== 'cip_68_444_settings') {
    throw new Error(`${sourceLabel}.settings.type must be cip_68_444_settings`);
  }
  const settingsValues = parseSettingsValues(
    requireObject(settings, 'values', `${sourceLabel}.settings`),
    `${sourceLabel}.settings.values`
  );

  return {
    schemaVersion: 1,
    network: network as 'preview' | 'preprod' | 'mainnet',
    contractSlug: 'cip-68-444-settings',
    settings: {
      type: 'cip_68_444_settings',
      values: settingsValues,
    },
  };
};

const parseSettingsValues = (value: Record<string, unknown>, sourceLabel: string) => ({
  paymentAddress: requireString(value, 'payment_address', sourceLabel),
  referenceTokenAddress: requireString(value, 'reference_token_address', sourceLabel),
  assets: requireArray(value, 'assets', sourceLabel).map((item, index) =>
    parseAssetConfig(item, `${sourceLabel}.assets[${index}]`)
  ),
});

const parseAssetConfig = (value: unknown, sourceLabel: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${sourceLabel} must be an object`);
  }
  const record = value as Record<string, unknown>;
  return {
    assetNameHex: requireString(record, 'asset_name_hex', sourceLabel),
    requiredUtxo: parseRequiredUtxo(
      requireObject(record, 'required_utxo', sourceLabel),
      `${sourceLabel}.required_utxo`
    ),
    priceLovelace: requireNumber(record, 'price_lovelace', sourceLabel),
    validFrom: requireNumber(record, 'valid_from', sourceLabel),
    discounts: requireArray(record, 'discounts', sourceLabel).map((item, index) =>
      parseDiscount(item, `${sourceLabel}.discounts[${index}]`)
    ),
  };
};

const parseRequiredUtxo = (value: Record<string, unknown>, sourceLabel: string) => ({
  txIdHex: requireString(value, 'tx_id_hex', sourceLabel),
  index: requireNumber(value, 'index', sourceLabel),
});

const parseDiscount = (value: unknown, sourceLabel: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${sourceLabel} must be an object`);
  }
  const record = value as Record<string, unknown>;
  return {
    assetNameHex: requireString(record, 'asset_name_hex', sourceLabel),
    amount: requireNumber(record, 'amount', sourceLabel),
  };
};

const requireArray = (value: Record<string, unknown>, key: string, sourceLabel: string): unknown[] => {
  const resolved = value[key];
  if (!Array.isArray(resolved)) {
    throw new Error(`${sourceLabel} must include array field \`${key}\``);
  }
  return resolved;
};

const requireObject = (value: Record<string, unknown>, key: string, sourceLabel: string): Record<string, unknown> => {
  const resolved = value[key];
  if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) {
    throw new Error(`${sourceLabel} must include object field \`${key}\``);
  }
  return resolved as Record<string, unknown>;
};

const requireString = (value: Record<string, unknown>, key: string, sourceLabel: string): string => {
  const resolved = value[key];
  if (typeof resolved !== 'string' || resolved.trim() === '') {
    throw new Error(`${sourceLabel} must include string field \`${key}\``);
  }
  return resolved.trim();
};

const requireNumber = (value: Record<string, unknown>, key: string, sourceLabel: string): number => {
  const resolved = value[key];
  if (typeof resolved !== 'number' || Number.isNaN(resolved)) {
    throw new Error(`${sourceLabel} must include numeric field \`${key}\``);
  }
  return resolved;
};
