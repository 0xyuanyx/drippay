import { describe, expect, it } from "vitest";

import { hiddenSettlementStorageKey, splitSettlementVisibility } from "./hiddenSettlements";
import type { SettlementView } from "../types";

const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const active: SettlementView = {
  id: 1n,
  terms: { inviteHash: `0x${"1".repeat(64)}`, payee: address, payer: address, amount: 1n, startedAt: 1n, endsAt: 2n, withdrawn: 0n, joined: true, cancelled: false, serviceName: "활성" },
  earned: 0n, withdrawable: 0n, refundable: 0n,
};
const cancelled: SettlementView = { ...active, id: 2n, terms: { ...active.terms, cancelled: true, serviceName: "취소" } };

describe("hidden settlement storage", () => {
  it("scopes the browser key to a wallet and contract", () => {
    expect(hiddenSettlementStorageKey(31337, "0xabc", address)).toContain("31337:0xabc:0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
  });

  it("never hides an active settlement even when its old ID is stored", () => {
    expect(splitSettlementVisibility([active, cancelled], ["1", "2"])).toEqual({ visible: [active], hidden: [cancelled] });
  });
});
