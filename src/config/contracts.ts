const getEnv = (key: string): string => {
  const value = import.meta.env[key];
  if (import.meta.env.PROD && !value) {
    console.error(`CRITICAL: Missing config ${key}`);
    return "";
  }
  return value || "";
};

// 1. Global Constants
export const CHAIN_ID = Number(getEnv("VITE_CHAIN_ID")) || 42793;
export const EXPLORER_BASE_URL = getEnv("VITE_EXPLORER_URL") || "https://explorer.etherlink.com";
export const WALLET_CONNECT_PROJECT_ID = getEnv("VITE_WC_PROJECT_ID") || "YOUR_PROJECT_ID_FALLBACK";

// 2. Contract Addresses
export const CONTRACT_ADDRESSES = {
  factory: (getEnv("VITE_FACTORY_ADDRESS") || "") as `0x${string}`,
  registry: (getEnv("VITE_REGISTRY_ADDRESS") || "") as `0x${string}`,
  usdc: (getEnv("VITE_USDC_ADDRESS") || "0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9") as `0x${string}`,
  
  // Infrastructure constants (Pyth on Etherlink)
  entropy: "0x2880aB155794e7179c9eE2e38200202908C17B43" as `0x${string}`,
  entropyProvider: "0x52DeaA1c84233F7bb8C8A45baeDE41091c616506" as `0x${string}`
} as const;

export const OFFICIAL_DEPLOYER_ADDRESS = CONTRACT_ADDRESSES.factory;

// 3. Helpers
export const getExplorerAddressUrl = (address: string) => `${EXPLORER_BASE_URL}/address/${address}`;
export const getExplorerTxUrl = (txHash: string) => `${EXPLORER_BASE_URL}/tx/${txHash}`;

export const isConfigured = () => {
  return (
    CONTRACT_ADDRESSES.factory.startsWith("0x") &&
    CONTRACT_ADDRESSES.registry.startsWith("0x") &&
    CONTRACT_ADDRESSES.usdc.startsWith("0x")
  );
};
