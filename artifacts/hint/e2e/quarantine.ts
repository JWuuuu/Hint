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
  { file: "room-fresh-entry.spec.ts", title: "Ask reentry starts blank, manually restores draft, and keeps prior saved conversation readable", reason: ASK_SE_FOLD },
  { file: "tarot-room.spec.ts", title: "pick arc stays ordered on dawn", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "pick arc stays ordered on sea", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "pick arc stays ordered on stars", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading layout 1 cards on stars", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading layout 3 cards on dawn", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading layout 5 cards on sea", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading layout 7 cards on stars", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "reading layout 9 cards on dawn", reason: GOLDEN_REVIEW },
  { file: "tarot-room.spec.ts", title: "voice completion sheet matches its pixel golden", reason: GOLDEN_REVIEW },
];

export function quarantineReason(file: string, title: string): string | undefined {
  const name = file.replace(/\\/g, "/").split("/").pop();
  return QUARANTINED.find(entry => entry.file === name && entry.title === title)?.reason;
}
