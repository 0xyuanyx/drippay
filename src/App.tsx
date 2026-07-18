import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { InviteResultDialog } from "./components/InviteResultDialog";
import { SettlementDetail } from "./components/SettlementDetail";
import { POINT_TOKEN, TIME_SETTLEMENT } from "./contracts";
import { generateInviteCode, hashInviteCode, normalizeInviteCode } from "./lib/inviteCode";
import {
  HARDHAT_CHAIN_ID,
  InsufficientDemoPointsError,
  MissingLocalGasError,
  WRONG_NETWORK_NOTICE,
  WrongNetworkError,
  listenForChainChanges,
  readWalletChainId,
  runSafeHardhatWrite,
} from "./lib/hardhatNetwork";
import { createLatestRequestGuard, type LatestRequestGuard } from "./lib/latestRequestGuard";
import { useSettlementPolling } from "./lib/useSettlementPolling";
import { clearWalletSession, markWalletSession, restoreWalletSession } from "./lib/walletSession";
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
  const [walletChainId, setWalletChainId] = useState<number>();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [settlements, setSettlements] = useState<SettlementView[]>([]);
  const [selectedId, setSelectedId] = useState<bigint>();
  const [createdInvite, setCreatedInvite] = useState<string>();
  const [hiddenSettlementIds, setHiddenSettlementIds] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem("drippay.hidden-settlements");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const accountRef = useRef<Address>();
  const connectionActiveRef = useRef(false);
  const refreshGuardRef = useRef<LatestRequestGuard<Address>>();

  accountRef.current = account;
  refreshGuardRef.current ??= createLatestRequestGuard(
    () => accountRef.current,
    sameAddress,
  );

  const walletClient = useMemo(() => {
    if (!window.ethereum || !account) return null;
    return createWalletClient({ account, chain: hardhat, transport: custom(window.ethereum) });
  }, [account]);

  useEffect(() => {
    const provider = window.ethereum as MetaMaskProvider | undefined;
    const handleAccounts = (value: unknown) => {
      if (!connectionActiveRef.current) return;
      const [nextAccount] = value as Address[];
      if (!nextAccount) {
        connectionActiveRef.current = false;
        clearWalletSession(window.sessionStorage);
      }
      accountRef.current = nextAccount;
      refreshGuardRef.current?.invalidate();
      setAccount(nextAccount);
      setSelectedId(undefined);
      setDialog(null);
    };
    const stopChainListener = provider
      ? listenForChainChanges(provider, (nextChainId) => {
          setWalletChainId(nextChainId);
          refreshGuardRef.current?.invalidate();
          if (accountRef.current && nextChainId !== HARDHAT_CHAIN_ID) {
            setNotice(WRONG_NETWORK_NOTICE);
          } else if (nextChainId === HARDHAT_CHAIN_ID) {
            setNotice("");
          }
        })
      : () => undefined;
    provider?.on?.("accountsChanged", handleAccounts);
    return () => {
      provider?.removeListener?.("accountsChanged", handleAccounts);
      stopChainListener();
      refreshGuardRef.current?.invalidate();
    };
  }, []);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    let active = true;
    void restoreWalletSession(provider, window.sessionStorage).then((session) => {
      if (!active || !session) return;
      connectionActiveRef.current = true;
      accountRef.current = session.account;
      refreshGuardRef.current?.invalidate();
      setWalletChainId(session.chainId);
      setAccount(session.account);
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async (activeAccount: Address) => {
    const request = refreshGuardRef.current!.begin(activeAccount);
    try {
      const [pointBalance, nextId, latestBlock] = await Promise.all([
        publicClient.readContract({ ...POINT_TOKEN, functionName: "balanceOf", args: [activeAccount] }),
        publicClient.readContract({ ...TIME_SETTLEMENT, functionName: "nextSettlementId" }),
        publicClient.getBlock({ blockTag: "latest" }),
      ]);
      const reads = Array.from({ length: Number(nextId - 1n) }, (_, index) => BigInt(index + 1)).map(async (id) => {
        const terms = await publicClient.readContract({ ...TIME_SETTLEMENT, functionName: "getSettlement", args: [id] }) as SettlementTerms;
        if (!sameAddress(terms.payee, activeAccount) && (terms.payer === zeroAddress || !sameAddress(terms.payer, activeAccount))) return null;
        const [earned, withdrawable, refundable] = await publicClient.readContract({ ...TIME_SETTLEMENT, functionName: "getFinancials", args: [id] });
        return { id, terms, earned, withdrawable, refundable } satisfies SettlementView;
      });
      const nextSettlements = (await Promise.all(reads)).filter((item): item is SettlementView => item !== null);
      if (!request.isCurrent()) return;

      setBalance(pointBalance);
      setChainNow(latestBlock.timestamp);
      setSettlements(nextSettlements);
    } catch {
      if (request.isCurrent()) {
        setNotice("로컬 노드와 배포 상태를 확인해 주세요.");
      }
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
      const currentChainId = await readWalletChainId(window.ethereum);
      setWalletChainId(currentChainId);
      if (currentChainId !== HARDHAT_CHAIN_ID) {
        throw new WrongNetworkError(currentChainId);
      }
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const addresses = await window.ethereum.request({ method: "eth_requestAccounts" }) as Address[];
      if (addresses[0]) {
        connectionActiveRef.current = true;
        accountRef.current = addresses[0];
        refreshGuardRef.current?.invalidate();
        markWalletSession(window.sessionStorage);
        setAccount(addresses[0]);
      }
    } catch (error) {
      setNotice(error instanceof WrongNetworkError ? error.message : "지갑 연결이 취소되었거나 Hardhat 네트워크에 연결할 수 없습니다.");
    }
  }

  function disconnectWallet() {
    connectionActiveRef.current = false;
    clearWalletSession(window.sessionStorage);
    accountRef.current = undefined;
    refreshGuardRef.current?.invalidate();
    setAccount(undefined);
    setBalance(0n);
    setChainNow(0n);
    setWalletChainId(undefined);
    setSettlements([]);
    setSelectedId(undefined);
    setDialog(null);
    setCreatedInvite(undefined);
    setBusy(false);
    setNotice("");
  }

  function showTransactionError(error: unknown, fallback: string) {
    if (error instanceof WrongNetworkError) {
      setWalletChainId(error.chainId);
      setNotice(error.message);
      return;
    }
    if (error instanceof MissingLocalGasError || error instanceof InsufficientDemoPointsError) {
      setNotice(error.message);
      return;
    }
    setNotice(fallback);
  }

  function submitWalletWrite<T>(
    provider: EIP1193Provider,
    activeAccount: Address,
    write: () => Promise<T>,
    requiredPoints = 0n,
  ) {
    return runSafeHardhatWrite(
      provider,
      {
        getGasBalance: () => publicClient.getBalance({ address: activeAccount }),
        getPointBalance: requiredPoints > 0n
          ? () => publicClient.readContract({ ...POINT_TOKEN, functionName: "balanceOf", args: [activeAccount] })
          : undefined,
        requiredPoints,
      },
      write,
    );
  }

  async function send(functionName: "withdraw" | "cancel", args: readonly [bigint]) {
    const provider = window.ethereum;
    if (!walletClient || !account || !provider) return;
    setBusy(true);
    setNotice("");
    try {
      const hash = await submitWalletWrite(provider, account, () =>
        walletClient.writeContract({ ...TIME_SETTLEMENT, functionName, args }),
      );
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh(account);
      setNotice(functionName === "withdraw" ? "받을 포인트를 출금했습니다." : "정산을 취소하고 잔액을 반환했습니다.");
    } catch (error) {
      showTransactionError(error, "거래가 완료되지 않았습니다. MetaMask 내용을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function createSettlement(plan: ServicePlan) {
    const provider = window.ethereum;
    if (!walletClient || !account || !provider) return;
    const inviteCode = generateInviteCode();
    setBusy(true);
    setNotice("");
    try {
      const hash = await submitWalletWrite(provider, account, () =>
        walletClient.writeContract({
          ...TIME_SETTLEMENT,
          functionName: "createSettlement",
          args: [hashInviteCode(inviteCode), plan.name, parseUnits(String(plan.amount), 18), BigInt(plan.durationDays * 86400)],
        }),
      );
      await publicClient.waitForTransactionReceipt({ hash });
      setDialog(null);
      setCreatedInvite(inviteCode);
      await refresh(account);
    } catch (error) {
      showTransactionError(error, "정산 생성 거래가 완료되지 않았습니다.");
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
    const provider = window.ethereum;
    if (!walletClient || !account || !provider) return;
    setBusy(true);
    setNotice("");
    try {
      const approval = await submitWalletWrite(
        provider,
        account,
        () => walletClient.writeContract({ ...POINT_TOKEN, functionName: "approve", args: [TIME_SETTLEMENT.address, preview.terms.amount] }),
        preview.terms.amount,
      );
      await publicClient.waitForTransactionReceipt({ hash: approval });
      const join = await submitWalletWrite(
        provider,
        account,
        () => walletClient.writeContract({ ...TIME_SETTLEMENT, functionName: "joinSettlement", args: [normalizeInviteCode(code)] }),
        preview.terms.amount,
      );
      await publicClient.waitForTransactionReceipt({ hash: join });
      setDialog(null);
      await refresh(account);
      setSelectedId(preview.id);
      setNotice("포인트를 예치하고 정산에 참여했습니다.");
    } catch (error) {
      showTransactionError(error, "승인 또는 참여 거래가 완료되지 않았습니다.");
    } finally {
      setBusy(false);
    }
  }

  function hideSettlement(id: bigint) {
    const key = id.toString();
    setHiddenSettlementIds((current) => {
      if (current.includes(key)) return current;
      const next = [...current, key];
      window.localStorage.setItem("drippay.hidden-settlements", JSON.stringify(next));
      return next;
    });
    setSelectedId(undefined);
    setNotice("대시보드 목록에서 숨겼습니다. 블록체인 기록은 그대로 보관됩니다.");
  }

  function restoreSettlement(id: bigint) {
    const key = id.toString();
    setHiddenSettlementIds((current) => {
      const next = current.filter((item) => item !== key);
      window.localStorage.setItem("drippay.hidden-settlements", JSON.stringify(next));
      return next;
    });
    setNotice("정산을 대시보드 목록에 다시 표시했습니다.");
  }

  const selected = settlements.find((item) => item.id === selectedId);
  const visibleSettlements = settlements.filter((item) => !hiddenSettlementIds.includes(item.id.toString()));
  const balanceLabel = Math.floor(Number(formatUnits(balance, 18))).toLocaleString();
  const writesAllowed = Boolean(account && walletChainId === HARDHAT_CHAIN_ID);
  const networkReady = !account || writesAllowed;

  return (
    <AppShell address={account} balance={balanceLabel} connected={Boolean(account)} networkLabel={networkReady ? "Hardhat · 31337" : "다른 네트워크 · 거래 중지"} networkReady={networkReady} onConnect={connectWallet} onDisconnect={disconnectWallet}>
      <div className="page">
        {notice && <div className="notice" role="status">{notice}</div>}
        {!account ? (
          <section className="connect-panel"><p className="eyebrow">LOCAL MVP</p><h1>시간이 흐른 만큼만<br />정산하세요.</h1><p>MetaMask를 로컬 Hardhat 네트워크에 연결하면 데모 포인트 정산을 시작할 수 있습니다.</p><button className="button primary" onClick={connectWallet}>MetaMask 연결</button></section>
        ) : selected ? (
          <SettlementDetail account={account} busy={busy} writeDisabled={!writesAllowed} chainNow={chainNow} settlement={selected} onBack={() => setSelectedId(undefined)} onWithdraw={(id) => void send("withdraw", [id])} onCancel={(id) => void send("cancel", [id])} onHide={hideSettlement} />
        ) : (
          <><div className="hero-row"><div><p className="eyebrow">DASHBOARD</p><h1>안녕하세요.</h1><p>로컬 체인에 기록된 내 정산을 확인하세요.</p></div><button className="button primary" onClick={() => setDialog("choose")}>새 정산 만들기</button></div><Dashboard account={account} chainNow={chainNow} settlements={visibleSettlements} hiddenSettlements={settlements.filter((item) => hiddenSettlementIds.includes(item.id.toString()))} onRestoreSettlement={restoreSettlement} onSelectSettlement={(item) => setSelectedId(item.id)} /></>
        )}
      </div>
      {dialog === "choose" && <CreateSettlementDialog onClose={() => setDialog(null)} onChooseLeader={() => setDialog("leader")} onChooseMember={() => setDialog("join")} />}
      {dialog === "leader" && <CreateSettlementDialog mode="leader" plans={SERVICE_PLANS} busy={busy} writeDisabled={!writesAllowed} onClose={() => setDialog(null)} onChooseLeader={() => undefined} onChooseMember={() => undefined} onCreate={(plan) => void createSettlement(plan)} />}
      {dialog === "join" && <JoinSettlementDialog busy={busy} writeDisabled={!writesAllowed} lookupSettlement={lookupSettlement} onClose={() => setDialog(null)} onJoin={(code, preview) => void joinSettlement(code, preview)} />}
      {createdInvite && <InviteResultDialog inviteCode={createdInvite} onClose={() => setCreatedInvite(undefined)} />}
    </AppShell>
  );
}
