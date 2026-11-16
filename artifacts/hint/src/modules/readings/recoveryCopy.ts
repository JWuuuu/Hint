import type { HintLanguage } from "../../lib/i18n";

export const HISTORY_RECOVERY_COPY: Record<HintLanguage, { offline: string; detailError: string }> = {
  en: { offline: "You’re offline. Reconnect to load History. Available local records are still here.", detailError: "This reading could not be loaded. Please try again." },
  zh: { offline: "你目前处于离线状态。重新联网后可加载历史记录，本机已有记录仍可查看。", detailError: "暂时无法加载这份解读，请重试。" },
  es: { offline: "Estás sin conexión. Vuelve a conectarte para cargar el historial. Los registros locales siguen disponibles.", detailError: "No se pudo cargar esta lectura. Vuelve a intentarlo." },
  ja: { offline: "オフラインです。再接続すると履歴を読み込めます。端末内の記録は引き続き確認できます。", detailError: "このリーディングを読み込めませんでした。もう一度お試しください。" },
  ko: { offline: "오프라인 상태예요. 다시 연결하면 기록을 불러올 수 있어요. 기기에 저장된 기록은 계속 볼 수 있어요.", detailError: "이 리딩을 불러오지 못했어요. 다시 시도해 주세요." },
};
