import { useEffect, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { ReceiptPrinter } from "./ReceiptPrinter";
import "./receipt-printer.css";

type DemoPrintState = "idle" | "printing" | "resetting" | "complete";

export function ReceiptPrinterScreen() {
  const [printState, setPrintState] = useState<DemoPrintState>("idle");
  const [resetSignal, setResetSignal] = useState(0);
  const replayTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (replayTimer.current !== null) {
        window.clearTimeout(replayTimer.current);
      }
    };
  }, []);

  function handlePrint() {
    if (printState === "printing" || printState === "resetting") return;

    if (printState === "complete") {
      setPrintState("resetting");
      setResetSignal((value) => value + 1);
      replayTimer.current = window.setTimeout(() => {
        setPrintState("printing");
      }, 420);
      return;
    }

    setPrintState("printing");
  }

  const isBusy = printState === "printing" || printState === "resetting";
  const isComplete = printState === "complete";

  return (
    <main className="receipt-printer-screen">
      <div className="receipt-printer-screen__inner">
        <ReceiptPrinter
          isPrinting={printState === "printing"}
          resetSignal={resetSignal}
          onPullToReveal={handlePrint}
          onPrintComplete={() => setPrintState("complete")}
        />

        {isComplete ? (
          <div className="receipt-printer-screen__controls">
            <Button
              type="button"
              className="receipt-printer-screen__button"
              disabled={isBusy}
              onClick={handlePrint}
              aria-label="Print receipt again"
            >
              <RefreshCcw size={16} strokeWidth={2} />
              PRINT AGAIN
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
