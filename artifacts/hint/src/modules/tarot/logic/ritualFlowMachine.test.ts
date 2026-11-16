import { describe, expect, it } from "vitest";
import {
  createTarotFlowState,
  getTarotStableRecoveryStep,
  tarotFlowReducer,
} from "./ritualFlowMachine";

describe("tarotFlowReducer", () => {
  it("returns room settings to the exact stage that opened them", () => {
    const picking = createTarotFlowState("pick");
    const settings = tarotFlowReducer(picking, { type: "OPEN_SETTINGS" });
    expect(settings).toEqual({
      step: "design",
      generation: 1,
      settingsMode: true,
      settingsReturnStep: "pick",
    });
    expect(tarotFlowReducer(settings, { type: "CLOSE_SETTINGS" })).toEqual({ ...picking, generation: 2 });
  });

  it("keeps standalone room setup open until its caller handles navigation", () => {
    const standalone = createTarotFlowState("design", true);
    expect(tarotFlowReducer(standalone, { type: "CLOSE_SETTINGS" })).toBe(standalone);
  });

  it("resets the complete ritual flow to a clean question stage", () => {
    const reading = createTarotFlowState("reading");
    expect(tarotFlowReducer(reading, { type: "RESET" })).toEqual(
      { ...createTarotFlowState("question"), generation: 1 },
    );
  });

  it.each(["shuffle", "cut"] as const)(
    "recovers interrupted %s motion from the stable prepare stage",
    (step) => {
      expect(getTarotStableRecoveryStep(step)).toBe("prepare");
    },
  );

  it.each(["question", "design", "prepare", "pick", "reveal", "reading"] as const)(
    "keeps the stable %s stage when the app resumes",
    (step) => {
      expect(getTarotStableRecoveryStep(step)).toBe(step);
    },
  );

  it.each(["prepare", "shuffle", "cut"] as const)("rejects a late %s completion after Back and a same-stage restart", from => {
    const original = createTarotFlowState(from);
    const abandoned = { type: "ADVANCE" as const, from, generation: original.generation, step: "pick" as const };
    const back = tarotFlowReducer(original, { type: "NAVIGATE", step: "design" });
    expect(tarotFlowReducer(back, abandoned)).toBe(back);
    const restarted = tarotFlowReducer(back, { type: "NAVIGATE", step: from });
    expect(tarotFlowReducer(restarted, abandoned)).toBe(restarted);
    const completed = tarotFlowReducer(restarted, { ...abandoned, generation: restarted.generation });
    expect(completed.step).toBe("pick");
    expect(tarotFlowReducer(completed, { ...abandoned, generation: restarted.generation })).toBe(completed);
  });

  it("invalidates a running completion across settings and reset without reusing a generation", () => {
    const cutting = createTarotFlowState("cut");
    const completion = { type: "ADVANCE" as const, from: "cut" as const, generation: cutting.generation, step: "pick" as const };
    const settings = tarotFlowReducer(cutting, { type: "OPEN_SETTINGS" });
    expect(tarotFlowReducer(settings, completion)).toBe(settings);
    const returned = tarotFlowReducer(settings, { type: "CLOSE_SETTINGS" });
    expect(tarotFlowReducer(returned, completion)).toBe(returned);
    const reset = tarotFlowReducer(returned, { type: "RESET" });
    const newCut = tarotFlowReducer(reset, { type: "NAVIGATE", step: "cut" });
    expect(tarotFlowReducer(newCut, completion)).toBe(newCut);
  });
});
