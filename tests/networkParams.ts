import * as helios from '@hyperionbt/helios';

const MAINNET_NETWORK_PARAMS_URL = 'https://d1t0d7c2nekuk0.cloudfront.net/mainnet.json';

export const loadNetworkParams = async ({
  url = MAINNET_NETWORK_PARAMS_URL,
  fetchFn = fetch,
  fallbackRawParams = helios.rawNetworkEmulatorParams,
}: {
  url?: string;
  fetchFn?: typeof fetch;
  fallbackRawParams?: unknown;
} = {}): Promise<helios.NetworkParams> => {
  let rawParams: unknown;

  try {
    const response = await fetchFn(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    rawParams = await response.json();
  } catch (_error) {
    rawParams = fallbackRawParams;
  }

  return new helios.NetworkParams(rawParams);
};
