import { useMemo } from "react";
import type { TarotReceiptModel } from "../tarot/logic/shareReceipt";
import { buildTarotReceiptArtwork } from "./tarotReceiptArtwork";

export function TarotReceiptPaper({ model }: { model: TarotReceiptModel }) {
  const artwork = useMemo(() => {
    try {
      const context = document.createElement("canvas").getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      return buildTarotReceiptArtwork(model, (text, size, weight) => {
        context.font = `${weight} ${size}px Georgia, "Times New Roman", serif`;
        return context.measureText(text).width;
      }, undefined, true);
    } catch {
      // Export preparation reports the error and offers retry/public fallback.
      // Oversized private copy must never crash the dialog or be silently cut.
      return null;
    }
  }, [model]);
  return <div className="tarot-receipt-paper" data-testid="tarot-receipt-paper" dangerouslySetInnerHTML={{ __html: artwork?.svg ?? "" }} />;
}
