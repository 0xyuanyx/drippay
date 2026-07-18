import type { ReactNode } from "react";

type AppShellProps = {
  address?: string;
  balance: string;
  connected: boolean;
  networkLabel: string;
  onConnect: () => void;
  children: ReactNode;
};

function shortenAddress(address?: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "지갑 미연결";
}

export function AppShell({
  address,
  balance,
  connected,
  networkLabel,
  onConnect,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">D</span>
          <div><strong>DripPay</strong><small>Pay only as time flows.</small></div>
        </div>
        <div className="wallet-summary">
          <span className="status-dot" aria-hidden="true" />
          <span>{networkLabel}</span>
          <span>{balance} P</span>
          {connected ? (
            <span className="address-chip">{shortenAddress(address)}</span>
          ) : (
            <button className="button compact" onClick={onConnect}>MetaMask 연결</button>
          )}
        </div>
      </header>
      <main>{children}</main>
      <footer>로컬 Hardhat 데모 · 실제 서비스 계정은 발급하지 않습니다.</footer>
    </div>
  );
}
