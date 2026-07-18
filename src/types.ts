import type { Address } from "viem";

export type ServicePlan = {
  id: string;
  name: string;
  amount: number;
  durationDays: number;
  iconLabel: string;
};

export type SettlementTerms = {
  inviteHash: `0x${string}`;
  payee: Address;
  payer: Address;
  amount: bigint;
  startedAt: bigint;
  endsAt: bigint;
  withdrawn: bigint;
  joined: boolean;
  cancelled: boolean;
  serviceName: string;
};

export type JoinPreview = {
  id: bigint;
  terms: SettlementTerms;
};

export type SettlementView = JoinPreview & {
  earned: bigint;
  withdrawable: bigint;
  refundable: bigint;
};
