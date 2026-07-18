import { describe, expect, it } from "vitest";

import { generateInviteCode, hashInviteCode } from "./inviteCode";

describe("invite codes", () => {
  it("generates an eight-character uppercase unambiguous code", () => {
    const code = generateInviteCode();

    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("normalizes surrounding whitespace and case before hashing", () => {
    expect(hashInviteCode("  drip2026  ")).toBe(hashInviteCode("DRIP2026"));
  });
});
