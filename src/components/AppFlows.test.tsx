// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateSettlementDialog } from "./CreateSettlementDialog";
import { Dashboard } from "./Dashboard";
import { JoinSettlementDialog } from "./JoinSettlementDialog";
import { SettlementDetail } from "./SettlementDetail";

afterEach(cleanup);

describe("settlement UI flows", () => {
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
