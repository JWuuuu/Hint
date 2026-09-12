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
      settingsMode: true,
      settingsReturnStep: "pick",
    });
    expect(tarotFlowReducer(settings, { type: "CLOSE_SETTINGS" })).toEqual(picking);
  });

  it("keeps standalone room setup open until its caller handles navigation", () => {
    const standalone = createTarotFlowState("design", true);
    expect(tarotFlowReducer(standalone, { type: "CLOSE_SETTINGS" })).toBe(standalone);
  });

  it("resets the complete ritual flow to a clean question stage", () => {
    const reading = createTarotFlowState("reading");
    expect(tarotFlowReducer(reading, { type: "RESET" })).toEqual(
      createTarotFlowState("question"),
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
});
