import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { PointerProvider } from "./modules/hold/atmosphere";
import { AppLaunchIntro } from "./components/app/AppLaunchIntro";
import type { LaunchIntroVariant } from "./components/app/AppLaunchIntro";
import "./components/app/readable-text.css";
import { ConstellationBackdrop } from "./components/app/ConstellationBackdrop";
import { useDecorationsCovered } from "./lib/decorationCover";
import { trackEvent } from "./lib/analytics";
import {
  getInitialHintTheme,
  HINT_THEME_BAR_COLORS,
  HINT_THEME_STORAGE_KEY,
  type HintTheme,
} from "./components/app/theme";
import {
  HINT_PREFERENCES_UPDATED_EVENT,
} from "./lib/preferences";
import { useLanguage } from "./lib/i18n";
import { triggerFeedback } from "./lib/feedback";
import { useMotionPolicy } from "./lib/motionPolicy";
import { RoomTransitions } from "./components/app/RoomTransitions";
import { HintGuideSlot, useHintGuideEnabled } from "./components/mascot/HintGuide";
import dockRest from "../mascot-library/versions/v3.2/assets/empty-rest.png";
import "./components/app/mascot-dock.css";
import { useOnboardingOwnsScreen } from "./components/app/onboardingState";

/** Full-screen flows own their navigation, so the global bottom nav is hidden there. */
const NAV_HIDDEN_ROUTES = ["/tarot", "/ask", "/login", "/app/tarot", "/app/ask", "/app/login"];
const HINT_LAUNCH_SEEN_STORAGE_KEY = "hint_launch_seen_v2";
const ENABLE_LAUNCH_INTRO = true;
const CREAM_STYLE_ROUTES = [
  "/app/daily",
  "/app/readings",
  "/readings",
  "/app/profile",
  "/app/astrology",
  "/app/collection",
  "/app/personalities",
] as const;

function hasLaunchIntroPreviewFlag(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("launchIntro") === "first";
}

function getLaunchIntroVariant(): LaunchIntroVariant {
  return "cinematic";
}

function isCreamStyleRoute(location: string): boolean {
  const pathname = location.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
  return CREAM_STYLE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * AppShell — the persistent room. Atmosphere is mounted once at the app
 * level so routes can crossfade without the particles/moonlight resetting.
 * Children are placed above the atmosphere on z-20.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const decorationsCovered = useDecorationsCovered();
  const guideEnabled = useHintGuideEnabled();
  const [location] = useLocation();
  const routePath = location.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
  const [theme, setTheme] = useState<HintTheme>(getInitialHintTheme);
  const { reduced: reduceMotion } = useMotionPolicy();
  const [isFirstLaunch, setIsFirstLaunch] = useState(() => {
    if (typeof window === "undefined") return false;
    if (hasLaunchIntroPreviewFlag()) return true;
    try {
      return window.localStorage.getItem(HINT_LAUNCH_SEEN_STORAGE_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [showLaunchIntro, setShowLaunchIntro] = useState(true);
  const [launchIntroLeaving, setLaunchIntroLeaving] = useState(false);
  const [launchIntroRunKey, setLaunchIntroRunKey] = useState(0);
  const launchRoute = useRef(routePath);
  const isLaunchIntroPreview = hasLaunchIntroPreviewFlag();
  const launchIntroVariant = getLaunchIntroVariant();
  const isProductRoute = !["/privacy", "/terms", "/disclaimer", "/contact", "/about"].includes(routePath);
  const referenceHomeRoute = routePath === "/app" || routePath === "/";
  const creamStyleRoute = !referenceHomeRoute && isCreamStyleRoute(routePath);
  // Reactive: finishing or replaying onboarding changes storage/search without a reload.
  const onboardingActive = useOnboardingOwnsScreen();
  const showNav = isProductRoute && !onboardingActive && !NAV_HIDDEN_ROUTES.some(
    (r) => routePath === r || routePath.startsWith(r + "/"),
  );

  useEffect(() => {
    trackEvent("app_opened", {
      route: location,
      theme,
    });
    // Track one app open per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.hintTheme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? HINT_THEME_BAR_COLORS.dark : HINT_THEME_BAR_COLORS.bright);

    try {
      window.localStorage.setItem(HINT_THEME_STORAGE_KEY, theme);
    } catch {
      // Local storage can be unavailable in private browsing.
    }
  }, [theme]);

  useEffect(() => {
    const syncPreferences = () => {
      setTheme(getInitialHintTheme());
    };

    window.addEventListener(HINT_PREFERENCES_UPDATED_EVENT, syncPreferences);
    window.addEventListener("storage", syncPreferences);
    return () => {
      window.removeEventListener(HINT_PREFERENCES_UPDATED_EVENT, syncPreferences);
      window.removeEventListener("storage", syncPreferences);
    };
  }, []);

  useEffect(() => {
    if (!hasLaunchIntroPreviewFlag()) return;
    setIsFirstLaunch(true);
    setLaunchIntroLeaving(false);
    setShowLaunchIntro(true);
    setLaunchIntroRunKey((key) => key + 1);
  }, [location]);

  useLayoutEffect(() => {
    // Launch belongs to the screen where this app session started. A quick
    // first Home tap must not reveal a second launch ceremony over the room.
    if (launchRoute.current !== routePath && !isLaunchIntroPreview) setShowLaunchIntro(false);
    launchRoute.current = routePath;
  }, [routePath, isLaunchIntroPreview]);

  useEffect(() => {
    if (!showLaunchIntro) return;

    const shouldReduceLaunchMotion = reduceMotion;
    const leaveAfter = shouldReduceLaunchMotion ? 360 : isLaunchIntroPreview ? 4240 : isFirstLaunch ? 2580 : 1920;
    const hideAfter = shouldReduceLaunchMotion ? 520 : isLaunchIntroPreview ? 4680 : isFirstLaunch ? 2820 : 2140;
    const leaveTimer = window.setTimeout(() => setLaunchIntroLeaving(true), leaveAfter);
    const hideTimer = window.setTimeout(() => setShowLaunchIntro(false), hideAfter);
    try {
      window.localStorage.setItem(HINT_LAUNCH_SEEN_STORAGE_KEY, "1");
    } catch {
      // Local storage can be unavailable in private browsing.
    }

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, [isFirstLaunch, isLaunchIntroPreview, launchIntroRunKey, reduceMotion, showLaunchIntro]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    document.querySelectorAll(".overflow-y-auto").forEach((element) => {
      if (element instanceof HTMLElement) {
        element.scrollTo({ top: 0, left: 0 });
      }
    });
  }, [location]);

  return (
    <PointerProvider>
      <RoomTransitions
        location={location}
        data-hint-theme={theme}
        data-hint-cream-route={creamStyleRoute ? "true" : undefined}
        className={[
          "hint-app-shell-root hint-sky-shell fixed inset-0 overflow-hidden",
          creamStyleRoute ? "hint-cream-route" : "",
        ].join(" ")}
      >
        {/* The one sky. Mounted here, outside route content, so Today, Daily,
            Me, History and every other page share the same canvas, palette
            and uninterrupted motion. Pages keep transparent backgrounds. */}
        <ConstellationBackdrop paused={decorationsCovered} />

        {/* Route content sits above the atmosphere.
            Pages own their own scroll model — AppShell does not impose
            one, so chat-style pages can pin an input to the bottom while
            scrollable pages (like the home dashboard) handle their own
            overflow. */}
        <main data-room-content className="absolute inset-0 z-20">
          {children}
        </main>

        {showNav ? (
          <AppNavigationChrome location={location} theme={theme} />
        ) : null}

        {ENABLE_LAUNCH_INTRO &&
        !(guideEnabled && onboardingActive) &&
        isProductRoute &&
        !referenceHomeRoute &&
        !creamStyleRoute &&
        (isFirstLaunch || isLaunchIntroPreview) &&
        showLaunchIntro ? (
          <AppLaunchIntro
            theme={theme}
            leaving={launchIntroLeaving}
            firstLaunch={isFirstLaunch}
            preview={isLaunchIntroPreview}
            variant={launchIntroVariant}
          />
        ) : null}
      </RoomTransitions>
    </PointerProvider>
  );
}

function AppNavigationChrome({ location, theme }: { location: string; theme: HintTheme }) {
  const { t, language } = useLanguage();
  const dockRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const root = document.documentElement;
    const update = () => {
      // The dock sizes intrinsically around labels; only vertical clearance
      // needs measurement. Center content keeps its existing scroll model.
      const clearance = `${Math.max(0, Math.ceil(dock.getBoundingClientRect().height) - 52)}px`;
      root.style.setProperty("--hint-nav-extra-height", clearance);
    };
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(dock);
    update();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      root.style.removeProperty("--hint-nav-extra-height");
    };
  }, []);
  const appTabs: AppTabItem[] = [
    { href: "/app", label: t("nav.today"), icon: "today", exact: true },
    { href: "/app/daily", label: t("nav.daily"), icon: "daily" },
    { href: "/app/ask", label: t("nav.ask"), accessibleLabel: { en: "Ask Hint", zh: "向 Hint 提问", es: "Preguntar a Hint", ja: "Hintに質問", ko: "Hint에게 질문" }[language], featured: true },
    { href: "/app/readings", label: t("nav.history"), icon: "history" },
    { href: "/app/profile", label: t("nav.me"), icon: "me" },
  ];
  const navigationLabel = { en: "Main navigation", zh: "主导航", es: "Navegación principal", ja: "メインナビゲーション", ko: "주 탐색" }[language];
  return (
    <nav aria-label={navigationLabel} data-app-tabbar data-mascot-dock data-dock-theme={theme} className="hint-mascot-nav"
      style={{ paddingBottom: "max(4px, calc(var(--hint-safe-bottom, 0px) - 2px))" }}>
      <div ref={dockRef} className="hint-mascot-dock">
        {appTabs.map(tab => <AppTab key={tab.href} item={tab} active={isActiveAppTab(location, tab)} />)}
      </div>
    </nav>
  );
}

type AppTabItem = {
  href: string;
  label: string;
  icon?: "today" | "daily" | "history" | "me";
  exact?: boolean;
  featured?: boolean;
  accessibleLabel?: string;
};

function DockIcon({ kind, active }: { kind: AppTabItem["icon"]; active: boolean }) {
  return <svg className="hint-dock-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={active ? 1.85 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    {kind === "today" && <><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="m4.5 7 7.5 6 7.5-6" /></>}
    {kind === "daily" && <><rect x="5" y="3.5" width="14" height="17" rx="3" /><path d="M9 3.5v3M15 3.5v3M5 9h14M9 13h2M9 16.5h6" /></>}
    {kind === "history" && <><path d="M4.4 8A8 8 0 1 1 4 15M4 4.5V8h3.5M12 7.5V12l3 1.8" /></>}
    {kind === "me" && <><circle cx="12" cy="7.5" r="3.5" /><path d="M5 20v-1.5a7 6 0 0 1 14 0V20" /></>}
  </svg>;
}

function AppTab({ item, active }: { item: AppTabItem; active: boolean }) {
  return (
    <Link href={item.href} aria-label={item.accessibleLabel} aria-current={active ? "page" : undefined}
      data-active={active ? "true" : "false"} data-featured={item.featured ? "true" : "false"}
      onPointerDown={() => triggerFeedback(item.featured ? "select" : "tap")}
      className="hint-dock-tab">
      {item.featured ? <span className="hint-dock-perch" aria-hidden="true">
        <span className="hint-dock-bounds">
        {/* A resting navigation context stays stable through tab changes. The
            same provider still gives the approved delivery slot (210) priority. */}
        <HintGuideSlot priority={70} interactive={false}
          context={{ room: "home", phase: "idle", resting: true, hasMessages: false, keyboardOpen: false, typing: false, audioPlaying: false }}
          className="hint-dock-slot"
          fallback={<img className="hint-dock-static" src={dockRest} alt="" />} />
        <img className="hint-dock-loading" src={dockRest} alt="" />
        </span>
      </span> : <DockIcon kind={item.icon} active={active} />}
      <span className="hint-dock-label">{item.label}</span>
    </Link>
  );
}

function isActiveAppTab(location: string, tab: AppTabItem) {
  if (tab.exact) return location === "/app" || location === "/";
  return location === tab.href || location.startsWith(`${tab.href}/`);
}
