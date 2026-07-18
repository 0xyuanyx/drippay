import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatUnits,
  http,
  parseUnits,
  zeroAddress,
  type Address,
  type EIP1193Provider,
} from "viem";

import { AppShell } from "./components/AppShell";
import { CreateSettlementDialog } from "./components/CreateSettlementDialog";
import { Dashboard } from "./components/Dashboard";
import { JoinSettlementDialog } from "./components/JoinSettlementDialog";
import { SettlementDetail } from "./components/SettlementDetail";
import { POINT_TOKEN, TIME_SETTLEMENT } from "./contracts";
import { generateInviteCode, hashInviteCode, normalizeInviteCode } from "./lib/inviteCode";
import { useSettlementPolling } from "./lib/useSettlementPolling";
import type { JoinPreview, ServicePlan, SettlementTerms, SettlementView } from "./types";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

const hardhat = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

const publicClient = createPublicClient({ chain: hardhat, transport: http() });

export const SERVICE_PLANS: readonly ServicePlan[] = [
  { id: "stream-30", name: "스트리밍 스탠다드", amount: 10000, durationDays: 30, iconLabel: "S" },
  { id: "music-30", name: "뮤직 패밀리", amount: 8000, durationDays: 30, iconLabel: "M" },
  { id: "learning-90", name: "온라인 러닝", amount: 24000, durationDays: 90, iconLabel: "L" },
] as const;

type Dialog = "choose" | "leader" | "join" | null;
type MetaMaskProvider = EIP1193Provider & {
  on?: (event: string, listener: (value: unknown) => void) => void;
  removeListener?: (event: string, listener: (value: unknown) => void) => void;
};

const sameAddress = (left: Address, right: Address) => left.toLowerCase() === right.toLowerCase();

export default function App() {
  const [account, setAccount] = useState<Address>();
  const [balance, setBalance] = useState(0n);
  const [chainNow, setChainNow] = useState(0n);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [settlements, setSettlements] = useState<SettlementView[]>([]);
  const [selectedId, setSelectedId] = useState<bigint>();
  const [createdInvite, setCreatedInvite] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const walletClient = useMemo(() => {
    if (!window.ethereum || !account) return null;
    return createWalletClient({ account, chain: hardhat, transport: custom(window.ethereum) });
  }, [account]);

  useEffect(() => {
    const provider = window.ethereum as MetaMaskProvider | undefined;
    const handleAccounts = (value: unknown) => {
      const [nextAccount] = value as Address[];
      setAccount(nextAccount);
      setSelectedId(undefined);
      setDialog(null);
    };
    provider?.on?.("accountsChanged", handleAccounts);
    return () => provider?.removeListener?.("accountsChanged", handleAccounts);
  }, []);

  const refresh = useCallback(async (activeAccount: Address) => {
    try {
      const [pointBalance, nextId, latestBlock] = await Promise.all([
        publicClient.readContract({ ...POINT_TOKEN, functionName: "balanceOf", args: [activeAccount] }),
        publicClient.readContract({ ...TIME_SETTLEMENT, functionName: "nextSettlementId" }),
        publicClient.getBlock({ blockTag: "latest" }),
      ]);
      setBalance(pointBalance);
      setChainNow(latestBlock.timestamp);

      const reads = Array.from({ length: Number(nextId - 1n) }, (_, index) => BigInt(index + 1)).map(async (id) => {
        const terms = await publicClient.readContract({ ...TIME_SETTLEMENT, functionName: "getSettlement", args: [id] }) as SettlementTerms;
        if (!sameAddress(terms.payee, activeAccount) && (terms.payer === zeroAddress || !sameAddress(terms.payer, activeAccount))) return null;
        const [earned, withdrawable, refundable] = await publicClient.readContract({ ...TIME_SETTLEMENT, functionName: "getFinancials", args: [id] });
        return { id, terms, earned, withdrawable, refundable } satisfies SettlementView;
      });
      setSettlements((await Promise.all(reads)).filter((item): item is SettlementView => item !== null));
    } catch {
      setNotice("로컬 노드와 배포 상태를 확인해 주세요.");
    }
  }, []);

  useSettlementPolling({ account, selectedId, refresh });

  async function connectWallet() {
    if (!window.ethereum) {
      setNotice("MetaMask를 설치한 뒤 다시 시도해 주세요.");
      return;
    }
    setNotice("");
    try {
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a69" }] });
      } catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: "0x7a69", chainName: "Hardhat Local", nativeCurrency: hardhat.nativeCurrency, rpcUrls: hardhat.rpcUrls.default.http }],
        });
      }
      const addresses = await window.ethereum.request({ method: "eth_requestAccounts" }) as Address[];
      if (addresses[0]) setAccount(addresses[0]);
    } catch {
      setNotice("지갑 연결이 취소되었거나 Hardhat 네트워크에 연결할 수 없습니다.");
    }
  }

  async function send(functionName: "withdraw" | "cancel", args: readonly [bigint]) {
    if (!walletClient || !account) return;
    setBusy(true);
    setNotice("");
    try {
      const hash = await walletClient.writeContract({ ...TIME_SETTLEMENT, functionName, args });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh(account);
      setNotice(functionName === "withdraw" ? "받을 포인트를 출금했습니다." : "정산을 취소하고 잔액을 반환했습니다.");
    } catch {
      setNotice("거래가 완료되지 않았습니다. MetaMask 내용을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function createSettlement(plan: ServicePlan) {
    if (!walletClient || !account) return;
    const inviteCode = generateInviteCode();
    setBusy(true);
    setNotice("");
    try {
      const hash = await walletClient.writeContract({
        ...TIME_SETTLEMENT,
        functionName: "createSettlement",
        args: [hashInviteCode(inviteCode), plan.name, parseUnits(String(plan.amount), 18), BigInt(plan.durationDays * 86400)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setDialog(null);
      setCreatedInvite(inviteCode);
      await refresh(account);
    } catch {
      setNotice("정산 생성 거래가 완료되지 않았습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function lookupSettlement(code: string): Promise<JoinPreview | null> {
    const id = await publicClient.readContract({ ...TIME_SETTLEMENT, functionName: "getSettlementIdByInviteHash", args: [hashInviteCode(code)] });
    if (id === 0n) return null;
    const terms = await publicClient.readContract({ ...TIME_SETTLEMENT, functionName: "getSettlement", args: [id] }) as SettlementTerms;
    return { id, terms };
  }

  async function joinSettlement(code: string, preview: JoinPreview) {
    if (!walletClient || !account) return;
    setBusy(true);
    setNotice("");
    try {
      const approval = await walletClient.writeContract({ ...POINT_TOKEN, functionName: "approve", args: [TIME_SETTLEMENT.address, preview.terms.amount] });
      await publicClient.waitForTransactionReceipt({ hash: approval });
      const join = await walletClient.writeContract({ ...TIME_SETTLEMENT, functionName: "joinSettlement", args: [normalizeInviteCode(code)] });
      await publicClient.waitForTransactionReceipt({ hash: join });
      setDialog(null);
      await refresh(account);
      setSelectedId(preview.id);
      setNotice("포인트를 예치하고 정산에 참여했습니다.");
    } catch {
      setNotice("승인 또는 참여 거래가 완료되지 않았습니다.");
    } finally {
      setBusy(false);
    }
  }

  const selected = settlements.find((item) => item.id === selectedId);
  const balanceLabel = Math.floor(Number(formatUnits(balance, 18))).toLocaleString();

  return (
    <AppShell address={account} balance={balanceLabel} connected={Boolean(account)} networkLabel="Hardhat · 31337" onConnect={connectWallet}>
      <div className="page">
        {notice && <div className="notice" role="status">{notice}</div>}
        {!account ? (
          <section className="connect-panel"><p className="eyebrow">LOCAL MVP</p><h1>시간이 흐른 만큼만<br />정산하세요.</h1><p>MetaMask를 로컬 Hardhat 네트워크에 연결하면 데모 포인트 정산을 시작할 수 있습니다.</p><button className="button primary" onClick={connectWallet}>MetaMask 연결</button></section>
        ) : selected ? (
          <SettlementDetail account={account} busy={busy} chainNow={chainNow} settlement={selected} onBack={() => setSelectedId(undefined)} onWithdraw={(id) => void send("withdraw", [id])} onCancel={(id) => void send("cancel", [id])} />
        ) : (
          <><div className="hero-row"><div><p className="eyebrow">DASHBOARD</p><h1>안녕하세요.</h1><p>로컬 체인에 기록된 내 정산을 확인하세요.</p></div><button className="button primary" onClick={() => setDialog("choose")}>새 정산 만들기</button></div><Dashboard account={account} settlements={settlements} onSelectSettlement={(item) => setSelectedId(item.id)} /></>
        )}
      </div>
      {dialog === "choose" && <CreateSettlementDialog onClose={() => setDialog(null)} onChooseLeader={() => setDialog("leader")} onChooseMember={() => setDialog("join")} />}
      {dialog === "leader" && <CreateSettlementDialog mode="leader" plans={SERVICE_PLANS} busy={busy} onClose={() => setDialog(null)} onChooseLeader={() => undefined} onChooseMember={() => undefined} onCreate={(plan) => void createSettlement(plan)} />}
      {dialog === "join" && <JoinSettlementDialog busy={busy} lookupSettlement={lookupSettlement} onClose={() => setDialog(null)} onJoin={(code, preview) => void joinSettlement(code, preview)} />}
      {createdInvite && <div className="dialog-backdrop" role="presentation"><section className="dialog invite-result" role="dialog" aria-modal="true" aria-labelledby="invite-title"><p className="eyebrow">정산 생성 완료</p><h2 id="invite-title">참여 코드는 한 번만 보여드려요.</h2><div className="invite-code">{createdInvite}</div><button className="button primary full" onClick={() => void navigator.clipboard.writeText(createdInvite)}>코드 복사</button><button className="text-button" onClick={() => setCreatedInvite(undefined)}>확인하고 닫기</button></section></div>}
    </AppShell>
  );
}
