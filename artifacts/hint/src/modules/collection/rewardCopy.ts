import type { HintLanguage } from "../../lib/i18n";

// Collection permits a local fallback; these messages do not imply server authority.
export const rewardCopy: Record<HintLanguage, { preparing: string; pending: string; conflict: string }> = {
  en: {
    preparing: "Preparing today's reward…",
    pending: "Saved on this device. Online sync has not completed.",
    conflict: "Saved on this device. This card differs from the reward saved online and is not synced.",
  },
  zh: {
    preparing: "正在准备今日奖励…",
    pending: "已保存在此设备上，在线同步尚未完成。",
    conflict: "已保存在此设备上。这张牌与在线保存的奖励不同，未同步。",
  },
  es: {
    preparing: "Preparando la recompensa de hoy…",
    pending: "Guardada en este dispositivo. La sincronización en línea no se ha completado.",
    conflict: "Guardada en este dispositivo. Esta carta difiere de la recompensa guardada en línea y no está sincronizada.",
  },
  ja: {
    preparing: "今日の報酬を準備しています…",
    pending: "この端末に保存済みです。オンライン同期はまだ完了していません。",
    conflict: "この端末に保存済みです。オンラインに保存された報酬とは異なるカードのため、同期されていません。",
  },
  ko: {
    preparing: "오늘의 보상을 준비하고 있어요…",
    pending: "이 기기에 저장됐어요. 온라인 동기화는 아직 완료되지 않았어요.",
    conflict: "이 기기에 저장됐어요. 온라인에 저장된 보상과 다른 카드여서 동기화되지 않았어요.",
  },
};
