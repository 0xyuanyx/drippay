import { useState } from "react";

type InviteResultDialogProps = {
  inviteCode: string;
  onClose: () => void;
};

export function InviteResultDialog({
  inviteCode,
  onClose,
}: InviteResultDialogProps) {
  const [copyFeedback, setCopyFeedback] = useState("");

  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyFeedback("복사했어요.");
    } catch {
      setCopyFeedback("복사하지 못했습니다. 코드를 직접 선택해 주세요.");
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog invite-result" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <p className="eyebrow">정산 생성 완료</p>
        <h2 id="invite-title">참여 코드는 한 번만 보여드려요.</h2>
        <div className="invite-code">{inviteCode}</div>
        <button className="button primary full" onClick={() => void copyInviteCode()}>코드 복사</button>
        {copyFeedback && <p className="copy-feedback" role="status">{copyFeedback}</p>}
        <button className="text-button" onClick={onClose}>확인하고 닫기</button>
      </section>
    </div>
  );
}
