import type { Address } from "viem";

import { HARDHAT_CHAIN_ID, parseWalletChainId } from "./hardhatNetwork";

const SESSION_KEY = "drippay.wallet-session";
const SESSION_VALUE = "active";

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type SessionProvider = {
  request(args: { method: "eth_accounts" }): Promise<unknown>;
  request(args: { method: "eth_chainId" }): Promise<unknown>;
};

export type RestoredWalletSession = {
  account: Address;
  chainId: number;
};

export function markWalletSession(storage: SessionStorage): void {
  storage.setItem(SESSION_KEY, SESSION_VALUE);
}

export function clearWalletSession(storage: SessionStorage): void {
  storage.removeItem(SESSION_KEY);
}

export async function restoreWalletSession(
  provider: SessionProvider,
  storage: SessionStorage,
): Promise<RestoredWalletSession | null> {
  if (storage.getItem(SESSION_KEY) !== SESSION_VALUE) return null;

  try {
    const [accountsValue, chainValue] = await Promise.all([
      provider.request({ method: "eth_accounts" }),
      provider.request({ method: "eth_chainId" }),
    ]);
    const [account] = accountsValue as Address[];
    const chainId = parseWalletChainId(chainValue);
    if (!account || chainId !== HARDHAT_CHAIN_ID) {
      clearWalletSession(storage);
      return null;
    }
    return { account, chainId };
  } catch {
    clearWalletSession(storage);
    return null;
  }
}
