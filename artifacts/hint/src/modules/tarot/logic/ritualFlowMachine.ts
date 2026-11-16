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
  generation: number;
  settingsMode: boolean;
  settingsReturnStep: TarotFlowStep | null;
};

export type TarotFlowEvent =
  | { type: "NAVIGATE"; step: TarotFlowStep }
  | { type: "ADVANCE"; from: TarotFlowStep; generation: number; step: TarotFlowStep }
  | { type: "OPEN_SETTINGS" }
  | { type: "CLOSE_SETTINGS" }
  | { type: "RESET" };

export function createTarotFlowState(
  step: TarotFlowStep,
  settingsMode = false,
): TarotFlowState {
  return {
    step,
    generation: 0,
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
      return { ...state, step: event.step, generation: state.generation + 1 };
    case "ADVANCE":
      // Exiting stages may still be mounted. Only the current run may finish,
      // even if Back/restart has since returned to the same stage.
      if (state.settingsMode || state.step !== event.from || state.generation !== event.generation) return state;
      return { ...state, step: event.step, generation: state.generation + 1 };
    case "OPEN_SETTINGS":
      if (state.settingsMode && state.step === "design") return state;
      return {
        step: "design",
        generation: state.generation + 1,
        settingsMode: true,
        settingsReturnStep: state.step,
      };
    case "CLOSE_SETTINGS":
      if (!state.settingsReturnStep) return state;
      return {
        step: state.settingsReturnStep,
        generation: state.generation + 1,
        settingsMode: false,
        settingsReturnStep: null,
      };
    case "RESET":
      return { ...createTarotFlowState("question"), generation: state.generation + 1 };
    default:
      return state;
  }
}
