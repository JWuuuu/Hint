import { useState, useSyncExternalStore } from "react";
import { useLanguage, type HintLanguage } from "@/lib/i18n";
import { getDeviceSessionFailure, getDeviceSessionToken, subscribeDeviceSession } from "@/lib/deviceSession";

const copy: Record<HintLanguage, { unavailable: string; storage: string; expired: string; revoked: string; retry: string }> = {
  en: { unavailable: "Device connection unavailable. Your local content is kept.", storage: "This device could not save its connection. Free some storage and retry.", expired: "This device connection has expired. Your local content is kept; contact support to reconnect.", revoked: "This device connection is no longer valid. Your local content is kept; contact support to reconnect.", retry: "Retry connection" },
  zh: { unavailable: "设备连接暂时不可用，本机内容仍保留。", storage: "无法保存设备连接。请释放一些储存空间后重试。", expired: "设备连接已到期。本机内容仍保留，请联系支持以重新连接。", revoked: "设备连接已失效。本机内容仍保留，请联系支持以重新连接。", retry: "重试连接" },
  es: { unavailable: "La conexión del dispositivo no está disponible. Tu contenido local se conserva.", storage: "No se pudo guardar la conexión. Libera espacio y vuelve a intentarlo.", expired: "La conexión ha caducado. Tu contenido local se conserva; contacta con soporte.", revoked: "La conexión ya no es válida. Tu contenido local se conserva; contacta con soporte.", retry: "Reintentar conexión" },
  ja: { unavailable: "デバイスに接続できません。端末内の内容は保持されています。", storage: "接続情報を保存できません。空き容量を確保して再試行してください。", expired: "接続の有効期限が切れました。端末内の内容は保持されています。サポートにお問い合わせください。", revoked: "この接続は無効です。端末内の内容は保持されています。サポートにお問い合わせください。", retry: "接続を再試行" },
  ko: { unavailable: "기기에 연결할 수 없습니다. 기기에 저장된 내용은 유지됩니다.", storage: "연결 정보를 저장할 수 없습니다. 저장 공간을 확보한 후 다시 시도하세요.", expired: "연결이 만료되었습니다. 기기에 저장된 내용은 유지됩니다. 지원팀에 문의하세요.", revoked: "연결이 더 이상 유효하지 않습니다. 기기에 저장된 내용은 유지됩니다. 지원팀에 문의하세요.", retry: "연결 다시 시도" },
};
export function DeviceConnectionStatus() {
  const { language } = useLanguage();
  const failure = useSyncExternalStore(subscribeDeviceSession, getDeviceSessionFailure, () => null);
  const [retrying, setRetrying] = useState(false);
  if (!failure) return null;
  const text = copy[language];
  return <div role="status" className="mt-3 rounded-2xl border p-4 text-sm leading-relaxed" style={{ color: "var(--hint-text)", borderColor: "var(--hint-border)" }}>
    <p>{text[failure]}</p>
    {(failure === "storage" || failure === "unavailable") && <button type="button" className="mt-2 min-h-11 px-3 underline" disabled={retrying} onClick={() => {
      if (retrying) return;
      setRetrying(true);
      void getDeviceSessionToken().catch(() => undefined).finally(() => setRetrying(false));
    }}>{text.retry}</button>}
  </div>;
}
