import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
import { LANGUAGE_OPTIONS, TRANSLATIONS } from "../../lib/i18n";
import { translateText } from "../../lib/LocalizedText";

function literals(node: ts.Node | undefined): string[] {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isConditionalExpression(node)) return [...literals(node.whenTrue), ...literals(node.whenFalse)];
  return [];
}

it("onboarding authored copy, including indirect headings, choices and errors, has all five languages", () => {
  const source = ts.createSourceFile("OnboardingGate.tsx", readFileSync(resolve(process.cwd(), "src/components/app/OnboardingGate.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const copy = new Set<string>();
  const keys = new Set<string>();
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && ["text", "label", "detail", "eyebrow", "title", "body"].includes(node.name.getText(source))) {
      const value = node.initializer;
      literals(value && ts.isJsxExpression(value) ? value.expression : value).forEach(text => copy.add(text.trim()));
    }
    if (ts.isPropertyAssignment(node) && ["label", "detail"].includes(node.name.getText(source))) literals(node.initializer).forEach(text => copy.add(text));
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      if (["setError", "translateText"].includes(callee)) literals(node.arguments[0]).forEach(text => copy.add(text));
      if (callee === "t") literals(node.arguments[0]).forEach(key => keys.add(key));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(copy.size).toBeGreaterThan(45);
  // Registered Spanish terms legitimately share their spelling with English.
  // These are explicit resource values, not missing-key fallbacks.
  const unchangedSpanish = new Set(["Email", "LEO", "LIBRA"]);
  for (const { code } of LANGUAGE_OPTIONS) {
    for (const key of keys) expect(TRANSLATIONS[code][key], `${code}:${key}`).toBeTruthy();
    for (const english of copy) {
      const value = translateText(english, code);
      expect(value, `${code}:${english}`).toBeTruthy();
      if (code !== "en" && english !== "Hint" && !(code === "es" && unchangedSpanish.has(english))) expect(value, `${code}:${english}`).not.toBe(english);
    }
  }
});
