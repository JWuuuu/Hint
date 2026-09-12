import { Component, Suspense, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useLanguage } from "../lib/i18n";

const COPY = {
  en: ["Opening the room…", "This room could not be loaded.", "Check your connection, then reload this page to try again.", "Reload room"],
  zh: ["正在打开房间…", "无法加载此房间。", "检查连接后重新加载此页以重试。", "重新加载房间"],
  es: ["Abriendo el espacio…", "No se pudo cargar este espacio.", "Comprueba la conexión y vuelve a cargar esta página.", "Volver a cargar"],
  ja: ["ルームを開いています…", "このルームを読み込めませんでした。", "接続を確認して、このページを再読み込みしてください。", "再読み込み"],
  ko: ["공간을 여는 중…", "이 공간을 불러오지 못했습니다.", "연결을 확인한 후 이 페이지를 다시 불러오세요.", "다시 불러오기"],
};
class ChunkBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export function RouteLoader({ children, route }: { children: ReactNode; route: string }) {
  const { language, t } = useLanguage();
  const copy = COPY[language];
  const [reloading, setReloading] = useState(false);
  async function reloadRoom() {
    if (reloading) return;
    setReloading(true);
    // WebKit can retain failed module resources across a normal reload. Refresh
    // Vite's same-origin preload resources before creating a fresh module map.
    const resources = [...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"],link[rel="stylesheet"]')]
      .map(link => new URL(link.href, window.location.href))
      .filter(url => url.origin === window.location.origin && /\.(?:js|css)$/.test(url.pathname));
    await Promise.allSettled(resources.map(url => fetch(url.href, { cache: "reload", credentials: "omit", signal: AbortSignal.timeout(8000) })));
    window.location.reload();
  }
  const error = <section data-room-load-error role="alert" className="hint-app-scroll h-full px-6 pb-[calc(8rem+var(--hint-safe-bottom))] pt-[calc(3rem+var(--hint-safe-top))]" style={{ color: "var(--hint-text)", background: "var(--hint-surface)" }}>
    <h1 className="font-serif text-2xl">{copy[1]}</h1>
    <p className="mt-3 text-sm">{copy[2]}</p>
    <button className="mt-5 min-h-11 rounded-full border px-5 disabled:opacity-60" disabled={reloading} onClick={() => void reloadRoom()}>{copy[3]}</button>
    <Link className="mt-4 flex min-h-11 items-center" href="/app">{t("common.home")}</Link>
  </section>;
  return <ChunkBoundary key={route} fallback={error}>
    <Suspense fallback={<div data-room-loading role="status" className="grid h-full place-items-center px-6 text-center font-serif text-lg" style={{ color: "var(--hint-text)", background: "var(--hint-surface)" }}>{copy[0]}</div>}>
      {children}
    </Suspense>
  </ChunkBoundary>;
}
