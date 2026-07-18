import { network } from "hardhat";
import { POINT_TOKEN, TIME_SETTLEMENT } from "../src/contracts.js";

const { ethers } = await network.create();
const [accountZero, accountOne] = await ethers.getSigners();
const point = await ethers.getContractAt("MockSubscriptionPoint", POINT_TOKEN.address);
const settlement = await ethers.getContractAt("TimeSettlement", TIME_SETTLEMENT.address);

const pointUnit = ethers.parseUnits("1", 18);
const thirtyDays = 30 * 86_400;
const ninetyDays = 90 * 86_400;
const runId = Date.now().toString();

async function createAndJoin(
  leader: typeof accountZero,
  member: typeof accountZero,
  serviceName: string,
  amount: bigint,
  duration: number,
  suffix: string,
) {
  const code = `DEMO-${runId}-${suffix}`;
  const inviteHash = ethers.keccak256(ethers.toUtf8Bytes(code));
  await (await settlement.connect(leader).createSettlement(inviteHash, serviceName, amount, duration)).wait();
  await (await point.connect(member).approve(await settlement.getAddress(), amount)).wait();
  await (await settlement.connect(member).joinSettlement(code)).wait();
}

// Local-only presentation data. These default Hardhat accounts have no real-world value.
await (await point.mint(accountZero.address, ethers.parseUnits("100000", 18))).wait();
await (await point.mint(accountOne.address, ethers.parseUnits("100000", 18))).wait();

await createAndJoin(accountZero, accountOne, "스트리밍 스탠다드", 10_000n * pointUnit, thirtyDays, "LEADER");
await createAndJoin(accountOne, accountZero, "뮤직 패밀리", 8_000n * pointUnit, thirtyDays, "MEMBER");
await createAndJoin(accountZero, accountZero, "온라인 러닝", 24_000n * pointUnit, ninetyDays, "BOTH");

await ethers.provider.send("evm_increaseTime", [7 * 86_400]);
await ethers.provider.send("evm_mine", []);

console.log("Seeded three active DripPay demo settlements for Hardhat account #0:");
console.log("- 파티장: 스트리밍 스탠다드");
console.log("- 파티원: 뮤직 패밀리");
console.log("- 파티장 · 파티원: 온라인 러닝");
console.log("The local chain advanced by 7 days so progress and accrued points are visible.");
