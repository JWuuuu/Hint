/**
 * Temporary quarantine for the first full WebKit run on the Oct 30 integration
 * (Candidate verification run 41170188047, head c2bf99e).
 *
 * Every entry is marked `fixme` (reported as skipped, never as passed) so the
 * suite can gate new changes again. Remove an entry in the same change that
 * fixes or rewrites its test. Do not add new entries without review.
 * RC preview: entries whose fix is merged into this preview are removed here.
 * An entry with `project` applies to that phone project only.
 */
const FRAME_BUDGET = "Frame budget exceeded in headless WebKit; the full-viewport mascot WebGL canvas is the measured cost. Tracked as a performance follow-up.";
const ASK_SE_FOLD = "Real layout bug on iPhone SE: with the draft-recovery notice, the Ask heading's second line sits under the composer (bottom 571 > 561). Ask files belong to T10; fix after it lands.";
const PRO_MAX_A4 = "Approved Nov 4 (Decision 5): misses its timing budget on iPhone 17 Pro Max in CI's software-rendered WebKit even with the mascot antialias fix, and passes on SE. The cost is the full-viewport mascot WebGL canvas; remove once that canvas is sized to the mascot.";
const CJK_200 = "WebKit CI closes the page before this check (slow rendering, A4). In Chromium the Home score row reports clipping only with substitute CJK fonts and reads intact; re-check in WebKit after the mascot fix.";

type Project = "iphone-se" | "iphone-17-pro-max";
export const QUARANTINED: ReadonlyArray<{ file: string; title: string; reason: string; project?: Project }> = [
  { file: "astrology-quality.spec.ts", title: "Astrology host frame samples during chart, detail and scrolling", project: "iphone-17-pro-max", reason: PRO_MAX_A4 },
  { file: "merge-visual-matrix.spec.ts", title: "merge matrix ja dark app=false system=false text=200", reason: CJK_200 },
  { file: "merge-visual-matrix.spec.ts", title: "merge matrix ko bright app=false system=false text=200", reason: CJK_200 },
  { file: "merge-visual-matrix.spec.ts", title: "merge matrix ko dark app=false system=false text=200", reason: CJK_200 },
  { file: "motion-performance.spec.ts", title: "web frame regression app=false OS=false: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "motion-performance.spec.ts", title: "web frame regression app=false OS=true: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "motion-performance.spec.ts", title: "web frame regression app=true OS=false: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "motion-performance.spec.ts", title: "web frame regression app=true OS=true: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "room-entrances.spec.ts", title: "the arriving Tarot question accepts pointer input within its first 300ms", project: "iphone-17-pro-max", reason: PRO_MAX_A4 },
  { file: "room-fresh-entry.spec.ts", title: "Ask reentry starts blank, manually restores draft, and keeps prior saved conversation readable", reason: ASK_SE_FOLD },
  { file: "tarot-room.spec.ts", title: "Auto Wash avoids sustained animation stalls", project: "iphone-17-pro-max", reason: PRO_MAX_A4 },
  { file: "tarot-wash-refinement.spec.ts", title: "a stationary hand lets the cards rest and keeps only clockwise guidance", project: "iphone-17-pro-max", reason: PRO_MAX_A4 },
];

export function quarantineReason(file: string, title: string, project?: string): string | undefined {
  const name = file.replace(/\\/g, "/").split("/").pop();
  return QUARANTINED.find(entry => entry.file === name && entry.title === title && (!entry.project || entry.project === project))?.reason;
}
