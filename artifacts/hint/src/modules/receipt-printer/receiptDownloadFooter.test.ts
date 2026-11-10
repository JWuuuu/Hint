/** @vitest-environment jsdom */
import { expect, it } from "vitest";
import type { TarotReceiptModel } from "../tarot/logic/shareReceipt";
import { buildDailyReceiptArtwork } from "./dailyReceiptArtwork";
import { buildTarotReceiptArtwork } from "./tarotReceiptArtwork";

const measure = (value: string, size: number) => [...value].length * size * .48;
const parse = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml");
const model: TarotReceiptModel = {
  title: "Daily Tarot", date: "October 21, 2026", insight: "Take one thoughtful step.",
  cards: [{ name: "The Moon", position: "Your card", orientation: "upright", image: "/moon.jpg", meaning: "Trust your intuition." }],
  labels: { brand: "HINT", reading: "YOUR READING", footer: "A little letter from universe" },
};
const layouts = [
  { name: "Daily", build: (value: TarotReceiptModel, attached: boolean, downloadFooter = false) => buildDailyReceiptArtwork(value, measure, undefined, attached, { downloadFooter }) },
  { name: "Tarot", build: (value: TarotReceiptModel, attached: boolean, downloadFooter = false) => buildTarotReceiptArtwork(value, measure, undefined, attached, { downloadFooter }) },
];

for (const layout of layouts) {
  it.each(["bright", "dark"] as const)(`${layout.name} adds the download footer only to %s exports and preserves the reading above it`, theme => {
    const value = { ...model, theme };
    const original = parse(layout.build(value, false).svg);
    const exported = parse(layout.build(value, false, true).svg);
    const roll = parse(layout.build(value, true, true).svg);
    expect(exported.querySelector("parsererror")).toBeNull();
    expect(roll.querySelector("[data-receipt-download-footer]")).toBeNull();
    expect(roll.querySelector("[data-receipt-footer]")).not.toBeNull();
    const footer = exported.querySelector("[data-receipt-download-footer]")!;
    expect(footer.querySelectorAll("[data-receipt-qr-placeholder]")).toHaveLength(1);
    expect(footer.textContent).toContain("Download our app");
    expect(footer.querySelector("image")).toBeNull();
    const palette = original.querySelector("svg > path")!;
    expect(exported.querySelector("svg > path")?.getAttribute("fill")).toBe(palette.getAttribute("fill"));
    const body = (document: Document) => [...document.querySelector("svg > g")!.children]
      .filter(element => !element.hasAttribute("data-receipt-footer") && !element.hasAttribute("data-receipt-download-footer"))
      .map(element => element.outerHTML);
    expect(body(exported)).toEqual(body(original));
  });
}

it("uses identical footer geometry for Daily and Tarot, with safe escaped message text", () => {
  const value = { ...model, labels: { ...model.labels, footer: 'A letter <from> the universe & you' } };
  const footers = layouts.map(layout => parse(layout.build(value, false, true).svg).querySelector("[data-receipt-download-footer]")!);
  // Each receipt retains its own palette; the positions, sizes and copy match.
  footers.forEach(footer => footer.querySelectorAll("[fill], [stroke]").forEach(element => {
    element.removeAttribute("fill"); element.removeAttribute("stroke");
  }));
  expect(footers[0].innerHTML).toBe(footers[1].innerHTML);
  expect(footers[0].querySelector("from")).toBeNull();
  expect(footers[0].textContent).toContain("<from>");
});
