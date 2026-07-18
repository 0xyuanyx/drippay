import { keccak256, toHex, type Hex } from "viem";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function generateInviteCode(): string {
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);

  return Array.from(values, (value) =>
    INVITE_ALPHABET.charAt(value % INVITE_ALPHABET.length),
  ).join("");
}

export function hashInviteCode(code: string): Hex {
  return keccak256(toHex(normalizeInviteCode(code)));
}
