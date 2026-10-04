import type { HintLanguage } from "../../lib/i18n";

const COPY = {
  draftReady: ["A previous draft is still here if you want it.", "之前的草稿仍在，你可以选择恢复。", "Tu borrador anterior sigue aquí si quieres recuperarlo.", "前の下書きは、必要なときに戻せます。", "이전 초안은 원할 때 다시 불러올 수 있어요."],
  restoreDraft: ["Restore draft", "恢复草稿", "Recuperar borrador", "下書きを戻す", "초안 불러오기"],
  quizReady: ["Start a new reflection, or return to your previous quiz.", "开始新的探索，或回到之前的测验。", "Empieza una nueva reflexión o vuelve a tu test anterior.", "新しく始めることも、前の診断に戻ることもできます。", "새롭게 시작하거나 이전 테스트로 돌아갈 수 있어요."],
  restoreQuiz: ["Return to previous quiz", "恢复之前的测验", "Volver al test anterior", "前の診断に戻る", "이전 테스트로 돌아가기"],
  previousResult: ["View previous result", "查看之前的结果", "Ver resultado anterior", "前の結果を見る", "이전 결과 보기"],
  sameAnimal: ["Your animal stays the same today. Open the card when you are ready.", "今天的动物伙伴不会改变。准备好时，再打开这张牌。", "Tu animal de hoy sigue siendo el mismo. Abre la carta cuando quieras.", "今日の動物は変わりません。準備ができたらカードを開いてください。", "오늘의 동물은 그대로예요. 준비되면 카드를 열어 보세요."],
} as const satisfies Record<string, readonly [string, string, string, string, string]>;

export function roomResumeText(language: HintLanguage, key: keyof typeof COPY): string {
  const index = ({ en: 0, zh: 1, es: 2, ja: 3, ko: 4 } as const)[language];
  return COPY[key][index];
}
