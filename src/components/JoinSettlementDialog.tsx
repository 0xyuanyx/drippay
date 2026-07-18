import { useState, type FormEvent } from "react";
import { formatUnits } from "viem";

import { normalizeInviteCode } from "../lib/inviteCode";
import type { JoinPreview } from "../types";

type JoinSettlementDialogProps = {
  busy?: boolean;
  lookupSettlement: (code: string) => Promise<JoinPreview | null>;
  onClose: () => void;
  onJoin: (code: string, preview: JoinPreview) => void;
};

export function JoinSettlementDialog({ busy = false, lookupSettlement, onClose, onJoin }: JoinSettlementDialogProps) {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function checkCode(event: FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError("");
    try {
      const result = await lookupSettlement(normalizeInviteCode(code));
      setPreview(result);
      if (!result) setError("유효하지 않거나 만료된 참여 코드입니다.");
    } catch {
      setPreview(null);
      setError("유효하지 않거나 만료된 참여 코드입니다.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="join-title">
        <button className="dialog-close" onClick={onClose} aria-label="닫기">×</button>
        <p className="eyebrow">파티원</p>
        <h2 id="join-title">참여 코드 확인</h2>
        {!preview ? (
          <form onSubmit={checkCode}>
            <label htmlFor="invite-code">참여 코드</label>
            <input id="invite-code" value={code} maxLength={8} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="8자리 코드" autoFocus />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button primary full" disabled={checking || !code.trim()}>{checking ? "확인 중…" : "코드 확인"}</button>
          </form>
        ) : (
          <div className="terms-panel">
            <span>변경할 수 없는 정산 조건</span>
            <h3>{preview.terms.serviceName}</h3>
            <dl><div><dt>예치 금액</dt><dd>{Number(formatUnits(preview.terms.amount, 18)).toLocaleString()} P</dd></div><div><dt>정산 기간</dt><dd>{Number(preview.terms.endsAt) / 86400}일</dd></div></dl>
            <p className="muted">MetaMask에서 포인트 사용 승인 후 예치 거래를 한 번 더 확인합니다.</p>
            <button className="button primary full" disabled={busy} onClick={() => onJoin(normalizeInviteCode(code), preview)}>{busy ? "처리 중…" : "승인하고 참여"}</button>
          </div>
        )}
      </section>
    </div>
  );
}
