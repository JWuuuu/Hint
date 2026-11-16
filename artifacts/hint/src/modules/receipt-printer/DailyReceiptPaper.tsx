import { useMemo } from "react";
import type { TarotReceiptModel } from "../tarot/logic/shareReceipt";
import { buildDailyReceiptArtwork } from "./dailyReceiptArtwork";

export function DailyReceiptPaper({ model }: { model: TarotReceiptModel }) {
  const artwork = useMemo(() => {
    try {
      const context = document.createElement("canvas").getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      return buildDailyReceiptArtwork(model, (text, size, weight) => {
        context.font = `${weight} ${size}px Georgia, "Times New Roman", serif`;
        return context.measureText(text).width;
      }, undefined, true);
    } catch {
      // Keep the dialog open so export preparation can report its retry state.
      return null;
    }
  }, [model]);
  // Every model value is XML-escaped by the shared artwork renderer.
  return <div className="daily-receipt-paper" data-testid="daily-receipt-paper" dangerouslySetInnerHTML={{ __html: artwork?.svg ?? "" }} />;
}
