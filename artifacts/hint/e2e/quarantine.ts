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
const BOTH_PHONES_A4 = "Approved Nov 4 (Decision 5, extended to SE): misses its timing budget in CI's software-rendered WebKit, on Pro Max in every run and on SE intermittently (1 of 3 RC preview runs), even with the mascot antialias fix. The cost is the full-viewport mascot WebGL canvas; remove once that canvas is sized to the mascot.";
const PRO_MAX_A4 = "Approved Nov 4 (Decision 5): misses its timing budget on iPhone 17 Pro Max in CI's software-rendered WebKit even with the mascot antialias fix, and passes on SE. The cost is the full-viewport mascot WebGL canvas; remove once that canvas is sized to the mascot.";

const RECEIPT_MOTION = "Approved Nov 4 (Decision 6): with motion on, this receipt case hangs or crashes the page in CI's software-rendered WebKit in 15-45% of runs. Diagnosis (rc-bisect runs) found no single cause: glass blur, the mascot and sky canvases and 200% text stack up. The reduced-motion cases of the same screens still run. Re-enable once decorative motion pauses behind dialogs and the mascot canvas is sized to the mascot.";
const LANGUAGES = ["en", "zh", "es", "ja", "ko"] as const;
// Motion on means app=false and system=false; the other three motion settings stay active.
const MOTION_ON_RECEIPTS = [
  ...LANGUAGES.flatMap(language => (["bright", "dark"] as const).flatMap(theme => [100, 200].map(scale => ({ file: "merge-visual-matrix.spec.ts", title: `merge matrix ${language} ${theme} app=false system=false text=${scale}`, reason: RECEIPT_MOTION })))),
  ...LANGUAGES.map(language => ({ file: "merge-receipt.spec.ts", title: `merged receipt ${language} bright app=false system=false text=100`, reason: RECEIPT_MOTION })),
];

type Project = "iphone-se" | "iphone-17-pro-max";
export const QUARANTINED: ReadonlyArray<{ file: string; title: string; reason: string; project?: Project }> = [
  ...MOTION_ON_RECEIPTS,
  { file: "astrology-quality.spec.ts", title: "Astrology host frame samples during chart, detail and scrolling", reason: BOTH_PHONES_A4 },
  { file: "motion-performance.spec.ts", title: "web frame regression app=false OS=false: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "motion-performance.spec.ts", title: "web frame regression app=false OS=true: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "motion-performance.spec.ts", title: "web frame regression app=true OS=false: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "motion-performance.spec.ts", title: "web frame regression app=true OS=true: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "room-entrances.spec.ts", title: "the arriving Tarot question accepts pointer input within its first 300ms", project: "iphone-17-pro-max", reason: PRO_MAX_A4 },
  { file: "tarot-room.spec.ts", title: "Auto Wash avoids sustained animation stalls", project: "iphone-17-pro-max", reason: PRO_MAX_A4 },
  { file: "tarot-wash-refinement.spec.ts", title: "a stationary hand lets the cards rest and keeps only clockwise guidance", reason: BOTH_PHONES_A4 },
];

export function quarantineReason(file: string, title: string, project?: string): string | undefined {
  const name = file.replace(/\\/g, "/").split("/").pop();
  return QUARANTINED.find(entry => entry.file === name && entry.title === title && (!entry.project || entry.project === project))?.reason;
}
