import { hintDownloadUrl, parseHintUniversalLink } from "@/lib/publicUrls";
import { isNativeShell } from "@/lib/mobile/runtime";
import { useLanguage, type HintLanguage } from "@/lib/i18n";

const copy: Record<HintLanguage, [string, string, string]> = {
  en: ["An invitation to connect", "Open this invitation on your iPhone with Hint installed. Birth details and results are available only to the two participating devices.", "Get Hint"],
  zh: ["一起探索的邀请", "安装 Hint 后，请在 iPhone 上打开此邀请。出生资料与结果仅向参与的两台设备开放。", "获取 Hint"],
  es: ["Una invitación para conectar", "Abre esta invitación en tu iPhone con Hint instalado. Los datos de nacimiento y los resultados solo están disponibles en los dos dispositivos participantes.", "Obtener Hint"],
  ja: ["つながるための招待", "Hint をインストールした iPhone でこの招待を開いてください。出生情報と結果は、参加する2台のデバイスでのみ表示できます。", "Hint を入手"],
  ko: ["함께하는 초대", "Hint가 설치된 iPhone에서 이 초대를 여세요. 출생 정보와 결과는 참여한 두 기기에서만 확인할 수 있습니다.", "Hint 받기"],
};
export function shouldShowPublicInvitationLanding() {
  return !isNativeShell() && import.meta.env.PROD && Boolean(parseHintUniversalLink(window.location.href));
}
export function PublicInvitationLanding() {
  const { language } = useLanguage();
  const [title, body, action] = copy[language];
  let download: string | null = null;
  try { download = hintDownloadUrl(); } catch { /* Missing release config never becomes a local URL. */ }
  return <main className="hint-app-scroll flex h-full flex-col justify-center overflow-y-auto px-6 py-16" style={{ color: "var(--hint-text)" }}>
    <h1 className="font-serif text-3xl">{title}</h1>
    <p className="mt-5 text-base leading-relaxed">{body}</p>
    {download && <a href={download} referrerPolicy="no-referrer" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-3">{action}</a>}
  </main>;
}
