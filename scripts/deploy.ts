import { network } from "hardhat";

import { exportContracts } from "./export-contracts.js";

const { ethers } = await network.create();
const [leader, member] = await ethers.getSigners();
const point = await ethers.deployContract("MockSubscriptionPoint");
await point.waitForDeployment();

const settlement = await ethers.deployContract("TimeSettlement", [
  await point.getAddress(),
]);
await settlement.waitForDeployment();

const demoBalance = ethers.parseUnits("30000", 18);
await (await point.mint(leader.address, demoBalance)).wait();
await (await point.mint(member.address, demoBalance)).wait();

const pointToken = await point.getAddress();
const timeSettlement = await settlement.getAddress();
await exportContracts({ pointToken, timeSettlement });

console.log(`Point token: ${pointToken}`);
console.log(`Time settlement: ${timeSettlement}`);
console.log(`Minted 30,000 P to ${leader.address} and ${member.address}`);
