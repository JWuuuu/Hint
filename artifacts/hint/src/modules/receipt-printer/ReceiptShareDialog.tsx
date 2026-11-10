import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Download, RotateCcw, Share2 } from "lucide-react";
import { Dialog, DialogPortal, DialogSurface, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { useLanguage } from "../../lib/i18n";
import { captureIdentityContext, getLocalDateString } from "../../lib/identity";
import { historyClearVersion } from "../../lib/clearHistory";
import type { DailyReport } from "../home/types/home.types";
import type { LocalTarotReading } from "../readings/localTarotReadings";
import { buildTarotReceiptModel, createTarotReceiptBlob, shareTarotReceipt, saveTarotReceipt, type TarotReceiptModel } from "../tarot/logic/shareReceipt";
import { ReceiptPrinter } from "./ReceiptPrinter";
import { buildDailyReceiptModel } from "./receiptModel";
import { receiptText } from "./receiptStrings";
import { DailyReceiptPaper } from "./DailyReceiptPaper";
import { ReceiptShareSky } from "./ReceiptShareSky";
import { getInitialHintTheme } from "../../components/app/theme";
import { HINT_PREFERENCES_UPDATED_EVENT } from "../../lib/preferences";
import { TarotReceiptPaper } from "./TarotReceiptPaper";

function subscribeTheme(listener: () => void) {
  window.addEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(HINT_PREFERENCES_UPDATED_EVENT, listener); window.removeEventListener("storage", listener); };
}

export type ReceiptSource = { kind: "tarot"; reading: LocalTarotReading } | { kind: "daily"; report: DailyReport };
function Paper({ model }: { model: TarotReceiptModel }) {
  if (model.kind === "daily") return <DailyReceiptPaper model={model} />;
  return <TarotReceiptPaper model={model} />;
}

export function ReceiptShareDialog({ source, onClose }: { source: ReceiptSource; onClose: () => void }) {
  const { language } = useLanguage();
  const theme = useSyncExternalStore(subscribeTheme, getInitialHintTheme, () => "dark" as const);
  const text = (key: Parameters<typeof receiptText>[1]) => receiptText(language, key);
  const [snapshot] = useState(() => structuredClone(source));
  const [identity] = useState(captureIdentityContext);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  // Keep the share scene inside the shell for its safe areas and focus handling.
  const [portalContainer] = useState(() => document.querySelector<HTMLElement>(".hint-app-shell-root") ?? undefined);
  const [includeDailyScores] = useState(() => snapshot.kind === "daily" && snapshot.report.date === getLocalDateString());
  const [clearVersion] = useState(() => historyClearVersion(identity.owner));
  const printerStage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (snapshot.kind === "tarot") printerStage.current?.focus({ preventScroll: true });
  }, [snapshot.kind]);
  const [attempt, setAttempt] = useState(0);
  const [printRun, setPrintRun] = useState(0);
  const [printedKey, setPrintedKey] = useState<string | null>(null);
  const [startedKey, setStartedKey] = useState<string | null>(null);
  const [skippedKey, setSkippedKey] = useState<string | null>(null);
  const [image, setImage] = useState<{ blob: Blob; model: TarotReceiptModel } | null>(null);
  const [error, setError] = useState<"retry" | "shareError" | "saveError" | "savePermission" | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "shared" | "downloaded" | "savedPhotos">("idle");
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const shareAbort = useRef<AbortController | null>(null);
  const { model, invalid } = useMemo(() => {
    try {
      const value = snapshot.kind === "tarot"
        ? buildTarotReceiptModel(snapshot.reading, false, undefined, language)
        : buildDailyReceiptModel(snapshot.report, language, includeDailyScores);
      return { model: { ...value, theme }, invalid: false };
    } catch { return { model: null, invalid: true }; }
  }, [snapshot, language, includeDailyScores, theme]);
  const printKey = `${language}:${theme}:${attempt}:${printRun}`;
  const printed = printedKey === printKey;
  const started = startedKey === printKey;
  const currentImage = image?.model === model ? image : null;
  function assertCurrent() {
    identity.assertCurrent();
    if (historyClearVersion(identity.owner) !== clearVersion) throw new DOMException("Reading cleared", "AbortError");
    if (snapshot.kind === "tarot" && snapshot.reading.anonId !== identity.owner) throw new DOMException("Different profile", "AbortError");
  }
  useEffect(() => {
    const check = () => { try { assertCurrent(); } catch { closeRef.current(); } };
    identity.signal.addEventListener("abort", check);
    window.addEventListener("storage", check);
    check();
    return () => { identity.signal.removeEventListener("abort", check); window.removeEventListener("storage", check); shareAbort.current?.abort(); };
  }, [identity, clearVersion]);
  useEffect(() => {
    const controller = new AbortController();
    shareAbort.current?.abort(); shareAbort.current = null;
    setImage(null); setStatus("idle"); setError(null);
    if (!model || invalid) { setError("retry"); return; }
    void (async () => {
      try {
        assertCurrent();
        await document.fonts?.ready;
        if (controller.signal.aborted) return;
        const blob = await createTarotReceiptBlob(model, { signal: controller.signal });
        if (controller.signal.aborted) return;
        assertCurrent();
        setImage({ blob, model });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") { closeRef.current(); return; }
        setError("retry");
      }
    })();
    return () => { controller.abort(); };
  }, [model, attempt, invalid]);
  async function share() {
    if (!currentImage || !printed || shareAbort.current) return;
    const controller = new AbortController(); shareAbort.current = controller;
    try {
      assertCurrent(); setError(null); setStatus("busy");
      const outcome = await shareTarotReceipt(currentImage.blob, `hint-${snapshot.kind}-${snapshot.kind === "daily" ? snapshot.report.date : snapshot.reading.id}.png`, { signal: controller.signal, language });
      if (controller.signal.aborted || shareAbort.current !== controller) return;
      assertCurrent(); setStatus(outcome === "cancelled" ? "idle" : outcome === "saved" ? "downloaded" : "shared");
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") { closeRef.current(); return; }
      setError("shareError"); setStatus("idle");
    } finally { if (shareAbort.current === controller) shareAbort.current = null; }
  }
  async function save() {
    if (!currentImage || !printed || shareAbort.current) return;
    const controller = new AbortController(); shareAbort.current = controller;
    try {
      assertCurrent(); setError(null); setStatus("busy");
      const outcome = await saveTarotReceipt(currentImage.blob, `hint-${snapshot.kind}-${snapshot.kind === "daily" ? snapshot.report.date : snapshot.reading.id}.png`, { signal: controller.signal });
      if (controller.signal.aborted || shareAbort.current !== controller) return;
      assertCurrent(); setStatus(outcome === "photos" ? "savedPhotos" : "downloaded");
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") { closeRef.current(); return; }
      setError(typeof err === "object" && err !== null && "code" in err && err.code === "PHOTO_PERMISSION_DENIED" ? "savePermission" : "saveError");
      setStatus("idle");
    } finally { if (shareAbort.current === controller) shareAbort.current = null; }
  }
  function replay() {
    const viewport = printerStage.current?.closest<HTMLElement>(".receipt-share-scroll");
    if (viewport) viewport.scrollTop = 0;
    printerStage.current?.focus({ preventScroll: true });
    const nextRun = printRun + 1;
    setPrintedKey(null); setStartedKey(null); setSkippedKey(null); setStatus("idle"); setPrintRun(nextRun);
    if (error === "saveError" || error === "savePermission" || error === "shareError") setError(null);
  }
  const footerMessage = status === "shared" ? text("shared") : status === "savedPhotos" ? text("savedPhotos") : status === "downloaded" ? text("downloaded") : printed && !currentImage && !error ? text("preparing") : "";
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogPortal container={portalContainer}>
    <DialogSurface className="receipt-share-dialog" data-hint-theme={theme} data-receipt-kind={snapshot.kind} data-testid="receipt-share-dialog" onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); }}>
      {theme === "dark" && <ReceiptShareSky />}
      <header className="receipt-share-header"><button type="button" onClick={onClose} aria-label={text("close")}><ArrowLeft size={22} /></button><div><DialogTitle>{text("title")}</DialogTitle><DialogDescription>{text(started ? "subtitle" : "revealHint")}</DialogDescription></div></header>
      <div className="receipt-share-body">
        {model && started && !printed && <button type="button" className="receipt-share-skip" disabled={status === "busy"} onClick={() => setSkippedKey(printKey)}>{text("skipAnimation")}</button>}
        <div className="receipt-share-scroll">
          <div ref={printerStage} className="receipt-share-printer-stage" tabIndex={-1} role="group" aria-label={text("revealHint")}>{model && <ReceiptPrinter key={printKey} theme={theme} started={started} skip={skippedKey === printKey} onStart={() => setStartedKey(printKey)} variant={model.kind === "daily" ? "daily" : "tarot"} onPrintComplete={() => setPrintedKey(printKey)} disabled={status === "busy"}><Paper model={model} /></ReceiptPrinter>}</div>
          {error && <div className="receipt-share-error" role="alert"><p>{text(error)}</p><button type="button" onClick={() => { if (error === "shareError") void share(); else if (error === "saveError" || error === "savePermission") void save(); else setAttempt(value => value + 1); }}>{text("tryAgain")}</button></div>}
        </div>
      </div>
      <footer className="receipt-share-footer" aria-hidden={!printed} style={{ visibility: printed ? "visible" : "hidden" }}>
        {footerMessage && <p role="status">{footerMessage}</p>}
        <div><button type="button" disabled={!started || status === "busy"} onClick={replay}><RotateCcw size={16} aria-hidden="true" />{text("replay")}</button><button type="button" disabled={!currentImage || !printed || status === "busy"} onClick={() => void save()}><Download size={16} aria-hidden="true" />{text("save")}</button><button type="button" disabled={!currentImage || !printed || status === "busy"} onClick={() => void share()}><Share2 size={16} aria-hidden="true" />{text("share")}</button></div>
      </footer>
    </DialogSurface>
  </DialogPortal></Dialog>;
}

export function DailyReceiptButton({ report, disabled = false, compact = false }: { report: DailyReport; disabled?: boolean; compact?: boolean }) {
  const { language } = useLanguage();
  const [source, setSource] = useState<ReceiptSource | null>(null);
  return <><button type="button" className={`receipt-share-trigger${compact ? " receipt-share-trigger--compact" : ""}`} aria-label={compact ? receiptText(language, "share") : undefined} title={compact ? receiptText(language, "share") : undefined} disabled={disabled} onClick={event => { event.currentTarget.focus({ preventScroll: true }); setSource({ kind: "daily", report: structuredClone(report) }); }}><Share2 size={16} aria-hidden="true" />{!compact && receiptText(language, "share")}</button>{source && <ReceiptShareDialog source={source} onClose={() => setSource(null)} />}</>;
}
