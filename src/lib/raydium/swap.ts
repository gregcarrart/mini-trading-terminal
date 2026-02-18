import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { getWrapSolInstructions } from "@/lib/wrap-sol";
import {
  RAYDIUM_CLMM_PROGRAM_ID,
  MEMO_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  SWAP_V2_DISCRIMINATOR,
  type ParsedPoolState,
} from "./constants";
import { getTickArrayStartIndicesForSwap, getTickArrayPda, getTickArrayBitmapExtensionPda } from "./tick-arrays";

function encodeSwapV2Data(
  amount: bigint,
  otherAmountThreshold: bigint,
  sqrtPriceLimitX64: bigint,
  isBaseInput: boolean
): Buffer {
  const buf = Buffer.alloc(41);
  let o = 0;
  buf.set(SWAP_V2_DISCRIMINATOR, o); o += 8;
  buf.writeBigUInt64LE(amount, o); o += 8;
  buf.writeBigUInt64LE(otherAmountThreshold, o); o += 8;
  buf.writeBigUInt64LE(sqrtPriceLimitX64 & BigInt("0xFFFFFFFFFFFFFFFF"), o);
  buf.writeBigUInt64LE(sqrtPriceLimitX64 >> BigInt(64), o + 8);
  o += 16;
  buf.writeUInt8(isBaseInput ? 1 : 0, o);
  return buf;
}

export async function buildClmmSwapTransaction(params: {
  connection: Connection;
  pool: ParsedPoolState;
  payer: PublicKey;
  amountIn: bigint;
  minAmountOut: bigint;
  direction: "buy" | "sell";
  tokenMint: PublicKey;
}): Promise<VersionedTransaction> {
  const { connection, pool, payer, amountIn, minAmountOut, direction, tokenMint } = params;

  const isBuy = direction === "buy";
  const inputMint = isBuy ? NATIVE_MINT : tokenMint;
  const outputMint = isBuy ? tokenMint : NATIVE_MINT;
  const zeroForOne = pool.tokenMint0.equals(inputMint);

  const inputVault = pool.tokenMint0.equals(inputMint) ? pool.tokenVault0 : pool.tokenVault1;
  const outputVault = pool.tokenMint0.equals(outputMint) ? pool.tokenVault0 : pool.tokenVault1;

  const inputTokenAccount = getAssociatedTokenAddressSync(inputMint, payer, false, TOKEN_PROGRAM_ID);
  const outputTokenAccount = getAssociatedTokenAddressSync(outputMint, payer, false, TOKEN_PROGRAM_ID);

  const tickArrayPdas = getTickArrayStartIndicesForSwap(pool.tickCurrent, pool.tickSpacing, zeroForOne, 10)
    .map((start) => getTickArrayPda(pool.poolId, start));

  const keys = [
    { pubkey: payer, isSigner: true, isWritable: false },
    { pubkey: pool.ammConfig, isSigner: false, isWritable: false },
    { pubkey: pool.poolId, isSigner: false, isWritable: true },
    { pubkey: inputTokenAccount, isSigner: false, isWritable: true },
    { pubkey: outputTokenAccount, isSigner: false, isWritable: true },
    { pubkey: inputVault, isSigner: false, isWritable: true },
    { pubkey: outputVault, isSigner: false, isWritable: true },
    { pubkey: pool.observationKey, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: MEMO_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: inputMint, isSigner: false, isWritable: false },
    { pubkey: outputMint, isSigner: false, isWritable: false },
    { pubkey: getTickArrayBitmapExtensionPda(pool.poolId), isSigner: false, isWritable: true },
    ...tickArrayPdas.map((p) => ({ pubkey: p, isSigner: false as const, isWritable: true as const })),
  ];

  const swapIx = new TransactionInstruction({
    programId: RAYDIUM_CLMM_PROGRAM_ID,
    keys,
    data: encodeSwapV2Data(amountIn, minAmountOut, BigInt(0), true),
  });

  const wrapIxs = isBuy ? getWrapSolInstructions({ payer, amountLamports: amountIn }) : [];
  const createAtaIx = isBuy
    ? createAssociatedTokenAccountIdempotentInstruction(payer, outputTokenAccount, payer, outputMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
    : null;

  const instructions = [...wrapIxs, ...(createAtaIx ? [createAtaIx] : []), swapIx];

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
