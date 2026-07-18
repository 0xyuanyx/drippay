import type { SettlementView } from "../types";

export function hiddenSettlementStorageKey(chainId: number, contractAddress: string, account: string): string {
  return `drippay.hidden-settlements:${chainId}:${contractAddress.toLowerCase()}:${account.toLowerCase()}`;
}

export function splitSettlementVisibility(settlements: SettlementView[], hiddenIds: string[]) {
  const hiddenIdSet = new Set(hiddenIds);
  const hidden = settlements.filter((settlement) => settlement.terms.cancelled && hiddenIdSet.has(settlement.id.toString()));
  const visible = settlements.filter((settlement) => !settlement.terms.cancelled || !hiddenIdSet.has(settlement.id.toString()));
  return { visible, hidden };
}
