import { create } from "zustand";

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 420;

interface InstantTradePanelState {
  isOpen: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  buyAmount: string;
  sellPercentage: string;

  toggle: () => void;
  open: () => void;
  close: () => void;
  setPosition: (position: { x: number; y: number }) => void;
  setSize: (size: { width: number; height: number }) => void;
  setBuyAmount: (amount: string) => void;
  setSellPercentage: (percentage: string) => void;
}

export const useInstantTradeStore = create<InstantTradePanelState>((set) => ({
  isOpen: false,
  position: {
    x: Math.max(0, typeof window !== "undefined" ? window.innerWidth - DEFAULT_WIDTH - 24 : 0),
    y: 120,
  },
  size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  buyAmount: "",
  sellPercentage: "",

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setPosition: (position) => set({ position }),
  setSize: (size) => set({ size }),
  setBuyAmount: (amount) => set({ buyAmount: amount }),
  setSellPercentage: (percentage) => set({ sellPercentage: percentage }),
}));
