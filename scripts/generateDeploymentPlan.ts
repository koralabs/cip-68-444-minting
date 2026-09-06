import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildDeploymentPlan, fetchLiveSettingsState } from '../src/deploymentPlan.js';
import { loadDesiredDeploymentState } from '../src/deploymentState.js';

interface GenerateDeploymentPlanOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
}

export const parseArgs = (argv: string[]): Record<string, string> => {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`missing value for ${current}`);
    }
    args[current.slice(2)] = next;
    index += 1;
  }
  return args;
};

export const runGenerateDeploymentPlan = async ({
  argv = process.argv.slice(2),
  env = process.env,
  fetchFn = fetch,
}: GenerateDeploymentPlanOptions = {}) => {
  const args = parseArgs(argv);
  if (!args.desired || !args['artifacts-dir']) {
    throw new Error('usage: --desired <path> --artifacts-dir <dir>');
  }

  const desired = await loadDesiredDeploymentState(args.desired);
  const userAgent = (env.KORA_USER_AGENT || 'kora-contract-deployments/1.0').trim();
  const plan = buildDeploymentPlan({
    desired,
    live: await fetchLiveSettingsState({ network: desired.network, userAgent, fetchFn }),
  });
  const artifactFiles = ['summary.json', 'summary.md', 'deployment-plan.json'];

  await fs.mkdir(args['artifacts-dir'], { recursive: true });
  for (const [name, payload] of Object.entries({
    'summary.json': JSON.stringify({
      ...plan.summaryJson,
      tx_artifact_generated: false,
      artifact_files: artifactFiles,
    }, null, 2),
    'summary.md': plan.summaryMarkdown,
    'deployment-plan.json': JSON.stringify({
      ...plan.deploymentPlanJson,
      tx_artifact_generated: false,
      artifact_files: artifactFiles,
    }, null, 2),
  })) {
    await fs.writeFile(path.join(args['artifacts-dir'], name), `${payload}\n`);
  }
};

const main = async () => {
  await runGenerateDeploymentPlan();
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
