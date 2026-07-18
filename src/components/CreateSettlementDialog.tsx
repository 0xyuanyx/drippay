import type { ServicePlan } from "../types";

type CreateSettlementDialogProps = {
  mode?: "choose" | "leader";
  plans?: readonly ServicePlan[];
  busy?: boolean;
  writeDisabled?: boolean;
  onClose: () => void;
  onChooseLeader: () => void;
  onChooseMember: () => void;
  onCreate?: (plan: ServicePlan) => void;
};

export function CreateSettlementDialog({
  mode = "choose",
  plans = [],
  busy = false,
  writeDisabled = false,
  onClose,
  onChooseLeader,
  onChooseMember,
  onCreate,
}: CreateSettlementDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <button className="dialog-close" onClick={onClose} aria-label="닫기">×</button>
        {mode === "choose" ? (
          <>
            <p className="eyebrow">새 정산</p>
            <h2 id="create-title">어떤 역할로 시작할까요?</h2>
            <p className="muted">한 명의 파티장과 한 명의 파티원이 함께하는 로컬 데모입니다.</p>
            <div className="choice-grid">
              <button className="choice-card" aria-label="파티장으로 시작" onClick={onChooseLeader}>
                <strong>파티장으로 시작</strong><span>조건을 만들고 시간만큼 포인트를 받습니다.</span>
              </button>
              <button className="choice-card" aria-label="파티원으로 참여" onClick={onChooseMember}>
                <strong>파티원으로 참여</strong><span>코드로 조건을 확인하고 포인트를 예치합니다.</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">파티장</p>
            <h2 id="create-title">고정 플랜 선택</h2>
            <p className="muted">생성 후 금액과 기간은 바꿀 수 없습니다.</p>
            <div className="plan-list">
              {plans.map((plan) => (
                <button key={plan.id} className="plan-row" disabled={busy || writeDisabled} onClick={() => onCreate?.(plan)}>
                  <span className="plan-icon">{plan.iconLabel}</span>
                  <span><strong>{plan.name}</strong><small>{plan.durationDays}일 정산</small></span>
                  <b>{plan.amount.toLocaleString()} P</b>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
