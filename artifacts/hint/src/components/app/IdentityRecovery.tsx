const messages = {
  en: ["Your local profile could not be opened", "Your saved data has been kept. Free device storage if needed, then retry.", "Try again"],
  zh: ["暂时无法打开本机资料", "已保存的数据仍然保留。如有需要，请释放设备储存空间后重试。", "重试"],
  es: ["No se pudo abrir tu perfil local", "Tus datos guardados se han conservado. Libera espacio en el dispositivo si es necesario e inténtalo de nuevo.", "Reintentar"],
  ja: ["この端末のプロフィールを開けませんでした", "保存したデータは保持されています。必要に応じて端末の空き容量を増やしてから、もう一度お試しください。", "再試行"],
  ko: ["이 기기의 프로필을 열 수 없어요", "저장된 데이터는 유지됩니다. 필요한 경우 기기 저장 공간을 확보한 뒤 다시 시도해 주세요.", "다시 시도"],
};

/** Recovery never clears storage or mounts readers over a partial identity. */
export function IdentityRecovery() {
  let language = "en";
  try { language = localStorage.getItem("hint-language") || "en"; } catch { /* Storage itself may be the unavailable service. */ }
  const [title, detail, retry] = messages[language as keyof typeof messages] ?? messages.en;
  return <main style={{ minHeight: "100dvh", padding: "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))", display: "grid", placeContent: "center", gap: 16, color: "#30243d", background: "#f7f3fb" }}>
    <h1 style={{ fontSize: 24 }}>{title}</h1>
    <p role="alert" style={{ maxWidth: 440, lineHeight: 1.6 }}>{detail}</p>
    <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 48, padding: "12px 24px", borderRadius: 12, background: "#523966", color: "white" }}>{retry}</button>
  </main>;
}
