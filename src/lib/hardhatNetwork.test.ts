import { describe, expect, it, vi } from "vitest";

import {
  HARDHAT_CHAIN_ID,
  InsufficientDemoPointsError,
  MissingLocalGasError,
  WrongNetworkError,
  listenForChainChanges,
  runOnHardhatChain,
  runSafeHardhatWrite,
} from "./hardhatNetwork";

describe("Hardhat transaction guard", () => {
  it("does not invoke a wallet write while MetaMask is on another chain", async () => {
    const provider = {
      request: vi.fn().mockResolvedValue("0x1"),
    };
    const write = vi.fn();

    await expect(runOnHardhatChain(provider, write)).rejects.toBeInstanceOf(
      WrongNetworkError,
    );
    expect(provider.request).toHaveBeenCalledWith({ method: "eth_chainId" });
    expect(write).not.toHaveBeenCalled();
  });

  it("invokes a wallet write only after confirming chain 31337", async () => {
    const provider = {
      request: vi.fn().mockResolvedValue("0x7a69"),
    };
    const write = vi.fn().mockResolvedValue("submitted");

    await expect(runOnHardhatChain(provider, write)).resolves.toBe("submitted");
    expect(write).toHaveBeenCalledOnce();
  });

  it("does not invoke a wallet write when the active address has no local gas", async () => {
    const write = vi.fn();

    await expect(
      runSafeHardhatWrite(
        { request: vi.fn().mockResolvedValue("0x7a69") },
        { getGasBalance: vi.fn().mockResolvedValue(0n) },
        write,
      ),
    ).rejects.toBeInstanceOf(MissingLocalGasError);
    expect(write).not.toHaveBeenCalled();
  });

  it("does not approve or join when the active address lacks demo points", async () => {
    const write = vi.fn();

    await expect(
      runSafeHardhatWrite(
        { request: vi.fn().mockResolvedValue("0x7a69") },
        {
          getGasBalance: vi.fn().mockResolvedValue(10n ** 18n),
          getPointBalance: vi.fn().mockResolvedValue(9_999n),
          requiredPoints: 10_000n,
        },
        write,
      ),
    ).rejects.toBeInstanceOf(InsufficientDemoPointsError);
    expect(write).not.toHaveBeenCalled();
  });

  it("submits after chain, local gas, and required points pass preflight", async () => {
    const write = vi.fn().mockResolvedValue("submitted");

    await expect(
      runSafeHardhatWrite(
        { request: vi.fn().mockResolvedValue("0x7a69") },
        {
          getGasBalance: vi.fn().mockResolvedValue(10n ** 18n),
          getPointBalance: vi.fn().mockResolvedValue(10_000n),
          requiredPoints: 10_000n,
        },
        write,
      ),
    ).resolves.toBe("submitted");
    expect(write).toHaveBeenCalledOnce();
  });
});

describe("MetaMask chain change listener", () => {
  it("reports chain changes and removes the same listener on cleanup", () => {
    let listener: ((chainId: unknown) => void) | undefined;
    const provider = {
      request: vi.fn(),
      on: vi.fn((event: string, nextListener: (chainId: unknown) => void) => {
        if (event === "chainChanged") listener = nextListener;
      }),
      removeListener: vi.fn(),
    };
    const onChange = vi.fn();

    const cleanup = listenForChainChanges(provider, onChange);
    listener?.("0x7a69");
    listener?.("0x1");

    expect(onChange).toHaveBeenNthCalledWith(1, HARDHAT_CHAIN_ID);
    expect(onChange).toHaveBeenNthCalledWith(2, 1);
    cleanup();
    expect(provider.removeListener).toHaveBeenCalledWith(
      "chainChanged",
      listener,
    );
  });
});
