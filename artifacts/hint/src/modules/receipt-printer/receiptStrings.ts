import type { HintLanguage } from "../../lib/i18n";
const copy = {
  upright: ["Upright", "正位", "Derecha", "正位置", "정방향"],
  reversed: ["Reversed", "逆位", "Invertida", "逆位置", "역방향"],
  paper: ["View printed letter", "查看打印小票", "Ver carta impresa", "印刷した手紙を見る", "인쇄한 편지 보기"],
  public: ["Use card reflection", "改用牌卡反思", "Usar reflexión de las cartas", "カードの振り返りを使う", "카드 성찰 사용"],
  tryAgain: ["Try again", "重试", "Reintentar", "再試行", "다시 시도"],
  title: ["A letter to keep", "留住这封来信", "Una carta para guardar", "手元に残す手紙", "간직할 편지"],
  subtitle: ["Check your receipt before sharing.", "分享前，请检查小票内容。", "Revisa tu recibo antes de compartirlo.", "共有する前にレシートをご確認ください。", "공유하기 전에 내용을 확인하세요."],
  share: ["Share receipt", "分享小票", "Compartir recibo", "レシートを共有", "영수증 공유"],
  close: ["Back to reading", "返回阅读", "Volver a la lectura", "リーディングに戻る", "리딩으로 돌아가기"],
  preparing: ["Preparing your receipt…", "正在制作小票…", "Preparando tu recibo…", "レシートを準備中…", "영수증 준비 중…"],
  printing: ["Printing your letter…", "正在打印你的来信…", "Imprimiendo tu carta…", "手紙を印刷中…", "편지를 인쇄하는 중…"],
  preview: ["Check image", "检查分享图片", "Revisar imagen", "画像を確認", "이미지 확인"],
  replay: ["Print again", "再次打印", "Volver a imprimir", "もう一度印刷", "다시 인쇄"],
  skip: ["Show receipt", "直接查看小票", "Ver recibo", "レシートを見る", "영수증 보기"],
  include: ["Include my private question and personal interpretation", "包含我的私人问题与个人解读", "Incluir mi pregunta privada e interpretación personal", "個人的な質問と解釈を含める", "개인 질문과 개인 해석 포함"],
  retry: ["Could not prepare this image. Try again.", "图片制作失败，请重试。", "No se pudo preparar la imagen. Inténtalo de nuevo.", "画像を作成できませんでした。再試行してください。", "이미지를 만들지 못했어요. 다시 시도해 주세요."],
  shareError: ["Sharing did not finish. Try again.", "分享未完成，请重试。", "No se completó el envío. Inténtalo de nuevo.", "共有が完了しませんでした。再試行してください。", "공유를 완료하지 못했어요. 다시 시도해 주세요."],
  shared: ["Shared", "已分享", "Compartido", "共有しました", "공유 완료"],
  downloaded: ["Download started", "已开始下载", "Descarga iniciada", "ダウンロードを開始しました", "다운로드 시작됨"],
  daily: ["Daily Hint", "每日来信", "Hint del día", "今日の Hint", "오늘의 Hint"],
  card: ["Your card", "你的牌卡", "Tu carta", "あなたのカード", "나의 카드"],
  energy: ["Daily reflection score", "每日反思分数", "Puntuación de reflexión diaria", "今日の振り返りスコア", "오늘의 성찰 점수"],
  footer: ["A little letter from the universe.", "来自宇宙的一封小信。", "Una pequeña carta del universo.", "宇宙からの小さな手紙。", "우주에서 온 작은 편지."],
  long: ["This private text is too long for one receipt. Share the card reflection instead.", "私人文字超出单张小票容量，可以改为分享牌卡反思。", "El texto privado es demasiado largo. Comparte la reflexión de las cartas.", "個人の文章が長すぎます。カードの振り返りを共有できます。", "개인 글이 너무 길어요. 카드 성찰을 공유할 수 있어요."],
} as const;
export type ReceiptString = keyof typeof copy;
export function receiptText(language: HintLanguage, key: ReceiptString): string {
  return copy[key][({ en: 0, zh: 1, es: 2, ja: 3, ko: 4 } as const)[language]];
}
