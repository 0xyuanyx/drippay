// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateSettlementDialog } from "./CreateSettlementDialog";
import { Dashboard } from "./Dashboard";
import { JoinSettlementDialog } from "./JoinSettlementDialog";

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
});
