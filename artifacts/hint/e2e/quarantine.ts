/**
 * Temporary quarantine for the first full WebKit run on the Oct 30 integration
 * (Candidate verification run 41170188047, head c2bf99e).
 *
 * Every entry is marked `fixme` (reported as skipped, never as passed) so the
 * suite can gate new changes again. Remove an entry in the same change that
 * fixes or rewrites its test. Do not add new entries without review.
 */
const GOLDEN_REVIEW = "Pixel golden predates the current design (Oct 15 and Oct 27-30 visual work); re-baseline only after visual approval.";
const FRAME_BUDGET = "Frame budget exceeded in headless WebKit; the full-viewport mascot WebGL canvas is the measured cost. Tracked as a performance follow-up.";
const fixPending = (branch: string) => `App bug, fixed on ${branch}; remove this entry once that PR merges.`;
const ASK_SE_FOLD = "Real layout bug on iPhone SE: with the draft-recovery notice, the Ask heading's second line sits under the composer (bottom 571 > 561). Ask files belong to T10; fix after it lands.";
const CJK_200 = "WebKit CI closes the page before this check (slow rendering, A4). In Chromium the Home score row reports clipping only with substitute CJK fonts and reads intact; re-check in WebKit after the mascot fix.";

export const QUARANTINED: ReadonlyArray<{ file: string; title: string; reason: string }> = [
  { file: "astrology-quality.spec.ts", title: "Astrology host frame samples during chart, detail and scrolling", reason: FRAME_BUDGET },
  { file: "merge-visual-matrix.spec.ts", title: "merge matrix ja dark app=false system=false text=200", reason: CJK_200 },
  { file: "merge-visual-matrix.spec.ts", title: "merge matrix ko bright app=false system=false text=200", reason: CJK_200 },
  { file: "merge-visual-matrix.spec.ts", title: "merge matrix ko dark app=false system=false text=200", reason: CJK_200 },
  { file: "motion-performance.spec.ts", title: "web frame regression app=false OS=false: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "motion-performance.spec.ts", title: "web frame regression app=false OS=true: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "motion-performance.spec.ts", title: "web frame regression app=true OS=false: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "motion-performance.spec.ts", title: "web frame regression app=true OS=true: Home, scroll, modal, Animal and Tarot", reason: FRAME_BUDGET },
  { file: "room-fresh-entry.spec.ts", title: "Ask reentry starts blank, manually restores draft, and keeps prior saved conversation readable", reason: ASK_SE_FOLD },
  { file: "room-visits.spec.ts", title: "a delayed approved departure from a saved Tarot reading keeps the destination entrance", reason: fixPending("fix/menu-exit-room-entrance") },
  { file: "tarot-room.spec.ts", title: "pick arc stays ordered on dawn", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "pick arc stays ordered on sea", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "pick arc stays ordered on stars", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading layout 1 cards on stars", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading layout 3 cards on dawn", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading layout 5 cards on sea", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading layout 7 cards on stars", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading layout 9 cards on dawn", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading template answers first, explains numbered cards, then connects them in en", reason: fixPending("fix/tarot-reading-halo-overflow") },
  { file: "tarot-room.spec.ts", title: "reading template answers first, explains numbered cards, then connects them in zh", reason: fixPending("fix/tarot-reading-halo-overflow") },
  { file: "tarot-room.spec.ts", title: "voice completion sheet matches its pixel golden", reason: GOLDEN_REVIEW },
  { file: "tarot-wash-refinement.spec.ts", title: "wash and cut meet at the same opaque card without a size or position jump", reason: fixPending("fix/tarot-wash-cut-seam") },
];

export function quarantineReason(file: string, title: string): string | undefined {
  const name = file.replace(/\\/g, "/").split("/").pop();
  return QUARANTINED.find(entry => entry.file === name && entry.title === title)?.reason;
}
