import { describe, expect, it } from "vitest";
import { balanceReceiptTitle, getTarotReceiptCardLayout, wrapReceiptText } from "./receiptLayout";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const measure = (text: string) => [...graphemes.segment(text)].length * 10;
const compact = (text: string) => text.replace(/\s/g, "");

describe("receipt text and artwork layout", () => {
  it.each([
    "The Knight of Pentacles asks for patience, consistency, and a practical next step.",
    "這次的牌面提醒你，先照顧自己的感受，再用清楚而溫柔的方式表達你的想法。不要急著做出決定。",
    "感情の請求書を見事にかわす。あなたのタイプを見つける。",
    "Hint 的 Queen of Pentacles 提醒你，take your time，慢慢建立信任。",
    "averylongunbrokentokenwithoutspaces".repeat(3),
    "A family 👨‍👩‍👧‍👦 and cafe\u0301 deserve time. A family 👨‍👩‍👧‍👦 and cafe\u0301 deserve time.",
  ])("wraps without dropping text or exceeding the margin: %s", (text) => {
    const lines = wrapReceiptText(text, 130, measure);
    expect(compact(lines.join(" "))).toBe(compact(text));
    expect(lines.every((line) => measure(line) <= 130)).toBe(true);
    expect(lines.join(" ")).not.toContain("...");
    for (const line of lines) {
      expect(line).not.toMatch(/^[.,;:!?，。；：！？、]/u);
      expect(line).not.toMatch(/^\p{Mark}|\u200d$/u);
    }
  });

  it("keeps complete paragraphs and fills the final line", () => {
    expect(wrapReceiptText("One two three four five six", 140, measure))
      .toEqual(["One two three", "four five six"]);
    expect(wrapReceiptText("First thought.\n\nSecond thought.", 200, measure))
      .toEqual(["First thought.", "", "Second thought."]);
  });

  it("keeps Personality result words whole when each word fits", () => {
    expect(wrapReceiptText("The Professional Avoider", 210, measure)).toEqual(["The Professional", "Avoider"]);
    const subtitle = wrapReceiptText("You can dodge an emotional bill with Olympic precision.", 420, measure);
    expect(subtitle).toEqual(["You can dodge an emotional bill with", "Olympic precision."]);
  });

  it("balances a long title without leaving a tiny final line or breaking an English word", () => {
    const title = "關係裡的內在感受與未來方向";
    const lines = balanceReceiptTitle(title, 120, measure);
    expect(lines).toHaveLength(2);
    expect(lines.join("")).toBe(title);
    expect(Math.abs(measure(lines[0]!) - measure(lines[1]!))).toBeLessThanOrEqual(20);
    expect(balanceReceiptTitle("Your Relationship Reading", 200, measure)).toEqual(["Your Relationship", "Reading"]);
  });

  it("rejects a width too small for one complete grapheme", () => {
    expect(() => wrapReceiptText("a", 0, measure)).toThrow();
    expect(() => wrapReceiptText("a👨‍👩‍👧‍👦", 15, (value) => value.includes("👨") ? 30 : measure(value))).toThrow();
  });

  it.each([1, 3, 5, 7, 9])("keeps %i cards legible with at most three columns", (count) => {
    const layout = getTarotReceiptCardLayout(count);
    expect(layout.columns).toBe(Math.min(3, count));
    expect(layout.rows).toBe(Math.ceil(count / 3));
    expect(layout.cardWidth).toBeGreaterThanOrEqual(144);
    expect(layout.startX).toBeGreaterThanOrEqual(70);
    expect(layout.startX + layout.visibleWidth).toBeLessThanOrEqual(830);
  });

  it.each([0, -1, 10, NaN, Infinity, 2.5])("rejects invalid card counts instead of silently losing cards: %s", (count) => {
    expect(() => getTarotReceiptCardLayout(count)).toThrow();
  });
});
