import { useEffect } from "react";
import type { Address } from "viem";

const DEFAULT_INTERVAL_MS = 12_000;

type UseSettlementPollingOptions = {
  account?: Address;
  selectedId?: bigint;
  refresh: (account: Address) => Promise<void> | void;
  intervalMs?: number;
};

export function useSettlementPolling({
  account,
  selectedId,
  refresh,
  intervalMs = DEFAULT_INTERVAL_MS,
}: UseSettlementPollingOptions) {
  useEffect(() => {
    if (!account) return;

    void refresh(account);
    const timer = window.setInterval(() => {
      void refresh(account);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [account, intervalMs, refresh, selectedId]);
}
