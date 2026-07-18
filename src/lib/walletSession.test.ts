import { describe, expect, it, vi } from "vitest";

import {
  clearWalletSession,
  markWalletSession,
  restoreWalletSession,
} from "./walletSession";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("local wallet session", () => {
  it("restores an explicitly connected account after a reload without requesting permissions", async () => {
    const storage = memoryStorage();
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_accounts") {
        return ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"];
      }
      if (method === "eth_chainId") return "0x7a69";
      throw new Error(`unexpected ${method}`);
    });
    markWalletSession(storage);

    await expect(
      restoreWalletSession({ request }, storage),
    ).resolves.toEqual({
      account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      chainId: 31337,
    });
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "wallet_requestPermissions" }),
    );
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "eth_requestAccounts" }),
    );
  });

  it("does not inspect MetaMask when there is no explicit local session", async () => {
    const storage = memoryStorage();
    const request = vi.fn();

    await expect(
      restoreWalletSession({ request }, storage),
    ).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("clears a stale session when the account is absent or the chain is not Hardhat", async () => {
    const storage = memoryStorage();
    markWalletSession(storage);
    const wrongChain = vi.fn(async ({ method }: { method: string }) =>
      method === "eth_accounts"
        ? ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]
        : "0x1",
    );

    await expect(
      restoreWalletSession({ request: wrongChain }, storage),
    ).resolves.toBeNull();
    expect(
      await restoreWalletSession({ request: vi.fn() }, storage),
    ).toBeNull();
  });

  it("explicit disconnect removes the marker and prevents auto reconnect", async () => {
    const storage = memoryStorage();
    markWalletSession(storage);
    clearWalletSession(storage);
    const request = vi.fn();

    await expect(
      restoreWalletSession({ request }, storage),
    ).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
