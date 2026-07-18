// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateSettlementDialog } from "./CreateSettlementDialog";
import { AppShell } from "./AppShell";
import { Dashboard } from "./Dashboard";
import { JoinSettlementDialog } from "./JoinSettlementDialog";
import { InviteResultDialog } from "./InviteResultDialog";
import { SettlementDetail } from "./SettlementDetail";
import type { SettlementView } from "../types";

afterEach(cleanup);

describe("settlement UI flows", () => {
  it("shows a blocking network state when the connected wallet leaves Hardhat", () => {
    render(
      <AppShell
        address="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        balance="30,000"
        connected
        networkLabel="다른 네트워크 · 거래 중지"
        networkReady={false}
        onConnect={vi.fn()}
      >
        <div />
      </AppShell>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "다른 네트워크 · 거래 중지",
    );
    expect(screen.getByRole("status")).toHaveClass("network-warning");
  });

  it("offers a local disconnect control for a connected wallet", async () => {
    const user = userEvent.setup();
    const onDisconnect = vi.fn();
    render(
      <AppShell
        address="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        balance="30,000"
        connected
        networkLabel="Hardhat · 31337"
        onConnect={vi.fn()}
        onDisconnect={onDisconnect}
      >
        <div />
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "연결 해제" }));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it("copies an invite code without closing or disconnecting the local session", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<InviteResultDialog inviteCode="DRIP2026" onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "코드 복사" }));

    expect(writeText).toHaveBeenCalledWith("DRIP2026");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("복사했어요.")).toBeInTheDocument();
  });

  it("offers leader and member paths from the create dialog", () => {
    render(
      <CreateSettlementDialog
        onClose={vi.fn()}
        onChooseLeader={vi.fn()}
        onChooseMember={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "파티장으로 시작" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "파티원으로 참여" }),
    ).toBeInTheDocument();
  });

  it("disables settlement creation while the wallet is on another network", () => {
    render(
      <CreateSettlementDialog
        mode="leader"
        plans={[
          {
            id: "stream-30",
            name: "스트리밍 스탠다드",
            amount: 10_000,
            durationDays: 30,
            iconLabel: "S",
          },
        ]}
        writeDisabled
        onClose={vi.fn()}
        onChooseLeader={vi.fn()}
        onChooseMember={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /스트리밍 스탠다드/ }),
    ).toBeDisabled();
  });

  it("shows the approved error when a member enters an unknown code", async () => {
    const user = userEvent.setup();
    render(
      <JoinSettlementDialog
        lookupSettlement={vi.fn().mockResolvedValue(null)}
        onClose={vi.fn()}
        onJoin={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("참여 코드"), "UNKNOWN");
    await user.click(screen.getByRole("button", { name: "코드 확인" }));

    expect(
      await screen.findByText("유효하지 않거나 만료된 참여 코드입니다."),
    ).toBeInTheDocument();
  });

  it("disables approve and join while the wallet is on another network", async () => {
    const user = userEvent.setup();
    render(
      <JoinSettlementDialog
        writeDisabled
        lookupSettlement={vi.fn().mockResolvedValue({
          id: 1n,
          terms: {
            inviteHash: `0x${"1".repeat(64)}`,
            payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            payer: "0x0000000000000000000000000000000000000000",
            amount: 10_000n * 10n ** 18n,
            startedAt: 0n,
            endsAt: 30n * 86_400n,
            withdrawn: 0n,
            joined: false,
            cancelled: false,
            serviceName: "스트리밍 스탠다드",
          },
        })}
        onClose={vi.fn()}
        onJoin={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("참여 코드"), "DRIP2026");
    await user.click(screen.getByRole("button", { name: "코드 확인" }));

    expect(
      await screen.findByRole("button", { name: "네트워크 확인 필요" }),
    ).toBeDisabled();
  });

  it("disables withdrawal and cancellation while the wallet is on another network", () => {
    const leader = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const member = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const settlement: SettlementView = {
      id: 1n,
      terms: {
        inviteHash: `0x${"1".repeat(64)}` as `0x${string}`,
        payee: leader,
        payer: member,
        amount: 10_000n * 10n ** 18n,
        startedAt: 100n,
        endsAt: 300n,
        withdrawn: 0n,
        joined: true,
        cancelled: false,
        serviceName: "스트리밍 스탠다드",
      },
      earned: 5_000n * 10n ** 18n,
      withdrawable: 5_000n * 10n ** 18n,
      refundable: 5_000n * 10n ** 18n,
    };
    const props = {
      chainNow: 200n,
      settlement,
      writeDisabled: true,
      onBack: vi.fn(),
      onWithdraw: vi.fn(),
      onCancel: vi.fn(),
    };
    const view = render(<SettlementDetail account={leader} {...props} />);

    expect(
      screen.getByRole("button", { name: "받을 돈 출금" }),
    ).toBeDisabled();

    view.rerender(<SettlementDetail account={member} {...props} />);
    expect(
      screen.getByRole("button", { name: "정산 취소 및 잔액 반환" }),
    ).toBeDisabled();
  });

  it("shows all approved financial labels on the dashboard", () => {
    render(<Dashboard settlements={[]} onSelectSettlement={vi.fn()} />);

    expect(screen.getByText("컨트랙트에 묶인 돈")).toBeInTheDocument();
    expect(screen.getByText("받을 돈")).toBeInTheDocument();
    expect(screen.getByText("남은 예치금")).toBeInTheDocument();
  });

  it("reports the leader's currently withdrawable amount as 받을 돈", () => {
    const leader = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    render(
      <Dashboard
        account={leader}
        settlements={[
          {
            id: 1n,
            terms: {
              inviteHash: `0x${"1".repeat(64)}`,
              payee: leader,
              payer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
              amount: 10_000n * 10n ** 18n,
              startedAt: 1n,
              endsAt: 2n,
              withdrawn: 4_000n * 10n ** 18n,
              joined: true,
              cancelled: false,
              serviceName: "스트리밍 스탠다드",
            },
            earned: 5_000n * 10n ** 18n,
            withdrawable: 1_000n * 10n ** 18n,
            refundable: 5_000n * 10n ** 18n,
          },
        ]}
        onSelectSettlement={vi.fn()}
      />,
    );

    const card = screen.getByText("받을 돈").closest("article");
    expect(within(card!).getByText("1,000 P")).toBeInTheDocument();
  });

  it("calculates settlement progress from the chain timestamp", () => {
    const leader = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    render(
      <SettlementDetail
        account={leader}
        chainNow={200n}
        settlement={{
          id: 1n,
          terms: {
            inviteHash: `0x${"1".repeat(64)}`,
            payee: leader,
            payer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            amount: 10_000n * 10n ** 18n,
            startedAt: 100n,
            endsAt: 300n,
            withdrawn: 0n,
            joined: true,
            cancelled: false,
            serviceName: "스트리밍 스탠다드",
          },
          earned: 5_000n * 10n ** 18n,
          withdrawable: 5_000n * 10n ** 18n,
          refundable: 5_000n * 10n ** 18n,
        }}
        onBack={vi.fn()}
        onWithdraw={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("전체 기간의 50.0% 경과")).toBeInTheDocument();
  });
});
