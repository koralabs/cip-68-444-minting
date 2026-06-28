import test from "node:test";
import assert from "node:assert/strict";

import { buildDeploymentPlan, fetchLiveSettingsState } from "../src/deploymentPlan.ts";
import type { DesiredDeploymentState } from "../src/deploymentState.ts";

const desiredState: DesiredDeploymentState = {
  schemaVersion: 2,
  network: "preview",
  contractSlug: "cip-68-444-config",
  assignedHandles: {
    settings: ["mint_config_444"],
    scripts: [],
  },
  ignoredSettings: [],
  settings: {
    type: "cip_68_444_config",
    values: {
      mint_config_444: {
        fee_address: "addr_test1xqv4hh3aat9kzwm7n6mzszc5md8r20j8t6tdr8el0f0z6eset00rm6ktvyaha84k9q93fk6wx5lywh5k6x0n77j794nqp4vpze",
        fee_schedule: [
          [0, 0],
          [11000000, 2000000],
          [35000000, 3000000],
        ],
      },
    },
  },
};

test("treats missing live datum as manual drift instead of failing", async () => {
  const live = await fetchLiveSettingsState({
    network: "preview",
    userAgent: "codex-test",
    fetchFn: (async (url: string | URL) => {
      const target = String(url);
      if (target.includes("/handles/mint_config_444/utxo")) {
        return new Response(JSON.stringify({ datum: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ utxo: "tx#0" }), { status: 200 });
    }) as typeof fetch,
  });

  assert.deepEqual(live, {
    currentSettingsUtxoRef: "tx#0",
    hasDatum: false,
    values: null,
  });
});

test("returns empty live state when the config handle does not exist", async () => {
  const calls: Array<{ url: string; userAgent: string | null }> = [];
  const live = await fetchLiveSettingsState({
    network: "preprod",
    userAgent: "codex-test",
    fetchFn: (async (url: string | URL, init?: RequestInit) => {
      calls.push({
        url: String(url),
        userAgent: new Headers(init?.headers).get("User-Agent"),
      });
      return new Response(JSON.stringify({}), { status: 404 });
    }) as typeof fetch,
  });

  assert.deepEqual(live, {
    currentSettingsUtxoRef: null,
    hasDatum: false,
    values: null,
  });
  assert.deepEqual(calls, [{
    url: "https://preprod.api.handle.me/handles/mint_config_444",
    userAgent: "codex-test",
  }]);
});

test("throws when the Handles API handle lookup fails", async () => {
  await assert.rejects(
    fetchLiveSettingsState({
      network: "mainnet",
      userAgent: "codex-test",
      fetchFn: (async () => new Response(JSON.stringify({}), { status: 502 })) as typeof fetch,
    }),
    /failed to load handle mint_config_444: HTTP 502/
  );
});

test("throws when decoded datum JSON is not the settings tuple", async () => {
  let decodedDatum = false;
  await assert.rejects(
    fetchLiveSettingsState({
      network: "preview",
      userAgent: "codex-test",
      fetchFn: (async (url: string | URL, init?: RequestInit) => {
        const target = String(url);
        if (target.includes("/handles/mint_config_444/utxo")) {
          return new Response(JSON.stringify({ datum: "deadbeef" }), { status: 200 });
        }
        if (target.includes("/datum?from=plutus_data_cbor&to=json&numeric_keys=true")) {
          decodedDatum = true;
          assert.equal(init?.method, "POST");
          assert.equal(init?.body, JSON.stringify({ cbor: "deadbeef" }));
          return new Response(JSON.stringify(["not-a-bech32-address", "not-a-fee-schedule"]), { status: 200 });
        }
        return new Response(JSON.stringify({ utxo: "tx#1" }), { status: 200 });
      }) as typeof fetch,
    }),
    /decoded config datum has invalid top-level fields/
  );
  assert.equal(decodedDatum, true);
});

test("decodes the global mint_config_444 datum from the handle UTxO payload", async () => {
  const live = await fetchLiveSettingsState({
    network: "preview",
    userAgent: "codex-test",
    fetchFn: (async (url: string | URL, init?: RequestInit) => {
      const target = String(url);
      if (target.includes("/handles/mint_config_444/utxo")) {
        return new Response(JSON.stringify({ datum: "deadbeef" }), { status: 200 });
      }
      if (target.includes("/datum?from=plutus_data_cbor&to=json&numeric_keys=true")) {
        assert.equal(init?.method, "POST");
        assert.equal(init?.body, JSON.stringify({ cbor: "deadbeef" }));
        return new Response(JSON.stringify([
          "0x30195bde3deacb613b7e9eb6280b14db4e353e475e96d19f3f7a5e2d66195bde3deacb613b7e9eb6280b14db4e353e475e96d19f3f7a5e2d66",
          [[0, 0], [11000000, 2000000]],
        ]), { status: 200 });
      }
      return new Response(JSON.stringify({ utxo: "tx#1" }), { status: 200 });
    }) as typeof fetch,
  });

  assert.deepEqual(live.values, {
    mint_config_444: {
      fee_address: "addr_test1xqv4hh3aat9kzwm7n6mzszc5md8r20j8t6tdr8el0f0z6eset00rm6ktvyaha84k9q93fk6wx5lywh5k6x0n77j794nqp4vpze",
      fee_schedule: [[0, 0], [11000000, 2000000]],
    },
  });
});

test("builds settings-only summary entries for the global config handle", () => {
  const plan = buildDeploymentPlan({
    desired: desiredState,
    live: {
      currentSettingsUtxoRef: "tx#0",
      hasDatum: false,
      values: null,
    },
  });

  assert.equal(plan.summaryJson.contracts[0].contract_slug, "cip-68-444-config");
  assert.deepEqual(plan.summaryJson.contracts[0].assigned_handles, {
    settings: ["mint_config_444"],
    scripts: [],
  });
  assert.equal(plan.summaryJson.contracts[0].drift_type, "settings_only");
  assert.match(plan.summaryMarkdown, /mint_config_444/);
});

test("builds a no-change plan when live settings match desired settings", () => {
  const plan = buildDeploymentPlan({
    desired: desiredState,
    live: {
      currentSettingsUtxoRef: "tx#0",
      hasDatum: true,
      values: desiredState.settings.values,
    },
  });

  assert.equal(plan.summaryJson.contracts[0].drift_type, "no_change");
  assert.deepEqual(plan.summaryJson.contracts[0].settings.diff_rows, []);
  assert.match(plan.summaryMarkdown, /No settings changes/);
});
