export type WashRitualStage = "washing" | "gathering" | "cutReady";
export type WashRitualMode = "manual" | "auto" | null;

export type WashRitualState = {
  stage: WashRitualStage;
  mode: WashRitualMode;
  progress: number;
  autoWashing: boolean;
};

export type WashRitualEvent =
  | { type: "MANUAL_START" }
  | { type: "MANUAL_CANCEL" }
  | { type: "PROGRESS"; progress: number }
  | { type: "AUTO_START" }
  | { type: "WASH_COMPLETE" }
  | { type: "GATHER_COMPLETE" }
  | { type: "WASH_AGAIN" };

export type WashRitualTiming = {
  autoWashMs: number;
  squareMs: number;
  readyMs: number;
};

export function getWashRitualTiming(reduceMotion: boolean): WashRitualTiming {
  return reduceMotion
    ? { autoWashMs: 160, squareMs: 20, readyMs: 80 }
    : { autoWashMs: 3600, squareMs: 540, readyMs: 1100 };
}

export const WASH_FRAME_MS = 1000 / 60;

/** Simulate at 60 Hz on both 60 Hz and ProMotion displays; never replay a
 * background pause as a burst of hundreds of physics updates. */
export function createWashFrameClock(startedAt: number) {
  let previous = startedAt;
  let remainder = 0;
  return (now: number) => {
    remainder += Math.min(50, Math.max(0, now - previous));
    previous = now;
    const steps = Math.floor((remainder + 0.001) / WASH_FRAME_MS);
    remainder = Math.max(0, remainder - steps * WASH_FRAME_MS);
    return steps;
  };
}

export function createInitialWashRitualState(): WashRitualState {
  return {
    stage: "washing",
    mode: null,
    progress: 0,
    autoWashing: false,
  };
}

function clampProgress(progress: number) {
  return Math.max(0, Math.min(1, progress));
}

export function washRitualReducer(
  state: WashRitualState,
  event: WashRitualEvent,
): WashRitualState {
  switch (event.type) {
    case "MANUAL_START":
      if (state.stage !== "washing" || state.autoWashing) return state;
      return { ...state, mode: "manual" };
    case "MANUAL_CANCEL":
      if (state.stage !== "washing" || state.autoWashing) return state;
      return { ...state, mode: null };
    case "PROGRESS": {
      if (state.stage !== "washing") return state;
      const progress = Math.max(state.progress, clampProgress(event.progress));
      return {
        ...state,
        progress,
      };
    }
    case "AUTO_START":
      if (state.stage !== "washing" || state.autoWashing) return state;
      return {
        ...state,
        mode: "auto",
        progress: 0,
        autoWashing: true,
      };
    case "WASH_COMPLETE":
      if (state.stage !== "washing") return state;
      return {
        ...state,
        stage: "gathering",
        progress: 1,
        autoWashing: false,
      };
    case "GATHER_COMPLETE":
      if (state.stage !== "gathering") return state;
      return { ...state, stage: "cutReady" };
    case "WASH_AGAIN":
      if (state.stage !== "cutReady") return state;
      return createInitialWashRitualState();
    default:
      return state;
  }
}
