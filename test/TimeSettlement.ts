import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const DAY = 24 * 60 * 60;
const DURATION = 30 * DAY;
const AMOUNT = ethers.parseUnits("10000", 18);
const INVITE_CODE = "DRIP2026";
const INVITE_HASH = ethers.keccak256(ethers.toUtf8Bytes(INVITE_CODE));

describe("TimeSettlement", function () {
  async function deployContracts() {
    const [leader, member, stranger] = await ethers.getSigners();
    const point = await ethers.deployContract("MockSubscriptionPoint");
    await point.waitForDeployment();

    const settlement = await ethers.deployContract("TimeSettlement", [
      await point.getAddress(),
    ]);
    await settlement.waitForDeployment();

    await point.mint(member.address, AMOUNT);

    return { leader, member, stranger, point, settlement };
  }

  async function createSettlement() {
    const contracts = await deployContracts();
    const { leader, settlement } = contracts;

    expect(
      await settlement
        .connect(leader)
        .createSettlement.staticCall(
          INVITE_HASH,
          "Netflix",
          AMOUNT,
          DURATION,
        ),
    ).to.equal(1n);

    await settlement
      .connect(leader)
      .createSettlement(INVITE_HASH, "Netflix", AMOUNT, DURATION);

    return { ...contracts, settlementId: 1n };
  }

  async function joinSettlement() {
    const contracts = await createSettlement();
    const { member, point, settlement } = contracts;

    await point.connect(member).approve(await settlement.getAddress(), AMOUNT);
    await settlement.connect(member).joinSettlement(INVITE_CODE);

    const terms = await settlement.getSettlement(contracts.settlementId);
    return { ...contracts, startedAt: terms.startedAt, endsAt: terms.endsAt };
  }

  it("locks the leader-selected terms when created", async function () {
    const { leader, settlement } = await createSettlement();
    const terms = await settlement.getSettlement(1n);

    expect(terms.inviteHash).to.equal(INVITE_HASH);
    expect(terms.payee).to.equal(leader.address);
    expect(terms.payer).to.equal(ethers.ZeroAddress);
    expect(terms.amount).to.equal(AMOUNT);
    expect(terms.startedAt).to.equal(0n);
    expect(terms.endsAt).to.equal(BigInt(DURATION));
    expect(terms.withdrawn).to.equal(0n);
    expect(terms.joined).to.equal(false);
    expect(terms.cancelled).to.equal(false);
    expect(terms.serviceName).to.equal("Netflix");
    expect(await settlement.getSettlementIdByInviteHash(INVITE_HASH)).to.equal(
      1n,
    );
  });

  it("rejects an unknown invite code", async function () {
    const { member, settlement } = await createSettlement();

    await expect(
      settlement.connect(member).joinSettlement("UNKNOWN"),
    ).to.be.revertedWithCustomError(settlement, "InvalidInviteCode");
  });

  it("transfers exactly 10,000 approved points when the member joins", async function () {
    const { member, point, settlement, settlementId, startedAt, endsAt } =
      await joinSettlement();
    const terms = await settlement.getSettlement(settlementId);

    expect(await point.balanceOf(member.address)).to.equal(0n);
    expect(await point.balanceOf(await settlement.getAddress())).to.equal(
      AMOUNT,
    );
    expect(terms.payer).to.equal(member.address);
    expect(terms.joined).to.equal(true);
    expect(endsAt - startedAt).to.equal(BigInt(DURATION));
    expect(await settlement.getSettlementIdByInviteHash(INVITE_HASH)).to.equal(
      0n,
    );
  });

  it("reports 5,000 earned, withdrawable, and refundable points halfway through", async function () {
    const { settlement, settlementId, startedAt } = await joinSettlement();
    await networkHelpers.time.increaseTo(
      startedAt + BigInt(DURATION / 2),
    );

    const [earned, withdrawable, refundable] =
      await settlement.getFinancials(settlementId);

    expect(earned).to.equal(AMOUNT / 2n);
    expect(withdrawable).to.equal(AMOUNT / 2n);
    expect(refundable).to.equal(AMOUNT / 2n);
  });

  it("lets the leader withdraw the 5,000 earned points once", async function () {
    const { leader, point, settlement, settlementId, startedAt } =
      await joinSettlement();
    await networkHelpers.time.setNextBlockTimestamp(
      startedAt + BigInt(DURATION / 2),
    );

    await expect(() => settlement.connect(leader).withdraw(settlementId)).to
      .changeTokenBalances(
        ethers,
        point,
        [settlement, leader],
        [-AMOUNT / 2n, AMOUNT / 2n],
      );

    const terms = await settlement.getSettlement(settlementId);
    expect(terms.withdrawn).to.equal(AMOUNT / 2n);
  });

  it("refunds the remaining 5,000 points on cancellation and disables withdrawal", async function () {
    const { leader, member, point, settlement, settlementId, startedAt } =
      await joinSettlement();
    const halfway = startedAt + BigInt(DURATION / 2);
    await networkHelpers.time.setNextBlockTimestamp(halfway);
    await settlement.connect(leader).withdraw(settlementId);
    await networkHelpers.time.setNextBlockTimestamp(halfway);

    await expect(() => settlement.connect(member).cancel(settlementId)).to
      .changeTokenBalances(
        ethers,
        point,
        [settlement, leader, member],
        [-AMOUNT / 2n, 0n, AMOUNT / 2n],
      );

    const terms = await settlement.getSettlement(settlementId);
    expect(terms.cancelled).to.equal(true);
    expect(await settlement.getFinancials(settlementId)).to.deep.equal([
      0n,
      0n,
      0n,
    ]);
    await expect(
      settlement.connect(leader).withdraw(settlementId),
    ).to.be.revertedWithCustomError(settlement, "SettlementCancelled");
  });
});
