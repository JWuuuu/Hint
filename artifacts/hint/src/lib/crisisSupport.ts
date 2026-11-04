/**
 * Fixed crisis-resource reply (T19). When a question or message states an intent to
 * end one's life or to self-harm, Hint answers with this text instead of a reading or
 * an AI reply, and no model call is made.
 *
 * Two identical copies exist so the app can answer offline and the server can refuse
 * before any model call:
 * - artifacts/hint/src/lib/crisisSupport.ts
 * - artifacts/api-server/src/lib/crisisSupport.ts
 * A server test fails if they differ.
 */
export type CrisisLanguage = "en" | "zh" | "es" | "ja" | "ko";

// Explicit statements only. Ordinary sadness and idioms ("dying to know", "killing it",
// a phone "going to die", 想死你了 "miss you so much") must not match; the tests list them.
const PATTERNS: ReadonlyArray<readonly [CrisisLanguage, RegExp]> = [
  ["en", /\b(?:kill(?:ing)?\s+myself|end(?:ing)?\s+(?:my\s+(?:own\s+)?life|it\s+all)|take\s+my\s+(?:own\s+)?life|commit(?:ting)?\s+suicide|suicidal|(?:want|wanna)\s+(?:to\s+)?die\b|don'?t\s+want\s+to\s+(?:live|be\s+alive|exist\s+anymore)|no\s+reason\s+to\s+(?:live|go\s+on)|better\s+off\s+dead|(?:hurt|harm|cut)(?:ting)?\s+myself|self[-\s]?harm)/i],
  ["zh", /(?:自杀|自殺|想死(?![你您他她它])|不想活|活不下去|轻生|輕生|结束(?:我的|自己的)?生命|結束(?:我的|自己的)?生命|割腕|自残|自殘|伤害自己|傷害自己)/],
  ["es", /\b(?:suicid(?:arme|arse|io)|pensamientos\s+suicidas|quitarme\s+la\s+vida|matarme|no\s+quiero\s+(?:vivir|seguir\s+viviendo)|quiero\s+morir(?:me)?|hacerme\s+da[ñn]o|autolesi(?:ón|on|onarme)|acabar\s+con\s+mi\s+vida)/i],
  ["ja", /(?:自殺|死にたい|消えたい|生きていたくない|生きたくない|自傷|リストカット|命を絶)/],
  ["ko", /(?:자살|죽고\s*싶|살고\s*싶지\s*않|자해|목숨을\s*끊|사라지고\s*싶)/],
];

/** The language of the first explicit crisis statement in `text`, or null. */
export function detectCrisis(text: string | null | undefined): CrisisLanguage | null {
  if (!text) return null;
  const normalized = text.normalize("NFKC");
  for (const [language, pattern] of PATTERNS) if (pattern.test(normalized)) return language;
  return null;
}

export type CrisisCopy = { title: string; body: string; helplineLabel: string; back: string };

export const CRISIS_HELPLINE_URL = "https://findahelpline.com";

export const CRISIS_COPY: Record<CrisisLanguage, CrisisCopy> = {
  en: {
    title: "You deserve real support right now",
    body: "It sounds like you may be thinking about ending your life or hurting yourself, and you deserve support from a real person right now. If you might act on these thoughts, please call your local emergency number now. In the US, you can call or text 988 to reach the Suicide & Crisis Lifeline. Anywhere else, findahelpline.com lists crisis lines by country. If you can, tell someone you trust how you're feeling.",
    helplineLabel: "Find a helpline near you",
    back: "Back to my question",
  },
  zh: {
    title: "此刻你值得得到真正的支持",
    body: "听起来你可能在想结束生命或伤害自己，此刻你值得得到真实的人的支持。如果你可能会付诸行动，请立即拨打当地的紧急电话。在美国，你可以拨打或发短信至 988，联系自杀与危机生命线。在其他地区，findahelpline.com 按国家列出了危机热线。如果可以，请告诉一位你信任的人你现在的感受。",
    helplineLabel: "查找你附近的求助热线",
    back: "返回我的问题",
  },
  es: {
    title: "Mereces apoyo real ahora mismo",
    body: "Parece que podrías estar pensando en quitarte la vida o en hacerte daño, y mereces el apoyo de una persona real ahora mismo. Si crees que podrías actuar según estos pensamientos, llama ahora al número de emergencias de tu zona. En EE. UU., puedes llamar o enviar un mensaje de texto al 988 para contactar con la Línea de Prevención del Suicidio y Crisis. En otros lugares, findahelpline.com reúne líneas de crisis por país. Si puedes, cuéntale a alguien de confianza cómo te sientes.",
    helplineLabel: "Busca una línea de ayuda cerca de ti",
    back: "Volver a mi pregunta",
  },
  ja: {
    title: "今、ひとりで抱え込まないでください",
    body: "命を絶つことや自分を傷つけることを考えているように聞こえます。今は、実際の人の支えを受けてほしいと思います。行動に移してしまいそうなら、今すぐ地域の緊急通報番号に電話してください。米国では 988 に電話またはテキストで、自殺・危機ライフラインにつながります。その他の地域では、findahelpline.com で国ごとの相談窓口を探せます。できれば、信頼できる人に今の気持ちを伝えてください。",
    helplineLabel: "近くの相談窓口を探す",
    back: "質問に戻る",
  },
  ko: {
    title: "지금 진짜 도움을 받아도 괜찮아요",
    body: "삶을 끝내거나 스스로를 해치는 생각을 하고 계신 것 같아요. 지금은 실제 사람의 도움을 받으셨으면 해요. 생각을 행동으로 옮길 것 같다면 지금 바로 지역 응급 번호로 전화해 주세요. 미국에서는 988로 전화하거나 문자를 보내 자살·위기 상담 전화에 연결할 수 있어요. 그 밖의 지역에서는 findahelpline.com에서 나라별 위기 상담 전화를 찾을 수 있어요. 가능하다면 믿을 수 있는 사람에게 지금 기분을 이야기해 주세요.",
    helplineLabel: "가까운 상담 전화 찾기",
    back: "질문으로 돌아가기",
  },
};
