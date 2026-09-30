import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { Dialog, DialogPortal, DialogSurface, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { useLanguage } from "../../lib/i18n";
import { captureIdentityContext, getLocalDateString } from "../../lib/identity";
import { historyClearVersion } from "../../lib/clearHistory";
import type { DailyReport } from "../home/types/home.types";
import type { LocalTarotReading } from "../readings/localTarotReadings";
import { buildTarotReceiptModel, createTarotReceiptBlob, shareTarotReceipt, type TarotReceiptModel } from "../tarot/logic/shareReceipt";
import { ReceiptPrinter } from "./ReceiptPrinter";
import { buildDailyReceiptModel } from "./receiptModel";
import { receiptText } from "./receiptStrings";

export type ReceiptSource = { kind: "tarot"; reading: LocalTarotReading } | { kind: "daily"; report: DailyReport };
function Paper({ model }: { model: TarotReceiptModel }) {
  return <>
    <header className="receipt-printer__result-header"><span>HINT</span><small>{model.title}</small></header>
    <p className="receipt-paper-date">{model.date}</p>
    {model.question && <p className="receipt-paper-question">“{model.question}”</p>}
    {model.cards.map((card, index) => <section key={index} className="receipt-printer__card-block">
      <p className="receipt-printer__label">{card.position}</p>
      {card.image && <img className="receipt-printer__card-image" src={card.image} alt={card.name} draggable={false} style={{ transform: card.orientation === "reversed" ? "rotate(180deg)" : undefined }} />}
      <h2>{card.name}</h2><p className="receipt-paper-caption">{receiptText(model.language ?? "en", card.orientation)}</p>
    </section>)}
    <p className="receipt-paper-insight" data-testid="receipt-insight">{model.insight}</p>
    {model.labels.originalText && <p className="receipt-paper-caption">{model.labels.originalText}</p>}
    {model.details?.map((item, index) => <p className="receipt-paper-detail" key={index}><span>{item.label}</span><strong>{item.value}</strong></p>)}
    <footer>{model.labels.footer}</footer>
  </>;
}

export function ReceiptShareDialog({ source, onClose }: { source: ReceiptSource; onClose: () => void }) {
  const { language } = useLanguage();
  const text = (key: Parameters<typeof receiptText>[1]) => receiptText(language, key);
  const [snapshot] = useState(() => structuredClone(source));
  const [identity] = useState(captureIdentityContext);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [includeDailyScores] = useState(() => snapshot.kind === "daily" && snapshot.report.date === getLocalDateString());
  const [clearVersion] = useState(() => historyClearVersion(identity.owner));
  const [includePersonal, setIncludePersonal] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(false);
  const [printRun, setPrintRun] = useState(0);
  const [printedKey, setPrintedKey] = useState<string | null>(null);
  const [skip, setSkip] = useState(false);
  const [image, setImage] = useState<{ blob: Blob; url: string; model: TarotReceiptModel } | null>(null);
  const [error, setError] = useState<"retry" | "long" | "shareError" | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "shared" | "downloaded">("idle");
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const shareAbort = useRef<AbortController | null>(null);
  const { model, invalid } = useMemo(() => {
    try {
      const value = snapshot.kind === "tarot"
        ? buildTarotReceiptModel(snapshot.reading, includePersonal, undefined, language)
        : buildDailyReceiptModel(snapshot.report, language, includeDailyScores);
      return { model: value, invalid: false };
    } catch { return { model: null, invalid: true }; }
  }, [snapshot, includePersonal, language, includeDailyScores]);
  const printKey = `${includePersonal}:${language}:${attempt}:${printRun}`;
  const printed = printedKey === printKey;
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
    let url: string | undefined;
    shareAbort.current?.abort(); shareAbort.current = null;
    setImage(null); setStatus("idle"); setError(null); setPreview(false); setSkip(false);
    if (!model || invalid) { setError("retry"); return; }
    void (async () => {
      try {
        assertCurrent();
        await document.fonts?.ready;
        if (controller.signal.aborted) return;
        const blob = await createTarotReceiptBlob(model, { signal: controller.signal });
        if (controller.signal.aborted) return;
        assertCurrent();
        url = URL.createObjectURL(blob); setImage({ blob, url, model });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") { closeRef.current(); return; }
        setError(err instanceof Error && err.message.includes("too long") ? "long" : "retry");
      }
    })();
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
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
  function replay() {
    setPreview(false); setSkip(false); setPrintedKey(null); setPrintRun(value => value + 1);
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogPortal>
    <DialogSurface className="receipt-share-dialog" data-testid="receipt-share-dialog" onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); }}>
      <header className="receipt-share-header"><button type="button" onClick={onClose} aria-label={text("close")}><ArrowLeft size={22} /></button><div><DialogTitle>{text("title")}</DialogTitle><DialogDescription>{text("subtitle")}</DialogDescription></div></header>
      <div className="receipt-share-scroll">
        {snapshot.kind === "tarot" && <label className="receipt-share-private"><input type="checkbox" checked={includePersonal} disabled={status === "busy"} onChange={event => setIncludePersonal(event.target.checked)} />{text("include")}</label>}
        {model && !preview && <ReceiptPrinter key={printKey} skip={skip} onPrintComplete={() => setPrintedKey(printKey)}><Paper model={model} /></ReceiptPrinter>}
        {preview && currentImage && <img className="receipt-share-image" src={currentImage.url} alt={text("preview")} data-testid="receipt-image-preview" />}
        {error && <div className="receipt-share-error" role="alert"><p>{text(error)}</p><button type="button" onClick={() => { if (error === "long") setIncludePersonal(false); else if (error === "shareError") void share(); else setAttempt(value => value + 1); }}>{text(error === "long" ? "public" : "tryAgain")}</button></div>}
      </div>
      <footer className="receipt-share-footer">
        {!printed && !preview && <button type="button" className="receipt-share-link" onClick={() => setSkip(true)}>{text("skip")}</button>}

        <p role="status">{status === "shared" ? text("shared") : status === "downloaded" ? text("downloaded") : !currentImage && !error ? text("preparing") : !printed ? text("printing") : ""}</p>
        <div><button type="button" disabled={status === "busy"} onClick={replay}>{text("replay")}</button><button type="button" disabled={!currentImage || !printed || status === "busy"} onClick={() => setPreview(value => !value)}>{preview ? text("paper") : text("preview")}</button><button type="button" disabled={!currentImage || !printed || status === "busy"} onClick={() => void share()}><Share2 size={16} />{text("share")}</button></div>
      </footer>
    </DialogSurface>
  </DialogPortal></Dialog>;
}

export function DailyReceiptButton({ report, disabled = false, compact = false }: { report: DailyReport; disabled?: boolean; compact?: boolean }) {
  const { language } = useLanguage();
  const [source, setSource] = useState<ReceiptSource | null>(null);
  return <><button type="button" className={`receipt-share-trigger${compact ? " receipt-share-trigger--compact" : ""}`} aria-label={compact ? receiptText(language, "share") : undefined} title={compact ? receiptText(language, "share") : undefined} disabled={disabled} onClick={event => { event.currentTarget.focus({ preventScroll: true }); setSource({ kind: "daily", report: structuredClone(report) }); }}><Share2 size={16} aria-hidden="true" />{!compact && receiptText(language, "share")}</button>{source && <ReceiptShareDialog source={source} onClose={() => setSource(null)} />}</>;
}
