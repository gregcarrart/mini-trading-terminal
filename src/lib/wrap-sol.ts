import { PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";

const LAMPORTS_PER_SOL = 1e9;

export function getWrapSolInstructions(params: {
  payer: PublicKey;
  amountLamports: bigint;
}): TransactionInstruction[] {
  const { payer, amountLamports } = params;
  if (amountLamports <= BigInt(0)) return [];

  const wsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, payer, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  return [
    createAssociatedTokenAccountIdempotentInstruction(payer, wsolAta, payer, NATIVE_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    SystemProgram.transfer({ fromPubkey: payer, toPubkey: wsolAta, lamports: Number(amountLamports) }),
    createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM_ID),
  ];
}

export function buildWrapSolTransaction(params: {
  payer: PublicKey;
  amountSol: number;
}): Transaction {
  const { payer, amountSol } = params;
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  if (lamports <= 0) throw new Error("Amount must be greater than 0");
  return new Transaction().add(...getWrapSolInstructions({ payer, amountLamports: BigInt(lamports) }));
}
