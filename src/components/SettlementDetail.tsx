import { useEffect, useRef, useState } from "react";
import { formatUnits, getAddress, zeroAddress, type Address } from "viem";

import { clampElapsed, formatElapsed, formatPointsPerSecond, formatProgress } from "../lib/settlementClock";
import type { SettlementView } from "../types";

type SettlementDetailProps = {
  account: Address;
  busy?: boolean;
  writeDisabled?: boolean;
  chainNow: bigint;
  settlement: SettlementView;
  onBack: () => void;
  onWithdraw: (id: bigint) => void;
  onCancel: (id: bigint) => void;
  onHide?: (id: bigint) => void;
};

const points = (value: bigint) => Math.floor(Number(formatUnits(value, 18))).toLocaleString();

export function SettlementDetail({ account, busy = false, writeDisabled = false, chainNow, settlement, onBack, onWithdraw, onCancel, onHide }: SettlementDetailProps) {
  const { terms } = settlement;
  const [wallNow, setWallNow] = useState(() => Date.now());
  const lastChainSyncRef = useRef({ chainNow, wallNow: Date.now() });
  if (lastChainSyncRef.current.chainNow !== chainNow) {
    lastChainSyncRef.current = { chainNow, wallNow: Date.now() };
  }
  useEffect(() => {
    const timer = window.setInterval(() => setWallNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const duration = Math.max(Number(terms.endsAt - terms.startedAt), 1);
  const observedSeconds = BigInt(Math.max(0, Math.floor((wallNow - lastChainSyncRef.current.wallNow) / 1_000)));
  const displayNow = chainNow + observedSeconds;
  const elapsedSeconds = terms.joined ? clampElapsed(terms.startedAt, terms.endsAt, displayNow) : 0n;
  const progress = terms.joined ? Math.min(100, Math.max(0, (Number(elapsedSeconds) / duration) * 100)) : 0;
  const isFlowing = terms.joined && !terms.cancelled && displayNow < terms.endsAt;
  const isLeader = getAddress(account) === getAddress(terms.payee);
  const isMember = terms.payer !== zeroAddress && getAddress(account) === getAddress(terms.payer);
  const roleLabel = isLeader && isMember ? "파티장 · 파티원" : isLeader ? "파티장" : "파티원";

  return (
    <section className="detail">
      <button className="text-button" onClick={onBack}>← 대시보드</button>
      <div className="detail-heading"><div><p className="eyebrow">{roleLabel}</p><h1>{terms.serviceName}</h1></div><div className="detail-heading-actions"><span className="badge">{terms.cancelled ? "취소됨" : terms.joined ? "진행 중" : "참여 대기"}</span>{terms.cancelled && onHide && <button className="button compact archive-button" onClick={() => onHide(settlement.id)}>목록에서 숨기기</button>}</div></div>
      <div className={`progress-track${isFlowing ? " flowing" : ""}`}><span style={{ width: `${progress}%` }} /></div>
      <p className="progress-copy">전체 기간의 {formatProgress(progress)}% 경과 · {formatElapsed(elapsedSeconds)}{isFlowing ? "째 흐르는 중" : " 경과"}</p>
      {isFlowing && <p className="drip-rate">매초 약 {formatPointsPerSecond(terms.amount, duration)} P가 정산되고 있어요.</p>}
      <section className="metric-grid">
        <article><span>DripPay 보관 금액</span><strong>{points(terms.joined && !terms.cancelled ? terms.amount - terms.withdrawn : 0n)} P</strong></article>
        <article><span>받을 돈</span><strong>{points(settlement.withdrawable)} P</strong></article>
        <article><span>남은 예치금</span><strong>{points(settlement.refundable)} P</strong></article>
      </section>
      {!terms.cancelled && (isLeader || isMember) && (
        <div className="detail-actions">
          {isLeader && terms.joined && <button className="button primary" disabled={busy || writeDisabled || settlement.withdrawable === 0n} onClick={() => onWithdraw(settlement.id)}>받을 돈 출금</button>}
          {isMember && <button className="button danger" disabled={busy || writeDisabled} onClick={() => onCancel(settlement.id)}>정산 취소 및 잔액 반환</button>}
        </div>
      )}
    </section>
  );
}
