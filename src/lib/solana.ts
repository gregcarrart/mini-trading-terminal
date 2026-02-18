import { Connection, PublicKey, Keypair, VersionedTransaction, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import Decimal from "decimal.js";
import bs58 from "bs58";

export const createConnection = () => {
  const url = import.meta.env.VITE_HELIUS_RPC_URL;
  if (!url || typeof url !== "string" || !url.trim()) {
    throw new Error("VITE_HELIUS_RPC_URL is not set in .env.");
  }
  return new Connection(url.trim());
};

export const createKeypair = (privateKey: string) => {
  return Keypair.fromSecretKey(bs58.decode(privateKey));
};

export const getKeypairOrNull = (privateKey: string | undefined): Keypair | null => {
  if (!privateKey || typeof privateKey !== "string" || !privateKey.trim()) return null;
  try {
    return createKeypair(privateKey.trim());
  } catch {
    return null;
  }
};

export const getSolanaBalance = async (publicKey: string, connection: Connection): Promise<Decimal> => {
  const balance = await connection.getBalance(new PublicKey(publicKey));
  return new Decimal(balance);
};

export const getTokenBalance = async (
  publicKey: string,
  tokenAddress: string,
  connection: Connection,
): Promise<Decimal> => {
  try {
    const mint = new PublicKey(tokenAddress);
    const owner = new PublicKey(publicKey);
    const tokenAccountInfo = await connection.getAccountInfo(mint);
    if (!tokenAccountInfo) return new Decimal(0);

    const ata = getAssociatedTokenAddressSync(mint, owner, false, tokenAccountInfo.owner);
    try {
      const response = await connection.getTokenAccountBalance(ata);
      return new Decimal(response.value.amount);
    } catch {
      return new Decimal(0);
    }
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return new Decimal(0);
  }
};

export const signTransaction = (keypair: Keypair, transaction: VersionedTransaction): VersionedTransaction => {
  transaction.sign([keypair]);
  return transaction;
};

export const prepareLegacyTransaction = async (
  transaction: Transaction,
  connection: Connection,
  feePayer: PublicKey
): Promise<void> => {
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = feePayer;
};

export const signLegacyTransaction = (keypair: Keypair, transaction: Transaction): Transaction => {
  transaction.sign(keypair);
  return transaction;
};

export const sendTransaction = async (transaction: VersionedTransaction, connection: Connection) => {
  return connection.sendTransaction(transaction);
};

export const sendLegacyTransaction = async (transaction: Transaction, connection: Connection): Promise<string> => {
  const raw = transaction.serialize({ requireAllSignatures: true, verifySignatures: false });
  return connection.sendRawTransaction(raw, { skipPreflight: false });
};

export const confirmTransaction = async (signature: string, connection: Connection) => {
  const blockHash = await connection.getLatestBlockhash();
  return connection.confirmTransaction({
    signature,
    blockhash: blockHash.blockhash,
    lastValidBlockHeight: blockHash.lastValidBlockHeight,
  }, "confirmed");
};
