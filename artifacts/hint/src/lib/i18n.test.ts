import { expect, it } from "vitest";
import { TRANSLATIONS, LANGUAGE_OPTIONS } from "./i18n";
import { LITERAL_COPY } from "./literalCopy";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
it("every declared locale supplies all English resource keys", () => {
  for (const { code } of LANGUAGE_OPTIONS) {
    const missing = Object.keys(TRANSLATIONS.en).filter(key => !TRANSLATIONS[code][key]);
    expect(missing, `Missing ${code} keys`).toEqual([]);
  }
});
it("literal translation keys used by app code exist", () => {
  const missing = new Set<string>();
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.tsx?$/.test(file) && !file.includes(".test.")) {
        for (const match of readFileSync(file, "utf8").matchAll(/\bt\(\s*["']([\w.-]+\.[\w.-]+)["']\s*\)/g)) if (!TRANSLATIONS.en[match[1]]) missing.add(match[1]);
      }
    }
  }
  scan(resolve(process.cwd(), "src"));
  expect([...missing].sort()).toEqual([]);
});
it("page copy provides every declared locale", () => {
  for (const [key, values] of Object.entries(LITERAL_COPY)) {
    for (const { code } of LANGUAGE_OPTIONS) expect(values[code], `${code}:${key}`).toBeTruthy();
  }
});
it("localized templates retain interpolation placeholders", () => {
  const placeholders = (text: string) => [...text.matchAll(/\{[a-zA-Z]+\}/g)].map(m => m[0]).sort();
  for (const [key, english] of Object.entries(TRANSLATIONS.en)) {
    for (const { code } of LANGUAGE_OPTIONS) if (TRANSLATIONS[code][key]) {
      expect(placeholders(TRANSLATIONS[code][key]), `${code}:${key}`).toEqual(placeholders(english));
    }
  }
});

it("authored JSX translations and conditional labels have registered resources", () => {
  const known = new Set([...Object.values(TRANSLATIONS.en), ...Object.keys(LITERAL_COPY)]);
  const unchangedCredits = new Set(["Hint", "HINT", "hint", "· NASA APOD"]);
  const missing = new Set<string>();
  function literals(node: ts.Node | undefined): string[] {
    if (!node) return [];
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (ts.isConditionalExpression(node)) return [...literals(node.whenTrue), ...literals(node.whenFalse)];
    return [];
  }
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) { scan(file); continue; }
      if (!file.endsWith(".tsx") || file.includes(".test.")) continue;
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node) {
        let labels: string[] = [];
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "LocalizedText") {
          const attribute = node.attributes.properties.find((item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText(source) === "text");
          const value = attribute?.initializer;
          labels = literals(value && ts.isJsxExpression(value) ? value.expression : value);
        }
        if (ts.isCallExpression(node) && node.expression.getText(source) === "translateText") labels = literals(node.arguments[0]);
        for (const label of labels) {
          const normalized = label.replace(/\s+/g, " ").trim();
          if (/[A-Za-z]{3}/.test(normalized) && !known.has(normalized) && !unchangedCredits.has(normalized)) missing.add(normalized);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  scan(resolve(process.cwd(), "src"));
  expect([...missing].sort()).toEqual([]);
});
