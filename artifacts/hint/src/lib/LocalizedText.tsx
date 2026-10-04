import { useLanguage, TRANSLATIONS, type HintLanguage } from "./i18n";
import { LITERAL_COPY } from "./literalCopy";

const englishKeys = new Map(Object.entries(TRANSLATIONS.en).map(([key, value]) => [value, key]));
/** Translate authored page copy without adding elements or changing layout. */
export function translateText(text: string, language: HintLanguage = "en"): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const literal = LITERAL_COPY[normalized];
  const key = englishKeys.get(normalized);
  const translated = literal?.[language] ?? (key ? TRANSLATIONS[language][key] : undefined);
  return translated ? `${text.match(/^\s*/)?.[0] ?? ""}${translated}${text.match(/\s*$/)?.[0] ?? ""}` : text;
}
export function LocalizedText({ text }: { text: string }) {
  const { language } = useLanguage();
  return <>{translateText(text, language)}</>;
}
