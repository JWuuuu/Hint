import { useState, useSyncExternalStore } from "react";
import { useLanguage, type HintLanguage } from "@/lib/i18n";
import { getDeviceSessionFailure, getDeviceSessionToken, readTesterInvite, saveTesterInvite, subscribeDeviceSession } from "@/lib/deviceSession";

const copy: Record<HintLanguage, { unavailable: string; storage: string; expired: string; revoked: string; retry: string; invite: string; inviteFull: string; inviteLabel: string; connect: string }> = {
  en: { unavailable: "Device connection unavailable. Your local content is kept.", storage: "This device could not save its connection. Free some storage and retry.", expired: "This device connection has expired. Your local content is kept; contact support to reconnect.", revoked: "This device connection is no longer valid. Your local content is kept; contact support to reconnect.", retry: "Retry connection" , invite: "This private beta needs a tester invite. Enter the code from your invite link. Your local content is kept.", inviteFull: "This tester invite is already connected on its maximum number of devices. Ask for another code. Your local content is kept.", inviteLabel: "Tester invite code", connect: "Connect" },
  zh: { unavailable: "设备连接暂时不可用，本机内容仍保留。", storage: "无法保存设备连接。请释放一些储存空间后重试。", expired: "设备连接已到期。本机内容仍保留，请联系支持以重新连接。", revoked: "设备连接已失效。本机内容仍保留，请联系支持以重新连接。", retry: "重试连接" , invite: "此内测版需要测试邀请码。请输入邀请链接中的代码，本机内容仍保留。", inviteFull: "此邀请码已在最多数量的设备上使用。请索取新的代码，本机内容仍保留。", inviteLabel: "测试邀请码", connect: "连接" },
  es: { unavailable: "La conexión del dispositivo no está disponible. Tu contenido local se conserva.", storage: "No se pudo guardar la conexión. Libera espacio y vuelve a intentarlo.", expired: "La conexión ha caducado. Tu contenido local se conserva; contacta con soporte.", revoked: "La conexión ya no es válida. Tu contenido local se conserva; contacta con soporte.", retry: "Reintentar conexión" , invite: "Esta beta privada necesita una invitación de prueba. Escribe el código de tu enlace de invitación. Tu contenido local se conserva.", inviteFull: "Esta invitación ya está conectada en el máximo de dispositivos. Pide otro código. Tu contenido local se conserva.", inviteLabel: "Código de invitación", connect: "Conectar" },
  ja: { unavailable: "デバイスに接続できません。端末内の内容は保持されています。", storage: "接続情報を保存できません。空き容量を確保して再試行してください。", expired: "接続の有効期限が切れました。端末内の内容は保持されています。サポートにお問い合わせください。", revoked: "この接続は無効です。端末内の内容は保持されています。サポートにお問い合わせください。", retry: "接続を再試行" , invite: "このプライベートベータにはテスター招待コードが必要です。招待リンクのコードを入力してください。端末内の内容は保持されています。", inviteFull: "この招待コードは上限台数のデバイスで使用されています。別のコードを依頼してください。端末内の内容は保持されています。", inviteLabel: "テスター招待コード", connect: "接続" },
  ko: { unavailable: "기기에 연결할 수 없습니다. 기기에 저장된 내용은 유지됩니다.", storage: "연결 정보를 저장할 수 없습니다. 저장 공간을 확보한 후 다시 시도하세요.", expired: "연결이 만료되었습니다. 기기에 저장된 내용은 유지됩니다. 지원팀에 문의하세요.", revoked: "연결이 더 이상 유효하지 않습니다. 기기에 저장된 내용은 유지됩니다. 지원팀에 문의하세요.", retry: "연결 다시 시도" , invite: "이 비공개 베타는 테스터 초대 코드가 필요합니다. 초대 링크의 코드를 입력하세요. 기기에 저장된 내용은 유지됩니다.", inviteFull: "이 초대 코드는 이미 최대 기기 수에서 사용 중입니다. 다른 코드를 요청하세요. 기기에 저장된 내용은 유지됩니다.", inviteLabel: "테스터 초대 코드", connect: "연결" },
};
export function DeviceConnectionStatus() {
  const { language } = useLanguage();
  const failure = useSyncExternalStore(subscribeDeviceSession, getDeviceSessionFailure, () => null);
  const [retrying, setRetrying] = useState(false);
  const [invite, setInvite] = useState(() => readTesterInvite() ?? "");
  if (!failure) return null;
  const text = copy[language];
  const retry = () => {
    if (retrying) return;
    setRetrying(true);
    void getDeviceSessionToken().catch(() => undefined).finally(() => setRetrying(false));
  };
  return <div role="status" className="mt-3 rounded-2xl border p-4 text-sm leading-relaxed" style={{ color: "var(--hint-text)", borderColor: "var(--hint-border)" }}>
    <p>{text[failure]}</p>
    {(failure === "invite" || failure === "inviteFull") && <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={event => {
      event.preventDefault();
      saveTesterInvite(invite);
      retry();
    }}>
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span>{text.inviteLabel}</span>
        <input value={invite} onChange={event => setInvite(event.target.value)} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false}
          maxLength={20} className="min-h-11 rounded-xl border px-3 tracking-[0.08em]" style={{ borderColor: "var(--hint-border)", background: "transparent", color: "var(--hint-text)" }} />
      </label>
      <button type="submit" className="min-h-11 px-3 underline" disabled={retrying || !invite.trim()}>{text.connect}</button>
    </form>}
    {(failure === "storage" || failure === "unavailable") && <button type="button" className="mt-2 min-h-11 px-3 underline" disabled={retrying} onClick={retry}>{text.retry}</button>}
  </div>;
}
