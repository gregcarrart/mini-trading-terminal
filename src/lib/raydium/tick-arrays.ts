import { PublicKey } from "@solana/web3.js";
import {
  RAYDIUM_CLMM_PROGRAM_ID,
  TICK_ARRAY_SEED,
  TICK_ARRAY_BITMAP_EXTENSION_SEED,
  TICK_ARRAY_SIZE,
} from "./constants";

export function getArrayStartIndex(tickIndex: number, tickSpacing: number): number {
  const ticksInArray = TICK_ARRAY_SIZE * tickSpacing;
  return Math.floor(tickIndex / ticksInArray) * ticksInArray;
}

export function getTickArrayPda(poolId: PublicKey, startTickIndex: number): PublicKey {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(startTickIndex, 0);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(TICK_ARRAY_SEED, "utf8"), poolId.toBuffer(), buf],
    RAYDIUM_CLMM_PROGRAM_ID
  );
  return pda;
}

export function getTickArrayBitmapExtensionPda(poolId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(TICK_ARRAY_BITMAP_EXTENSION_SEED, "utf8"), poolId.toBuffer()],
    RAYDIUM_CLMM_PROGRAM_ID
  );
  return pda;
}

export function getTickArrayStartIndicesForSwap(
  tickCurrent: number,
  tickSpacing: number,
  zeroForOne: boolean,
  maxArrays: number
): number[] {
  const ticksInArray = TICK_ARRAY_SIZE * tickSpacing;
  const currentStart = getArrayStartIndex(tickCurrent, tickSpacing);
  const result: number[] = [currentStart];
  const step = zeroForOne ? -ticksInArray : ticksInArray;
  let cursor = currentStart;
  while (result.length < maxArrays) {
    cursor += step;
    if (cursor < -443636 || cursor > 443636) break;
    result.push(cursor);
  }
  return result;
}
