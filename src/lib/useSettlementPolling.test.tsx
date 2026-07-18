// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSettlementPolling } from "./useSettlementPolling";

const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

afterEach(() => {
  vi.useRealTimers();
});

describe("useSettlementPolling", () => {
  it("refreshes immediately, on detail entry, and every interval without leaking timers", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const initialProps: { selectedId?: bigint } = { selectedId: undefined };
    const { rerender, unmount } = renderHook(
      ({ selectedId }: { selectedId?: bigint }) =>
        useSettlementPolling({
          account: ACCOUNT,
          selectedId,
          refresh,
          intervalMs: 10_000,
        }),
      { initialProps },
    );

    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);

    rerender({ selectedId: 1n });
    expect(refresh).toHaveBeenCalledTimes(3);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refresh).toHaveBeenCalledTimes(3);
  });
});
