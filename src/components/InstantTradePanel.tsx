import { memo, useCallback } from "react";
import { toast } from "sonner";
import { X, GripHorizontal, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EnhancedToken } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { useBalance } from "@/hooks/use-balance";
import { useTrade } from "@/hooks/use-trade";
import { useInstantTradeStore } from "@/store/instant-trade-store";
import { usePanelInteraction } from "@/hooks/use-panel-interaction";
import {
  confirmTransaction,
  createConnection,
  getKeypairOrNull,
  sendTransaction,
  signTransaction,
} from "@/lib/solana";

interface InstantTradePanelProps {
  token: EnhancedToken;
}

const SOL_PRESETS = [0.00001, 0.001, 0.1, 1];
const SELL_PRESETS = [10, 25, 50, 100];

const InstantTradePanel = memo(function InstantTradePanel({
  token,
}: InstantTradePanelProps) {
  const {
    position,
    size,
    buyAmount,
    sellPercentage,
    close,
    setBuyAmount,
    setSellPercentage,
  } = useInstantTradeStore();

  const { panelRef, onDragStart, onResizeStart } = usePanelInteraction();

  const {
    nativeBalance: solBalance,
    tokenBalance,
    tokenAtomicBalance,
    loading: balanceLoading,
    refreshBalance,
  } = useBalance(
    token.address,
    Number(token.decimals),
    9,
    Number(token.networkId)
  );

  const { createTransaction } = useTrade(token.address, tokenAtomicBalance);
  const keypair = getKeypairOrNull(import.meta.env.VITE_SOLANA_PRIVATE_KEY);
  const connection = createConnection();

  const handleTrade = useCallback(
    async (direction: "buy" | "sell") => {
      if (!keypair) return;
      const value =
        direction === "buy"
          ? parseFloat(buyAmount)
          : parseFloat(sellPercentage);

      if (!value || value <= 0) return;

      const toastId = toast.loading(
        `${direction === "buy" ? "Buying" : "Selling"} ${token.symbol}...`
      );

      try {
        const transaction = await createTransaction({
          direction,
          value,
          signer: keypair.publicKey,
        });

        toast.loading("Signing...", { id: toastId });
        const signedTx = signTransaction(keypair, transaction);

        toast.loading("Sending...", { id: toastId });
        const signature = await sendTransaction(signedTx, connection);

        toast.loading("Confirming...", { id: toastId });
        const confirmation = await confirmTransaction(signature, connection);

        if (confirmation.value.err) {
          throw new Error("Trade failed on-chain");
        }

        toast.success(`Done! TX: ${signature.slice(0, 8)}...`, { id: toastId });
        setTimeout(refreshBalance, 1000);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(message, { id: toastId });
      }
    },
    [
      buyAmount,
      sellPercentage,
      createTransaction,
      keypair,
      connection,
      refreshBalance,
      token.symbol,
    ]
  );

  const canBuy =
    !!keypair &&
    !balanceLoading &&
    buyAmount !== "" &&
    parseFloat(buyAmount) > 0;
  const canSell =
    !!keypair &&
    !balanceLoading &&
    sellPercentage !== "" &&
    parseFloat(sellPercentage) > 0;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 flex flex-col border border-border bg-[oklch(0.12_0_0)] shadow-2xl shadow-black/50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Drag handle / header */}
      <div
        onPointerDown={onDragStart}
        className="flex items-center justify-between px-3 py-2 border-b border-border cursor-grab active:cursor-grabbing shrink-0"
      >
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Zap size={14} className="text-yellow-400" />
          <span>Instant Trade</span>
        </div>
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} className="text-muted-foreground" />
          <button
            onClick={close}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Balance bar */}
        <div className="flex gap-2 text-xs">
          <div className="flex-1 bg-muted/30 px-2 py-1.5 rounded-sm truncate">
            <span className="text-muted-foreground">SOL </span>
            <span className="font-semibold">{solBalance.toFixed(4)}</span>
          </div>
          {token.symbol && (
            <div className="flex-1 bg-muted/30 px-2 py-1.5 rounded-sm truncate">
              <span className="text-muted-foreground">{token.symbol} </span>
              <span className="font-semibold">
                {tokenBalance < 0.001 && tokenBalance > 0
                  ? tokenBalance.toExponential(2)
                  : tokenBalance < 1
                    ? tokenBalance.toFixed(6)
                    : tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </div>
          )}
        </div>

        {!keypair && (
          <p className="text-xs text-muted-foreground">
            Set VITE_SOLANA_PRIVATE_KEY in .env (base58) to trade.
          </p>
        )}

        {/* Buy section */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-green-400">Buy</label>
          <div className="flex gap-1.5">
            {SOL_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setBuyAmount(preset.toString())}
                className={cn(
                  "flex-1 py-1 text-xs font-medium rounded-sm transition-all cursor-pointer",
                  buyAmount === preset.toString()
                    ? "bg-green-500/25 text-green-400 border border-green-500/40"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <Input
            type="number"
            placeholder="0.00 SOL"
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
            min="0"
            step="0.00001"
            className="h-8 text-sm"
          />
          <div className="text-[11px] text-muted-foreground">
            Available: {solBalance.toFixed(4)} SOL
          </div>
          <button
            onClick={() => handleTrade("buy")}
            disabled={!canBuy}
            className="w-full py-2 text-sm font-bold rounded-sm bg-green-500 hover:bg-green-600 text-white disabled:bg-green-500/20 disabled:text-green-500/40 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            Buy {token.symbol || "Token"}
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-2" />

        {/* Sell section */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-red-400">Sell</label>
          <div className="flex gap-1.5">
            {SELL_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setSellPercentage(preset.toString())}
                className={cn(
                  "flex-1 py-1 text-xs font-medium rounded-sm transition-all cursor-pointer",
                  sellPercentage === preset.toString()
                    ? "bg-red-500/25 text-red-400 border border-red-500/40"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                {preset}%
              </button>
            ))}
          </div>
          <Input
            type="number"
            placeholder="0 %"
            value={sellPercentage}
            onChange={(e) => setSellPercentage(e.target.value)}
            min="0"
            max="100"
            step="1"
            className="h-8 text-sm"
          />
          {sellPercentage && tokenBalance > 0 && (
            <div className="text-[11px] text-muted-foreground">
              Selling:{" "}
              {(
                (tokenBalance * parseFloat(sellPercentage)) /
                100
              ).toLocaleString()}{" "}
              {token.symbol}
            </div>
          )}
          <button
            onClick={() => handleTrade("sell")}
            disabled={!canSell}
            className="w-full py-2 text-sm font-bold rounded-sm bg-red-500 hover:bg-red-600 text-white disabled:bg-red-500/20 disabled:text-red-500/40 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            Sell {token.symbol || "Token"}
          </button>
        </div>
      </div>

      {/* Resize handle */}
      <div
        onPointerDown={onResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5"
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          className="text-muted-foreground/50"
        >
          <path
            d="M6 0L8 0L8 2ZM3 5L8 0L8 5ZM0 8L8 0L8 8Z"
            fill="currentColor"
            opacity="0.4"
          />
        </svg>
      </div>
    </div>
  );
});

export { InstantTradePanel };
