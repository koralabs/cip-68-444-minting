import fs from "node:fs/promises";

import YAML from "yaml";

const OBSERVED_ONLY_FIELDS = new Set([
  "current_settings_utxo_ref",
  "observed_at",
  "last_deployed_tx_hash",
]);
const ALLOWED_NETWORKS = new Set(["preview", "preprod", "mainnet"]);

export interface DesiredDeploymentState {
  schemaVersion: 2;
  network: "preview" | "preprod" | "mainnet";
  contractSlug: "cip-68-444-config";
  assignedHandles: {
    settings: string[];
    scripts: string[];
  };
  ignoredSettings: string[];
  settings: {
    type: "cip_68_444_config";
    values: {
      mint_config_444: {
        fee_address: string;
        fee_schedule: number[][];
      };
    };
  };
}

export const loadDesiredDeploymentState = async (
  path: string
): Promise<DesiredDeploymentState> => {
  const raw = await fs.readFile(path, "utf8");
  return parseDesiredDeploymentState(raw, path);
};

export const parseDesiredDeploymentState = (
  raw: string,
  sourceLabel = "desired deployment state"
): DesiredDeploymentState => {
  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (error) {
    throw new Error(
      `${sourceLabel} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${sourceLabel} must be a YAML object`);
  }

  const value = parsed as Record<string, unknown>;
  const observedOnlyField = Object.keys(value).find((key) => OBSERVED_ONLY_FIELDS.has(key));
  if (observedOnlyField) {
    throw new Error(`${sourceLabel} must not include observed-only field \`${observedOnlyField}\``);
  }

  const schemaVersion = requireNumber(value, "schema_version", sourceLabel);
  if (schemaVersion !== 2) {
    throw new Error(`${sourceLabel} schema_version must equal 2`);
  }

  const network = requireString(value, "network", sourceLabel).toLowerCase();
  if (!ALLOWED_NETWORKS.has(network)) {
    throw new Error(`${sourceLabel} network must be one of preview, preprod, mainnet`);
  }

  const contractSlug = requireString(value, "contract_slug", sourceLabel);
  if (contractSlug !== "cip-68-444-config") {
    throw new Error(`${sourceLabel} contract_slug must be cip-68-444-config`);
  }

  const assignedHandles = requireObject(value, "assigned_handles", sourceLabel);
  const settings = requireObject(value, "settings", sourceLabel);
  const settingsType = requireString(settings, "type", `${sourceLabel}.settings`);
  if (settingsType !== "cip_68_444_config") {
    throw new Error(`${sourceLabel}.settings.type must be cip_68_444_config`);
  }
  const settingsValues = parseSettingsValues(
    requireObject(settings, "values", `${sourceLabel}.settings`),
    `${sourceLabel}.settings.values`
  );

  return {
    schemaVersion: 2,
    network: network as "preview" | "preprod" | "mainnet",
    contractSlug: "cip-68-444-config",
    assignedHandles: {
      settings: requireStringArrayAllowEmpty(assignedHandles, "settings", `${sourceLabel}.assigned_handles`),
      scripts: requireStringArrayAllowEmpty(assignedHandles, "scripts", `${sourceLabel}.assigned_handles`),
    },
    ignoredSettings: requireStringArrayAllowEmpty(value, "ignored_settings", sourceLabel),
    settings: {
      type: "cip_68_444_config",
      values: settingsValues,
    },
  };
};

const parseSettingsValues = (value: Record<string, unknown>, sourceLabel: string) => ({
  mint_config_444: parseMintConfig(
    requireObject(value, "mint_config_444", sourceLabel),
    `${sourceLabel}.mint_config_444`
  ),
});

const parseMintConfig = (value: Record<string, unknown>, sourceLabel: string) => ({
  fee_address: requireString(value, "fee_address", sourceLabel),
  fee_schedule: requireNumberMatrix(value, "fee_schedule", sourceLabel),
});

const requireObject = (
  value: Record<string, unknown>,
  key: string,
  sourceLabel: string
): Record<string, unknown> => {
  const resolved = value[key];
  if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) {
    throw new Error(`${sourceLabel} must include object field \`${key}\``);
  }
  return resolved as Record<string, unknown>;
};

const requireString = (
  value: Record<string, unknown>,
  key: string,
  sourceLabel: string
): string => {
  const resolved = value[key];
  if (typeof resolved !== "string" || resolved.trim() === "") {
    throw new Error(`${sourceLabel} must include string field \`${key}\``);
  }
  return resolved.trim();
};

const requireNumber = (
  value: Record<string, unknown>,
  key: string,
  sourceLabel: string
): number => {
  const resolved = value[key];
  if (typeof resolved !== "number" || Number.isNaN(resolved)) {
    throw new Error(`${sourceLabel} must include numeric field \`${key}\``);
  }
  return resolved;
};

const requireStringArrayAllowEmpty = (
  value: Record<string, unknown>,
  key: string,
  sourceLabel: string
): string[] => {
  const resolved = value[key];
  if (!Array.isArray(resolved)) {
    throw new Error(`${sourceLabel} must include array field \`${key}\``);
  }
  return resolved.map((item) => {
    if (typeof item !== "string" || item.trim() === "") {
      throw new Error(`${sourceLabel} must include string array field \`${key}\``);
    }
    return item.trim();
  });
};

const requireNumberMatrix = (
  value: Record<string, unknown>,
  key: string,
  sourceLabel: string
): number[][] => {
  const resolved = value[key];
  if (!Array.isArray(resolved)) {
    throw new Error(`${sourceLabel} must include array field \`${key}\``);
  }
  return resolved.map((row, index) => {
    if (!Array.isArray(row) || row.some((item) => typeof item !== "number" || Number.isNaN(item))) {
      throw new Error(`${sourceLabel}.${key}[${index}] must be an array of numbers`);
    }
    return row as number[];
  });
};
