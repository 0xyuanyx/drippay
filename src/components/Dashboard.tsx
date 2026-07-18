import { formatUnits, type Address } from "viem";

import type { SettlementView } from "../types";

type DashboardProps = {
  account?: Address;
  settlements: SettlementView[];
  onSelectSettlement: (settlement: SettlementView) => void;
};

function points(value: bigint): string {
  return Math.floor(Number(formatUnits(value, 18))).toLocaleString();
}

export function Dashboard({ account, settlements, onSelectSettlement }: DashboardProps) {
  const locked = settlements.reduce((sum, item) => sum + (item.terms.joined && !item.terms.cancelled ? item.terms.amount - item.terms.withdrawn : 0n), 0n);
  const withdrawable = settlements.reduce((sum, item) => sum + (account && item.terms.payee.toLowerCase() === account.toLowerCase() ? item.withdrawable : 0n), 0n);
  const refundable = settlements.reduce((sum, item) => sum + (account && item.terms.payer.toLowerCase() === account.toLowerCase() ? item.refundable : 0n), 0n);

  return (
    <>
      <section className="metric-grid" aria-label="정산 요약">
        <article><span>컨트랙트에 묶인 돈</span><strong>{points(locked)} P</strong><small>스마트 컨트랙트 보관</small></article>
        <article><span>받을 돈</span><strong>{points(withdrawable)} P</strong><small>지금 인출 가능한 금액</small></article>
        <article><span>남은 예치금</span><strong>{points(refundable)} P</strong><small>아직 흐르지 않은 금액</small></article>
      </section>
      <section className="settlement-list">
        <div className="section-heading"><div><p className="eyebrow">내 정산</p><h2>시간이 흐르는 계약</h2></div><span>{settlements.length}건</span></div>
        {settlements.length === 0 ? (
          <div className="empty-state"><strong>아직 연결된 정산이 없습니다.</strong><span>새 정산을 만들거나 참여 코드로 시작해 보세요.</span></div>
        ) : settlements.map((settlement) => (
          <button className="settlement-row" key={settlement.id.toString()} onClick={() => onSelectSettlement(settlement)}>
            <span className="plan-icon">{settlement.terms.serviceName.slice(0, 1)}</span>
            <span><strong>{settlement.terms.serviceName}</strong><small>정산 #{settlement.id.toString()} · {settlement.terms.cancelled ? "취소됨" : settlement.terms.joined ? "진행 중" : "참여 대기"}</small></span>
            <b>{points(settlement.terms.amount)} P</b><span aria-hidden="true">→</span>
          </button>
        ))}
      </section>
    </>
  );
}
