import { describe, expect, it } from "vitest";

import { createLatestRequestGuard } from "./latestRequestGuard";

const ACCOUNT_A = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const ACCOUNT_B = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

describe("createLatestRequestGuard", () => {
  it("rejects responses from an older sequence and an older account", () => {
    let currentAccount: string | undefined = ACCOUNT_A;
    const guard = createLatestRequestGuard(
      () => currentAccount,
      (left, right) => left.toLowerCase() === right.toLowerCase(),
    );

    const firstForA = guard.begin(ACCOUNT_A);
    const secondForA = guard.begin(ACCOUNT_A);

    expect(firstForA.isCurrent()).toBe(false);
    expect(secondForA.isCurrent()).toBe(true);

    currentAccount = ACCOUNT_B;
    expect(secondForA.isCurrent()).toBe(false);

    const firstForB = guard.begin(ACCOUNT_B);
    expect(firstForB.isCurrent()).toBe(true);

    guard.invalidate();
    expect(firstForB.isCurrent()).toBe(false);
  });
});
