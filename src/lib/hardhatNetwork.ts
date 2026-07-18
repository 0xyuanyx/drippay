import type { EIP1193Provider } from "viem";

export const HARDHAT_CHAIN_ID = 31337;
export const WRONG_NETWORK_NOTICE =
  "Hardhat Local(31337) 네트워크로 변경해 주세요. 거래는 전송되지 않았습니다.";
export const MISSING_LOCAL_GAS_NOTICE =
  "현재 지갑에 로컬 테스트 ETH가 없어 거래를 보낼 수 없습니다. ETH가 지급된 Hardhat 테스트 계정을 사용해 주세요.";
export const INSUFFICIENT_DEMO_POINTS_NOTICE =
  "현재 지갑의 데모 포인트가 부족합니다. 포인트가 지급된 Hardhat 테스트 계정을 사용해 주세요.";

type RequestProvider = {
  request: EIP1193Provider["request"];
};

type ChainChangeProvider = RequestProvider & {
  on?: (event: string, listener: (value: unknown) => void) => void;
  removeListener?: (event: string, listener: (value: unknown) => void) => void;
};

export class WrongNetworkError extends Error {
  readonly chainId: number;

  constructor(chainId: number) {
    super(WRONG_NETWORK_NOTICE);
    this.name = "WrongNetworkError";
    this.chainId = chainId;
  }
}

export class MissingLocalGasError extends Error {
  constructor() {
    super(MISSING_LOCAL_GAS_NOTICE);
    this.name = "MissingLocalGasError";
  }
}

export class InsufficientDemoPointsError extends Error {
  constructor() {
    super(INSUFFICIENT_DEMO_POINTS_NOTICE);
    this.name = "InsufficientDemoPointsError";
  }
}

export function parseWalletChainId(value: unknown): number {
  if (typeof value !== "string") return Number.NaN;
  return Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
}

export async function readWalletChainId(
  provider: RequestProvider,
): Promise<number> {
  return parseWalletChainId(await provider.request({ method: "eth_chainId" }));
}

export async function runOnHardhatChain<T>(
  provider: RequestProvider,
  write: () => Promise<T>,
): Promise<T> {
  const chainId = await readWalletChainId(provider);
  if (chainId !== HARDHAT_CHAIN_ID) throw new WrongNetworkError(chainId);
  return write();
}

type LocalFundsPreflight = {
  getGasBalance: () => Promise<bigint>;
  getPointBalance?: () => Promise<bigint>;
  requiredPoints?: bigint;
};

export async function runSafeHardhatWrite<T>(
  provider: RequestProvider,
  preflight: LocalFundsPreflight,
  write: () => Promise<T>,
): Promise<T> {
  return runOnHardhatChain(provider, async () => {
    const requiredPoints = preflight.requiredPoints ?? 0n;
    if ((await preflight.getGasBalance()) === 0n) {
      throw new MissingLocalGasError();
    }
    if (
      requiredPoints > 0n &&
      (!preflight.getPointBalance ||
        (await preflight.getPointBalance()) < requiredPoints)
    ) {
      throw new InsufficientDemoPointsError();
    }
    return write();
  });
}

export function listenForChainChanges(
  provider: ChainChangeProvider,
  onChange: (chainId: number) => void,
): () => void {
  const listener = (value: unknown) => onChange(parseWalletChainId(value));
  provider.on?.("chainChanged", listener);
  return () => provider.removeListener?.("chainChanged", listener);
}
