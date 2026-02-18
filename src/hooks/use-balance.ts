import { useCallback, useEffect, useState } from "react";
import { createConnection, getKeypairOrNull, getTokenBalance } from "@/lib/solana";
import { getCodexClient } from "@/lib/codex";
import Decimal from "decimal.js";
import { Codex } from "@codex-data/sdk";

export const useBalance = (tokenAddress: string, tokenDecimals: number, nativeDecimals: number, networkId: number) => {
  const [nativeBalance, setNativeBalance] = useState<number>(0);
  const [nativeAtomicBalance, setNativeAtomicBalance] = useState<Decimal>(new Decimal(0));
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [tokenAtomicBalance, setTokenAtomicBalance] = useState<Decimal>(new Decimal(0));
  const [loading, setLoading] = useState<boolean>(true);
  const [codexClient, setCodexClient] = useState<Codex | null>(null);

  useEffect(() => {
    try { setCodexClient(getCodexClient()); } catch { setCodexClient(null); }
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      const keypair = getKeypairOrNull(import.meta.env.VITE_SOLANA_PRIVATE_KEY);
      const walletAddress = keypair?.publicKey.toBase58();
      setLoading(true);

      if (keypair && import.meta.env.VITE_HELIUS_RPC_URL) {
        try {
          const connection = createConnection();
          const lamports = await connection.getBalance(keypair.publicKey);
          const atomic = new Decimal(lamports);
          setNativeAtomicBalance(atomic);
          setNativeBalance(atomic.div(10 ** nativeDecimals).toNumber());
        } catch (err: unknown) {
          console.warn("SOL balance fetch failed:", err);
          setNativeAtomicBalance(new Decimal(0));
          setNativeBalance(0);
        }
      } else {
        setNativeAtomicBalance(new Decimal(0));
        setNativeBalance(0);
      }

      let tokenFound = false;
      if (keypair && import.meta.env.VITE_HELIUS_RPC_URL) {
        try {
          const connection = createConnection();
          const atomic = await getTokenBalance(walletAddress!, tokenAddress, connection);
          if (atomic.gt(0)) {
            setTokenAtomicBalance(atomic);
            setTokenBalance(atomic.div(10 ** tokenDecimals).toNumber());
            tokenFound = true;
          }
        } catch { /* fall through to Codex */ }
      }

      if (!tokenFound && codexClient && walletAddress) {
        const balanceResponse = await codexClient.queries.balances({
          input: { networks: [networkId], walletAddress, includeNative: false },
        });
        const item = balanceResponse?.balances?.items.find(
          (i) => i.tokenId === `${tokenAddress}:${networkId}`
        );
        if (item) {
          const atomic = new Decimal(item.balance);
          setTokenAtomicBalance(atomic);
          setTokenBalance(atomic.div(10 ** tokenDecimals).toNumber());
        } else {
          setTokenAtomicBalance(new Decimal(0));
          setTokenBalance(0);
        }
      } else if (!tokenFound) {
        setTokenAtomicBalance(new Decimal(0));
        setTokenBalance(0);
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, networkId, codexClient, nativeDecimals, tokenDecimals]);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  return { nativeBalance, nativeAtomicBalance, tokenBalance, tokenAtomicBalance, loading, refreshBalance };
};
