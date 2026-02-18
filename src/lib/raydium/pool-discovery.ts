import { Connection, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import {
  RAYDIUM_CLMM_PROGRAM_ID,
  POOL_LAYOUT,
  MIN_POOL_DATA_LENGTH,
  POOL_STATE_DATA_SIZE,
  readU16,
  readI32,
  readU128,
  readPubkey,
  type ParsedPoolState,
  type ProgramAccount,
} from "./constants";

// --- Pool state parsing ---

export function parsePoolState(poolId: PublicKey, data: Buffer): ParsedPoolState {
  const tickArrayBitmap = new Uint8Array(128);
  tickArrayBitmap.set(data.subarray(POOL_LAYOUT.tick_array_bitmap, POOL_LAYOUT.tick_array_bitmap + 128));
  return {
    poolId,
    ammConfig: readPubkey(data, POOL_LAYOUT.amm_config),
    tokenMint0: readPubkey(data, POOL_LAYOUT.token_mint_0),
    tokenMint1: readPubkey(data, POOL_LAYOUT.token_mint_1),
    tokenVault0: readPubkey(data, POOL_LAYOUT.token_vault_0),
    tokenVault1: readPubkey(data, POOL_LAYOUT.token_vault_1),
    observationKey: readPubkey(data, POOL_LAYOUT.observation_key),
    tickSpacing: readU16(data, POOL_LAYOUT.tick_spacing),
    tickCurrent: readI32(data, POOL_LAYOUT.tick_current),
    tickArrayBitmap,
    status: data[POOL_LAYOUT.status],
    liquidity: readU128(data, POOL_LAYOUT.liquidity),
  };
}

// --- Paginated RPC helper (Helius getProgramAccountsV2) ---

async function getProgramAccountsV2Paginated(
  rpcUrl: string,
  programId: PublicKey,
  filters: Array<{ memcmp: { offset: number; bytes: string } } | { dataSize: number }>,
  limit = 2000,
  maxPages?: number
): Promise<ProgramAccount[]> {
  const out: ProgramAccount[] = [];
  let paginationKey: string | null = null;
  let pageCount = 0;
  do {
    if (maxPages != null && pageCount >= maxPages) break;
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        method: "getProgramAccountsV2",
        params: [
          programId.toBase58(),
          {
            encoding: "base64",
            filters,
            limit,
            ...(paginationKey != null && { paginationKey }),
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`RPC error: ${res.status}`);
    const json = (await res.json()) as {
      result?: { accounts?: Array<{ pubkey: string; account: { data: string } }>; paginationKey?: string | null };
      error?: { message: string };
    };
    if (json.error) throw new Error(json.error.message ?? "RPC error");
    const result = json.result;
    for (const a of result?.accounts ?? []) {
      out.push({
        pubkey: new PublicKey(a.pubkey),
        account: { data: Buffer.from(typeof a.account?.data === "string" ? a.account.data : "", "base64") },
      });
    }
    paginationKey = result?.paginationKey ?? null;
    pageCount += 1;
  } while (paginationKey != null && paginationKey !== "");
  return out;
}

function isHeliusRpc(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes("helius") || u.includes("helius-rpc");
}

// Fallback pool addresses for tokens where getProgramAccounts filtering is unreliable
const KNOWN_POOLS: Record<string, string[]> = {
  "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN": [
    "GQsPr4RJk9AZkkfWHud7v4MtotcxhaYzZHdsPCg9vNvW", // SOL/TRUMP — high liquidity
    "Gh5mLAgRyxTejgdiv4bJTbonPWS98sCXwef4joLLmaDx", // TRUMP/SOL — low liquidity
  ],
};

function filterPoolAccounts(
  accounts: ProgramAccount[],
  otherMintStr: string,
  otherMintOffset: number
): ParsedPoolState[] {
  const pools: ParsedPoolState[] = [];
  for (const { pubkey, account } of accounts) {
    const data = account.data;
    if (data.length < MIN_POOL_DATA_LENGTH) continue;
    if (readPubkey(data, otherMintOffset).toBase58() !== otherMintStr) continue;
    if ((data[POOL_LAYOUT.status] & (1 << 4)) !== 0) continue;
    pools.push(parsePoolState(pubkey, data));
  }
  return pools;
}

// --- Main pool discovery entrypoint ---

export async function fetchClmmPoolsForToken(
  connection: Connection,
  tokenMint: PublicKey
): Promise<ParsedPoolState[]> {
  const solStr = NATIVE_MINT.toBase58();
  const tokenStr = tokenMint.toBase58();
  const rpcUrl = import.meta.env.VITE_HELIUS_RPC_URL as string | undefined;
  const useV2 = rpcUrl && isHeliusRpc(rpcUrl);

  const memcmp0 = { memcmp: { offset: POOL_LAYOUT.token_mint_0, bytes: tokenStr } } as const;
  const memcmp1 = { memcmp: { offset: POOL_LAYOUT.token_mint_1, bytes: tokenStr } } as const;
  const sizeFilter = { dataSize: POOL_STATE_DATA_SIZE } as const;

  let accounts: ProgramAccount[];
  let accounts1: ProgramAccount[];

  if (useV2) {
    accounts = await getProgramAccountsV2Paginated(rpcUrl.trim(), RAYDIUM_CLMM_PROGRAM_ID, [sizeFilter, memcmp0], 1000);
    accounts1 = await getProgramAccountsV2Paginated(rpcUrl.trim(), RAYDIUM_CLMM_PROGRAM_ID, [sizeFilter, memcmp1], 1000);
    if (accounts.length === 0 && accounts1.length === 0) {
      const [f0, f1] = await Promise.all([
        getProgramAccountsV2Paginated(rpcUrl.trim(), RAYDIUM_CLMM_PROGRAM_ID, [memcmp0], 2000, 5),
        getProgramAccountsV2Paginated(rpcUrl.trim(), RAYDIUM_CLMM_PROGRAM_ID, [memcmp1], 2000, 5),
      ]);
      accounts = f0;
      accounts1 = f1;
    }
  } else {
    const [a, a1] = await Promise.all([
      connection.getProgramAccounts(RAYDIUM_CLMM_PROGRAM_ID, { filters: [sizeFilter, memcmp0] }),
      connection.getProgramAccounts(RAYDIUM_CLMM_PROGRAM_ID, { filters: [sizeFilter, memcmp1] }),
    ]);
    accounts = a.map(({ pubkey, account }) => ({ pubkey, account: { data: Buffer.from(account.data) } }));
    accounts1 = a1.map(({ pubkey, account }) => ({ pubkey, account: { data: Buffer.from(account.data) } }));
  }

  const pools = [
    ...filterPoolAccounts(accounts, solStr, POOL_LAYOUT.token_mint_1),
    ...filterPoolAccounts(accounts1, solStr, POOL_LAYOUT.token_mint_0),
  ];

  if (pools.length === 0 && KNOWN_POOLS[tokenStr]) {
    for (const addr of KNOWN_POOLS[tokenStr]) {
      try {
        const acc = await connection.getAccountInfo(new PublicKey(addr));
        if (!acc?.data || acc.owner?.toBase58() !== RAYDIUM_CLMM_PROGRAM_ID.toBase58()) continue;
        const data = Buffer.from(acc.data);
        if (data.length < MIN_POOL_DATA_LENGTH) continue;
        const m0 = readPubkey(data, POOL_LAYOUT.token_mint_0).toBase58();
        const m1 = readPubkey(data, POOL_LAYOUT.token_mint_1).toBase58();
        if (!(m0 === tokenStr || m1 === tokenStr)) continue;
        if (!(m0 === solStr || m1 === solStr)) continue;
        if ((data[POOL_LAYOUT.status] & (1 << 4)) !== 0) continue;
        pools.push(parsePoolState(new PublicKey(addr), data));
      } catch { /* skip */ }
    }
  }

  pools.sort((a, b) => Number(b.liquidity - a.liquidity));
  return pools;
}
