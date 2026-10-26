import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider } from "../../lib/i18n";
import { MotionPolicyProvider } from "../../lib/motionPolicy";
import { HintGuideProvider, HintGuideSlot } from "../mascot/HintGuide";
import { dailyGuideContext } from "../mascot/hintGuideContext";
import { ReferenceDailyRevealOverlay } from "../../modules/home/components/HomeDashboard";
import { getDailyReport } from "../../modules/home/data/dailyReport";
import { DevicePreview, shouldShowDevicePreview } from "./DevicePreview";
import "../../index.css";

export function DailyMotionReviewStage({ speed, hold, onSpeed, onHold }: { speed: string; hold: string; onSpeed: (value: string) => void; onHold: (value: string) => void }) {
  const [open, setOpen] = useState(false), [fresh, setFresh] = useState(true), [reveals, setReveals] = useState(0);
  const [paused, setPaused] = useState(false), [run, setRun] = useState(0);
  const report = useMemo(() => getDailyReport({ anonId: "daily-letter-review", date: new Date(2026, 9, 20) }), []);
  const replay = () => { onHold("");setPaused(false);setFresh(true);setRun(n => n + 1);setOpen(true); };
  const controls = <div role="group" aria-label="Motion review playback" className="fixed inset-x-4 bottom-[calc(12px+var(--hint-safe-bottom))] z-30 mx-auto flex max-w-[390px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-[#211a29]/95 p-2 text-xs text-white shadow-lg">
    <button type="button" className="min-h-11 rounded-xl border border-white/25 px-4" onClick={() => { if (paused) onHold("");setPaused(value => !value); }}>{paused ? "Continue" : "Pause"}</button>
    <button type="button" className="min-h-11 rounded-xl border border-white/25 px-4" onClick={replay}>Replay</button>
    <label className="flex items-center gap-2">Speed <select aria-label="Playback speed" className="min-h-11 rounded-xl border border-white/20 bg-[#29212e] px-2" value={speed} onChange={event => onSpeed(event.target.value)}><option value="1">Normal</option><option value=".5">Half</option></select></label>
  </div>;
  return <LanguageProvider><MotionPolicyProvider><HintGuideProvider key={run} enabled review={{ speed: Number(speed), holdAt: hold ? Number(hold) : undefined, paused, onPauseChange: setPaused }}>
    <main style={{ padding: "calc(var(--hint-safe-top, 20px) + 32px) 24px calc(var(--hint-safe-bottom, 0px) + 32px)", textAlign: "center", color: "#eee3d1", minHeight: "100dvh", background: "#17131c" }}>
      <HintGuideSlot className="mx-auto h-36 w-36" context={dailyGuideContext({ ready: true, revealed: false, opening: false })} />
      <h1 className="mt-4 font-serif text-3xl">A letter from Hint</h1><p className="my-4 text-sm text-white/60">Review fixture · {report.card.cardName}</p>
      <button className="m-2 rounded-full border px-6 py-3" onClick={() => { setPaused(false);setFresh(true);setOpen(true); }}>Play delivery</button>
      <button className="m-2 rounded-full border px-6 py-3" onClick={() => { onHold("");setPaused(false);setFresh(false);setOpen(true); }}>Reopen card</button>
      <p className="mt-4 text-xs text-white/50">Completed reveals: {reveals}</p>
      <div className="mx-auto mt-10 grid max-w-72 gap-4 text-left text-sm">
        <label>Inspect <select aria-label="Inspect" className="mt-2 block min-h-11 w-full rounded-xl border border-white/20 bg-[#29212e] px-3" value={hold} onChange={e => onHold(e.target.value)}><option value="">Live</option><option value=".35">Gather letter</option><option value="2.1">Offer</option><option value="2.88">Release</option><option value="4.67">Open</option><option value="5.2">Extract</option><option value="5.98">Arrived</option><option value="6.08">Material handover</option></select></label>
        <label>Speed <select aria-label="Speed" className="mt-2 block min-h-11 w-full rounded-xl border border-white/20 bg-[#29212e] px-3" value={speed} onChange={e => onSpeed(e.target.value)}><option value="1">Normal</option><option value=".5">Half</option></select></label>
      </div>
      <p className="mt-8 text-xs text-white/50">A sample reading for motion review.</p>
    </main>
    <ReferenceDailyRevealOverlay key={run} open={open} fresh={fresh} revealing={false} report={report} onClose={() => { setOpen(false);setPaused(false); }} onCardRevealed={() => setReveals(n => n + 1)} reviewControls={controls} />
  </HintGuideProvider></MotionPolicyProvider></LanguageProvider>;
}
function Review() {
  const params = new URLSearchParams(location.search);
  const [hold, setHold] = useState(params.get("hold") ?? ""), [speed, setSpeed] = useState(params.get("speed") === ".5" ? ".5" : "1");
  return <DailyMotionReviewStage hold={hold} speed={speed} onHold={setHold} onSpeed={setSpeed} />;
}
const container = document.getElementById("root");
if (import.meta.env.DEV && container) {
  const root = createRoot(container);
  root.render(shouldShowDevicePreview() ? <DevicePreview /> : <Review />);
  import.meta.hot?.dispose(() => root.unmount());
}
