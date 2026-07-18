import { useEffect, useRef, useState } from "react";
import { formatUnits, type Address } from "viem";

import { formatAccruedPoints, formatElapsed, formatProgress, secondsPerPoint } from "../lib/settlementClock";
import type { SettlementView } from "../types";

type DashboardProps = {
  account?: Address;
  chainNow?: bigint;
  settlements: SettlementView[];
  onSelectSettlement: (settlement: SettlementView) => void;
};

function points(value: bigint): string {
  return Math.floor(Number(formatUnits(value, 18))).toLocaleString();
}

export function Dashboard({ account, chainNow = 0n, settlements, onSelectSettlement }: DashboardProps) {
  const [wallNow, setWallNow] = useState(() => Date.now());
  const lastChainSyncRef = useRef({ chainNow, wallNow: Date.now() });
  if (lastChainSyncRef.current.chainNow !== chainNow) {
    lastChainSyncRef.current = { chainNow, wallNow: Date.now() };
  }
  useEffect(() => {
    const timer = window.setInterval(() => setWallNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const observedSeconds = BigInt(Math.max(0, Math.floor((wallNow - lastChainSyncRef.current.wallNow) / 1_000)));
  const displayNow = chainNow + observedSeconds;
  const locked = settlements.reduce((sum, item) => sum + (item.terms.joined && !item.terms.cancelled ? item.terms.amount - item.terms.withdrawn : 0n), 0n);
  const withdrawable = settlements.reduce((sum, item) => sum + (account && item.terms.payee.toLowerCase() === account.toLowerCase() ? item.withdrawable : 0n), 0n);
  const refundable = settlements.reduce((sum, item) => sum + (account && item.terms.payer.toLowerCase() === account.toLowerCase() ? item.refundable : 0n), 0n);
  const flowRate = settlements.reduce((sum, item) => {
    const duration = Number(item.terms.endsAt - item.terms.startedAt);
    return sum + (item.terms.joined && !item.terms.cancelled && duration > 0 ? Number(item.terms.amount / 10n ** 18n) / duration : 0);
  }, 0);

  return (
    <>
      <section className="metric-grid" aria-label="정산 요약">
        <article><span>DripPay 보관 금액</span><strong>{points(locked)} P</strong><small>{flowRate > 0 ? `매초 약 ${flowRate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} P 정산 중` : "스마트 컨트랙트가 안전하게 보관"}</small></article>
        <article><span>받을 돈</span><strong>{points(withdrawable)} P</strong><small>지금 인출 가능한 금액</small></article>
        <article><span>남은 예치금</span><strong>{points(refundable)} P</strong><small>아직 흐르지 않은 금액</small></article>
      </section>
      <section className="settlement-list">
        <div className="section-heading"><div><p className="eyebrow">내 정산</p><h2>시간이 흐르는 계약</h2></div><span>{settlements.length}건</span></div>
        {settlements.length === 0 ? (
          <div className="empty-state"><strong>아직 연결된 정산이 없습니다.</strong><span>새 정산을 만들거나 참여 코드로 시작해 보세요.</span></div>
        ) : settlements.map((settlement) => {
          const duration = Math.max(Number(settlement.terms.endsAt - settlement.terms.startedAt), 1);
          const elapsed = settlement.terms.joined ? displayNow - settlement.terms.startedAt : 0n;
          const progress = settlement.terms.joined ? Math.min(100, Math.max(0, (Number(elapsed) / duration) * 100)) : 0;
          const isFlowing = settlement.terms.joined && !settlement.terms.cancelled;
          return (
            <button className="settlement-row" key={settlement.id.toString()} onClick={() => onSelectSettlement(settlement)}>
              <span className="plan-icon">{settlement.terms.serviceName.slice(0, 1)}</span>
              <span><strong>{settlement.terms.serviceName}</strong><small>정산 #{settlement.id.toString()} · {settlement.terms.cancelled ? "취소됨" : settlement.terms.joined ? `${formatAccruedPoints(settlement.terms.amount, duration, elapsed)} P 정산됨 · ${formatProgress(progress)}%` : "참여 대기"}</small></span>
              <b><small>{points(settlement.terms.amount)} P</small>{isFlowing ? `1P당 약 ${formatElapsed(secondsPerPoint(settlement.terms.amount, duration))}` : "정산 종료"}</b><span aria-hidden="true">→</span>
            </button>
          );
        })}
      </section>
    </>
  );
}
