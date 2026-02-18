import { PublicKey } from "@solana/web3.js";

export const RAYDIUM_CLMM_PROGRAM_ID = new PublicKey(
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"
);

export const TICK_ARRAY_SEED = "tick_array";
export const TICK_ARRAY_BITMAP_EXTENSION_SEED = "pool_tick_array_bitmap_extension";
export const TICK_ARRAY_SIZE = 60;
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

// sha256("global:swap_v2")[0..8]
export const SWAP_V2_DISCRIMINATOR = new Uint8Array([43, 4, 237, 11, 26, 201, 30, 98]);

// Offsets verified against Raydium SDK V2 PoolInfoLayout
export const POOL_LAYOUT = {
  amm_config: 9,
  token_mint_0: 73,
  token_mint_1: 105,
  token_vault_0: 137,
  token_vault_1: 169,
  observation_key: 201,
  tick_spacing: 235,
  liquidity: 237,
  tick_current: 269,
  status: 389,
  tick_array_bitmap: 904,
} as const;

export const MIN_POOL_DATA_LENGTH = POOL_LAYOUT.tick_array_bitmap + 128;
export const POOL_STATE_DATA_SIZE = 1544;

export interface ParsedPoolState {
  poolId: PublicKey;
  ammConfig: PublicKey;
  tokenMint0: PublicKey;
  tokenMint1: PublicKey;
  tokenVault0: PublicKey;
  tokenVault1: PublicKey;
  observationKey: PublicKey;
  tickSpacing: number;
  tickCurrent: number;
  tickArrayBitmap: Uint8Array;
  status: number;
  liquidity: bigint;
}

export type ProgramAccount = { pubkey: PublicKey; account: { data: Buffer } };

// --- Binary readers ---

export function readU16(data: Buffer, offset: number): number {
  return data.readUInt16LE(offset);
}

export function readI32(data: Buffer, offset: number): number {
  return data.readInt32LE(offset);
}

export function readU128(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset) + (data.readBigUInt64LE(offset + 8) << BigInt(64));
}

export function readPubkey(data: Buffer, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + 32));
}
