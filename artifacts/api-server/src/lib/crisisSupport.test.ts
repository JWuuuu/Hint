import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CRISIS_COPY, detectCrisis, type CrisisLanguage } from "./crisisSupport";
import { crisisGuard, crisisSupportServed } from "./crisisGuard";

const positives: Array<[CrisisLanguage, string]> = [
  ["en", "I want to kill myself"],
  ["en", "Should I just end my life?"],
  ["en", "I've been feeling suicidal all week"],
  ["en", "i dont want to live anymore"],
  ["en", "I keep cutting myself when it gets bad"],
  ["en", "everyone would be better off dead without me, I'm better off dead"],
  ["zh", "我想自杀"],
  ["zh", "我真的不想活了"],
  ["zh", "我想死"],
  ["zh", "最近总想伤害自己"],
  ["es", "Quiero suicidarme"],
  ["es", "No quiero vivir más"],
  ["es", "a veces pienso en quitarme la vida"],
  ["ja", "もう死にたい"],
  ["ja", "消えたいと思ってしまう"],
  ["ja", "自傷がやめられない"],
  ["ko", "죽고 싶어요"],
  ["ko", "자살하고 싶다는 생각이 들어"],
  ["ko", "자해를 멈출 수가 없어"],
];

const negatives = [
  "Will my plant die if I move it?",
  "My phone is going to die before the interview",
  "I'm dying to know if he likes me",
  "She is killing it at work",
  "Should I end my lease early?",
  "I feel sad and lonely tonight",
  "What does the Death card mean?",
  "我想死你了",
  "笑死我了，他好可爱",
  "Me muero de ganas de verte",
  "死ぬほど眠い",
  "배고파 죽겠다",
  "",
];

describe("detectCrisis", () => {
  it.each(positives)("matches an explicit %s statement: %s", (language, text) => {
    expect(detectCrisis(text)).toBe(language);
  });
  it.each(negatives)("leaves ordinary text alone: %s", text => {
    expect(detectCrisis(text)).toBeNull();
  });
  it("has the full copy in every language", () => {
    for (const copy of Object.values(CRISIS_COPY)) {
      expect(copy.body).toContain("988");
      expect(copy.body).toContain("findahelpline.com");
      for (const value of Object.values(copy)) expect(value.trim().length).toBeGreaterThan(2);
    }
  });
});

describe("app and server copies", () => {
  it("are identical", () => {
    const server = readFileSync(resolve(__dirname, "crisisSupport.ts"), "utf8");
    const app = readFileSync(resolve(__dirname, "../../../hint/src/lib/crisisSupport.ts"), "utf8");
    expect(app).toBe(server);
  });
});

function call(path: string, body: unknown, method = "POST") {
  const res = { statusCode: 200, payload: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(value: unknown) { this.payload = value; return this; } };
  const next = vi.fn();
  crisisGuard({ method, path, body } as never, res as never, next);
  return { res, next };
}

describe("crisisGuard", () => {
  it("answers a crisis Ask message with the fixed reply in its language and skips the AI route", () => {
    const before = crisisSupportServed();
    const { res, next } = call("/hint/chat", { messages: [], followUp: "죽고 싶어요" });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ message: CRISIS_COPY.ko.body, safety: "crisis", source: "safety" });
    expect(crisisSupportServed()).toBe(before + 1);
  });

  it("answers a tarot follow-up in chat shape", () => {
    const { res, next } = call("/tarot/chat", { followUp: "I want to end it all" });
    expect(next).not.toHaveBeenCalled();
    expect(res.payload).toMatchObject({ message: CRISIS_COPY.en.body, safety: "crisis" });
  });

  it("refuses to draw a reading for a crisis question or context", () => {
    for (const [path, body] of [
      ["/tarot/spread-recommendation", { question: "我不想活了" }],
      ["/tarot/reading", { question: "What next?", emotionalContext: "quiero morirme" }],
      ["/tarot/structured-reading", { question: "What next?", additionalContext: "I want to kill myself" }],
    ] as const) {
      const { res, next } = call(path, body);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(409);
      expect(res.payload).toMatchObject({ error: "CRISIS_SUPPORT", safety: "crisis" });
    }
  });

  it("passes ordinary requests and other routes through untouched", () => {
    expect(call("/tarot/spread-recommendation", { question: "Will my plant die?" }).next).toHaveBeenCalledOnce();
    expect(call("/hint/chat", { followUp: "I feel a bit lost" }).next).toHaveBeenCalledOnce();
    expect(call("/profile", { name: "I want to die" }).next).toHaveBeenCalledOnce();
    expect(call("/hint/chat", { followUp: "suicidal" }, "GET").next).toHaveBeenCalledOnce();
    expect(call("/hint/chat", undefined).next).toHaveBeenCalledOnce();
  });
});
