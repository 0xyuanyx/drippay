import { formatUnits, getAddress, zeroAddress, type Address } from "viem";

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
};

const points = (value: bigint) => Math.floor(Number(formatUnits(value, 18))).toLocaleString();

export function SettlementDetail({ account, busy = false, writeDisabled = false, chainNow, settlement, onBack, onWithdraw, onCancel }: SettlementDetailProps) {
  const { terms } = settlement;
  const duration = Math.max(Number(terms.endsAt - terms.startedAt), 1);
  const progress = terms.joined ? Math.min(100, Math.max(0, (Number(chainNow - terms.startedAt) / duration) * 100)) : 0;
  const isLeader = getAddress(account) === getAddress(terms.payee);
  const isMember = terms.payer !== zeroAddress && getAddress(account) === getAddress(terms.payer);

  return (
    <section className="detail">
      <button className="text-button" onClick={onBack}>← 대시보드</button>
      <div className="detail-heading"><div><p className="eyebrow">정산 #{settlement.id.toString()}</p><h1>{terms.serviceName}</h1></div><span className="badge">{terms.cancelled ? "취소됨" : terms.joined ? "진행 중" : "참여 대기"}</span></div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
      <p className="progress-copy">전체 기간의 {progress.toFixed(1)}% 경과</p>
      <section className="metric-grid">
        <article><span>컨트랙트에 묶인 돈</span><strong>{points(terms.joined && !terms.cancelled ? terms.amount - terms.withdrawn : 0n)} P</strong></article>
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
