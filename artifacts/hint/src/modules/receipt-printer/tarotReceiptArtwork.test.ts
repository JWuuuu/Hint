/** @vitest-environment jsdom */
import { expect, it } from "vitest";
import { buildTarotReceiptArtwork } from "./tarotReceiptArtwork";
import { buildTarotReceiptModel, type TarotReceiptModel } from "../tarot/logic/shareReceipt";
import type { LocalTarotReading } from "../readings/localTarotReadings";
import { receiptText } from "./receiptStrings";

const measure = (text: string, size: number) => [...text].length * size * .48;
const model = (count: number): TarotReceiptModel => ({
  theme: "bright", language: "en", title: "Four cards", date: "October 11, 2026", insight: "Overall reflection",
  cards: Array.from({ length: count }, (_, index) => ({ name: `Card ${index + 1}`, position: `Position ${index + 1}`, orientation: index % 2 ? "reversed" : "upright", image: `/cards/${index}.jpg`, meaning: "Trust your intuition. Take a little time to let things unfold." })),
  labels: { brand: "HINT", reading: "YOUR READING", footer: receiptText("en", "tarotFooter") },
});
const parse = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml");

it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])("matches all %i numbered cards to a separate explanation list", count => {
  const artwork = buildTarotReceiptArtwork(model(count), measure);
  const doc = parse(artwork.svg);
  expect(doc.querySelector("parsererror")).toBeNull();
  const cards = [...doc.querySelectorAll("[data-receipt-card]")];
  const meanings = [...doc.querySelectorAll("[data-receipt-meaning]")];
  expect(cards).toHaveLength(count);
  expect(meanings).toHaveLength(count);
  const diagramBottom = Math.max(...cards.map(card => {
    const image = card.querySelector("image")!;
    return Number(image.getAttribute("y")) + Number(image.getAttribute("height"));
  }));
  expect(doc.querySelectorAll("image[transform]")).toHaveLength(Math.floor(count / 2));
  cards.forEach((card, index) => {
    const number = card.querySelector('[data-card-text="number"]')!;
    const image = card.querySelector('image')!;
    const entry = meanings[index];
    expect(number.textContent).toBe(String(index + 1));
    expect(Number(number.getAttribute('y'))).toBeLessThan(Number(image.getAttribute('y')));
    expect(image.getAttribute('href')).toBe(`/cards/${index}.jpg`);
    expect(card.querySelector('[data-card-text="meaning"]')).toBeNull();
    expect(entry.querySelector('[data-card-text="meaning-number"]')?.textContent).toBe(String(index + 1));
    expect(entry.querySelector('[data-card-text="name"]')?.textContent).toBe(`Card ${index + 1}`);
    const position = entry.querySelector('[data-card-text="position"]')!;
    expect(position.textContent).toBe(`Position ${index + 1}`);
    expect(Number(position.getAttribute('y'))).toBeGreaterThan(diagramBottom);
  });
  expect(artwork.height).toBeLessThanOrEqual(4096);
});

it("prints True Heart in the chooser's four-corners-and-center arrangement", () => {
  const reading = {
    spreadType: "trueHeart", createdAt: "2026-10-27", shortAnswer: "Private answer",
    cards: ["18-moon", "17-star", "19-sun", "14-temperance", "0-fool"].map(cardId => ({ cardId, orientation: "upright" })),
  } as LocalTarotReading;
  const value = buildTarotReceiptModel(reading, false);
  expect(value.spreadType).toBe("trueHeart");
  const doc = parse(buildTarotReceiptArtwork(value, measure).svg);
  const cards = [...doc.querySelectorAll('[data-receipt-card] image')].map(image => ({
    x: Number(image.getAttribute('x')), y: Number(image.getAttribute('y')),
  }));
  expect(cards[0].x).toBe(cards[2].x);
  expect(cards[1].x).toBe(cards[3].x);
  expect(cards[0].y).toBe(cards[1].y);
  expect(cards[2].y).toBe(cards[3].y);
  expect(cards[4].x).toBeCloseTo((cards[0].x + cards[1].x) / 2);
  expect(cards[4].y).toBeCloseTo((cards[0].y + cards[2].y) / 2);
  expect([...doc.querySelectorAll('[data-card-text="position"]')].map(node => node.textContent)).toEqual(["Outer signal", "Inner feeling", "Block", "True view", "Future"]);
});

it("uses the spread's localized position meanings beneath numbered cards", () => {
  const reading = {
    spreadType: "three", createdAt: "2026-10-27", shortAnswer: "Private answer",
    cards: ["18-moon", "17-star", "19-sun"].map(cardId => ({ cardId, orientation: "upright", positionLabel: "Saved private label" })),
  } as LocalTarotReading;
  const doc = parse(buildTarotReceiptArtwork(buildTarotReceiptModel(reading, false, undefined, "zh"), measure).svg);
  expect([...doc.querySelectorAll('[data-card-text="number"]')].map(node => node.textContent)).toEqual(["1", "2", "3"]);
  expect([...doc.querySelectorAll('[data-card-text="position"]')].map(node => node.textContent)).toEqual(["过去", "现在", "下一步"]);
  expect(doc.documentElement.textContent).not.toContain("Private answer");
  expect(doc.documentElement.textContent).not.toContain("Saved private label");
});

it("keeps the roll and exported ticket content identical while cutting only the exported top edge", () => {
  const value = model(4);
  const roll = parse(buildTarotReceiptArtwork(value, measure, undefined, true).svg);
  const exported = parse(buildTarotReceiptArtwork(value, measure).svg);
  expect(roll.querySelector("svg > g")?.outerHTML).toBe(exported.querySelector("svg > g")?.outerHTML);
  expect(roll.querySelector("svg > path")?.getAttribute("d")).toMatch(/^M2 -2H648/);
  expect(exported.querySelector("svg > path")?.getAttribute("d")).toMatch(/^M44 2H606Q/);
  expect(roll.querySelector("[data-receipt-footer]")?.textContent).toContain(value.labels.footer);
});

it.each(["en", "zh", "es", "ja", "ko"] as const)("escapes and wraps %s text without changing the card images", language => {
  const value = { ...model(4), language, question: '<script>“Private & personal”</script>', personal: true };
  value.cards[0].name = '星星 <The Star> & "Hope"';
  const doc = parse(buildTarotReceiptArtwork(value, measure).svg);
  expect(doc.querySelector("parsererror, script")).toBeNull();
  expect(doc.querySelector("title")?.textContent).toBe(receiptText(language, "tarotReading"));
  expect(doc.documentElement.textContent).toContain('Private & personal');
  expect(doc.querySelector("image")?.getAttribute("href")).toBe(value.cards[0].image);
  expect(doc.querySelector("filter")).toBeNull();
});

it("uses public per-card meanings and adds private context only after opt-in", () => {
  const reading = { spreadType: "three", createdAt: "2026-10-11", question: "PRIVATE QUESTION", shortAnswer: "PRIVATE ANSWER", cards: [{ cardId: "18-moon", orientation: "upright", name: "PRIVATE NAME", keywords: ["PRIVATE KEYWORD"] }] } as LocalTarotReading;
  const publicModel = buildTarotReceiptModel(reading, false);
  const publicSvg = buildTarotReceiptArtwork(publicModel, measure).svg;
  expect(publicSvg).not.toContain("PRIVATE");
  expect(publicSvg).toContain("The Moon");
  const privateSvg = buildTarotReceiptArtwork(buildTarotReceiptModel(reading, true), measure).svg;
  expect(privateSvg).toContain("PRIVATE QUESTION");
  expect(privateSvg).toContain("PRIVATE ANSWER");
});

it("rejects oversized private text instead of clipping it", () => {
  expect(() => buildTarotReceiptArtwork({ ...model(4), question: "Long private question. ".repeat(1500) }, measure)).toThrow("too long");
});

it.each([1, 3, 4])("uses readable type and complete captions for %i cards", count => {
  const value = model(count);
  value.cards.forEach(card => { card.meaning = "Hope."; });
  const artwork = buildTarotReceiptArtwork(value, measure);
  expect(artwork.width).toBe(650);
  const doc = parse(artwork.svg);
  expect(doc.querySelector('[data-card-text="name"]')?.getAttribute('font-size')).toBe('34');
  expect(doc.querySelector('[data-card-text="meaning"]')?.getAttribute('font-size')).toBe('30');
  expect(doc.querySelector('[data-card-text="meaning"]')?.textContent).toBe('Hope.');
});

it("adds private copy without shrinking the card artwork or lettering", () => {
  const value = model(5);
  const publicArt = buildTarotReceiptArtwork(value, measure);
  const privateArt = buildTarotReceiptArtwork({ ...value, personal: true, question: 'A private question' }, measure);
  expect(privateArt.height).toBeGreaterThan(publicArt.height);
  const publicDoc = parse(publicArt.svg), privateDoc = parse(privateArt.svg);
  expect(privateDoc.querySelector('image')?.getAttribute('width')).toBe(publicDoc.querySelector('image')?.getAttribute('width'));
  expect(privateDoc.querySelector('[data-card-text="meaning"]')?.getAttribute('font-size')).toBe(publicDoc.querySelector('[data-card-text="meaning"]')?.getAttribute('font-size'));
});
