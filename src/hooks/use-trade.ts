import { useCallback } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { VersionedTransaction } from "@solana/web3.js";
import { fetchClmmPoolsForToken, buildClmmSwapTransaction } from "@/lib/raydium";
import { createConnection } from "@/lib/solana";

export const useTrade = (tokenAddress: string, tokenAtomicBalance: Decimal) => {
  const createTransaction = useCallback(
    async (params: {
      direction: "buy" | "sell";
      value: number;
      signer: PublicKey;
    }): Promise<VersionedTransaction> => {
      const { direction, value, signer } = params;

      const amountIn = direction === "buy"
        ? BigInt(new Decimal(value).mul(LAMPORTS_PER_SOL).trunc().toFixed(0))
        : BigInt(tokenAtomicBalance.mul(value).div(100).trunc().toFixed(0));

      if (amountIn <= BigInt(0)) throw new Error("Amount must be greater than zero");

      const connection = createConnection();
      const tokenMint = new PublicKey(tokenAddress);
      const pools = await fetchClmmPoolsForToken(connection, tokenMint);

      if (pools.length === 0) {
        const mintStr = tokenMint.toBase58();
        throw new Error(
          `No Raydium CLMM pool found for ${mintStr.slice(0, 8)}…${mintStr.slice(-4)}. Ensure mainnet RPC and a valid CLMM pool.`
        );
      }

      return buildClmmSwapTransaction({
        connection,
        pool: pools[0],
        payer: signer,
        amountIn,
        minAmountOut: BigInt(0),
        direction,
        tokenMint,
      });
    },
    [tokenAddress, tokenAtomicBalance]
  );

  return { createTransaction };
};
