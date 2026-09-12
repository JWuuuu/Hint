export const QUIZ_AXES = ["avoid", "delulu", "control", "mess", "please", "think", "escape", "vision"] as const;
export type QuizAxis = typeof QUIZ_AXES[number];
export type PersonalityProgress = { answers: QuizAxis[]; questionIndex: number; result: string | null };
export const personalityProgressKey = (owner: string) => `hint_personality_progress_v3:${encodeURIComponent(owner)}`;
export const personalityResultsKey = (owner: string) => `hint_personality_results_v1:${encodeURIComponent(owner)}`;
const LEGACY_OWNER = "hint_personality_legacy_owner_v3";
export const emptyPersonalityProgress = (): PersonalityProgress => ({ answers: [], questionIndex: 0, result: null });

function normalize(value: unknown): PersonalityProgress | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PersonalityProgress>;
  if (!Array.isArray(raw.answers) || raw.answers.some(axis => !QUIZ_AXES.includes(axis))) return null;
  const answers = raw.answers.slice(0, 6);
  const result = typeof raw.result === "string" ? raw.result : null;
  const maximum = result || answers.length === 6 ? 6 : answers.length;
  const questionIndex = Number.isInteger(raw.questionIndex) ? Math.max(0, Math.min(maximum, raw.questionIndex!)) : maximum;
  return { answers, questionIndex, result };
}

export function readPersonalityProgress(owner: string): PersonalityProgress {
  try {
    const raw = localStorage.getItem(personalityProgressKey(owner));
    if (raw) return normalize(JSON.parse(raw)) ?? emptyPersonalityProgress();
    const legacyOwner = localStorage.getItem(LEGACY_OWNER);
    if (legacyOwner && legacyOwner !== owner) return emptyPersonalityProgress();
    const answers = JSON.parse(localStorage.getItem("hint.personalities.answers.v2") || "[]");
    const result = localStorage.getItem("hint.personalities.result.v2");
    if (!result && (!Array.isArray(answers) || answers.length === 0)) return emptyPersonalityProgress();
    const progress = normalize({ answers, result, questionIndex: result ? 6 : answers.length });
    if (!progress) return emptyPersonalityProgress();
    // Claim unscoped legacy data once; originals remain available for recovery.
    localStorage.setItem(LEGACY_OWNER, owner);
    localStorage.setItem(personalityProgressKey(owner), JSON.stringify(progress));
    return progress;
  } catch { return emptyPersonalityProgress(); }
}

export function readPersonalityResults(owner: string): PersonalityProgress[] {
  try {
    const raw = JSON.parse(localStorage.getItem(personalityResultsKey(owner)) || "[]");
    return Array.isArray(raw) ? raw.map(normalize).filter((value): value is PersonalityProgress => Boolean(value?.result)) : [];
  } catch { return []; }
}

export function writePersonalityProgress(owner: string, progress: PersonalityProgress): boolean {
  try {
    const previous = readPersonalityProgress(owner);
    if (previous.result) {
      const results = readPersonalityResults(owner);
      const completed = { ...previous, questionIndex: 6 };
      const fingerprint = JSON.stringify(completed);
      if (!results.some(result => JSON.stringify(result) === fingerprint)) {
        // Preserve completed work before a new visit replaces active progress.
        // If this fails, leave the original persisted result intact.
        localStorage.setItem(personalityResultsKey(owner), JSON.stringify([...results, completed]));
      }
    }
    localStorage.setItem(personalityProgressKey(owner), JSON.stringify(progress)); return true;
  }
  catch { return false; }
}
