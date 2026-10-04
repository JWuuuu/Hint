export type TarotFlowStep =
  | "question"
  | "spreadRecommendation"
  | "spreadSelector"
  | "design"
  | "prepare"
  | "shuffle"
  | "cut"
  | "pick"
  | "reveal"
  | "reading";

export type StableTarotFlowStep = Exclude<
  TarotFlowStep,
  "shuffle" | "cut" | "spreadSelector"
>;

export type TarotFlowState = {
  step: TarotFlowStep;
  settingsMode: boolean;
  settingsReturnStep: TarotFlowStep | null;
};

export type TarotFlowEvent =
  | { type: "NAVIGATE"; step: TarotFlowStep }
  | { type: "OPEN_SETTINGS" }
  | { type: "CLOSE_SETTINGS" }
  | { type: "RESET" };

export function createTarotFlowState(
  step: TarotFlowStep,
  settingsMode = false,
): TarotFlowState {
  return {
    step,
    settingsMode,
    settingsReturnStep: null,
  };
}

export function getTarotStableRecoveryStep(
  step: TarotFlowStep,
): StableTarotFlowStep {
  if (step === "shuffle" || step === "cut") return "prepare";
  if (step === "spreadSelector") return "spreadRecommendation";
  return step;
}

export function tarotFlowReducer(
  state: TarotFlowState,
  event: TarotFlowEvent,
): TarotFlowState {
  switch (event.type) {
    case "NAVIGATE":
      return { ...state, step: event.step };
    case "OPEN_SETTINGS":
      if (state.settingsMode && state.step === "design") return state;
      return {
        step: "design",
        settingsMode: true,
        settingsReturnStep: state.step,
      };
    case "CLOSE_SETTINGS":
      if (!state.settingsReturnStep) return state;
      return {
        step: state.settingsReturnStep,
        settingsMode: false,
        settingsReturnStep: null,
      };
    case "RESET":
      return createTarotFlowState("question");
    default:
      return state;
  }
}
