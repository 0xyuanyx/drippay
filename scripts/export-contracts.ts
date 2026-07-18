import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { artifacts } from "hardhat";

type ContractAddresses = {
  pointToken: string;
  timeSettlement: string;
};

export async function exportContracts(addresses: ContractAddresses) {
  const [pointArtifact, settlementArtifact] = await Promise.all([
    artifacts.readArtifact("MockSubscriptionPoint"),
    artifacts.readArtifact("TimeSettlement"),
  ]);
  const source = [
    `export const POINT_TOKEN = ${JSON.stringify({ address: addresses.pointToken, abi: pointArtifact.abi }, null, 2)} as const;`,
    "",
    `export const TIME_SETTLEMENT = ${JSON.stringify({ address: addresses.timeSettlement, abi: settlementArtifact.abi }, null, 2)} as const;`,
    "",
  ].join("\n");

  await writeFile(resolve(process.cwd(), "src/contracts.ts"), source, "utf8");
}
