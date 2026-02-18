import { useCallback, useRef } from "react";
import { useInstantTradeStore } from "@/store/instant-trade-store";

const MIN_WIDTH = 280;
const MIN_HEIGHT = 320;
const MAX_WIDTH = 600;
const MAX_HEIGHT = 700;

export function usePanelInteraction() {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);

  const setPosition = useInstantTradeStore((s) => s.setPosition);
  const setSize = useInstantTradeStore((s) => s.setSize);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const panel = panelRef.current;
      if (!panel) return;

      isDragging.current = true;
      const rect = panel.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      const onMove = (ev: PointerEvent) => {
        if (!isDragging.current || !panel) return;
        const x = Math.max(
          0,
          Math.min(window.innerWidth - panel.offsetWidth, ev.clientX - offsetX)
        );
        const y = Math.max(
          0,
          Math.min(
            window.innerHeight - panel.offsetHeight,
            ev.clientY - offsetY
          )
        );
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
      };

      const onUp = () => {
        isDragging.current = false;
        if (panel) {
          setPosition({
            x: parseFloat(panel.style.left),
            y: parseFloat(panel.style.top),
          });
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [setPosition]
  );

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const panel = panelRef.current;
      if (!panel) return;

      isResizing.current = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const originW = panel.offsetWidth;
      const originH = panel.offsetHeight;

      const onMove = (ev: PointerEvent) => {
        if (!isResizing.current || !panel) return;
        const newW = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, originW + (ev.clientX - startX))
        );
        const newH = Math.max(
          MIN_HEIGHT,
          Math.min(MAX_HEIGHT, originH + (ev.clientY - startY))
        );
        panel.style.width = `${newW}px`;
        panel.style.height = `${newH}px`;
      };

      const onUp = () => {
        isResizing.current = false;
        if (panel) {
          setSize({
            width: panel.offsetWidth,
            height: panel.offsetHeight,
          });
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [setSize]
  );

  return { panelRef, onDragStart, onResizeStart };
}
