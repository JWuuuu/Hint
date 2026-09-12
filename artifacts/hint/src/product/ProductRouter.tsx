import { LocalizedText } from "../lib/LocalizedText";
import { lazy, useState } from "react";
import { Link, useLocation } from "wouter";
import { RouteLoader } from "./RouteLoader";
import { loadTarotRoom, loadAstrologyRoom, getPreloadedTarotRoom, getPreloadedAstrologyRoom } from "./roomPreload";
import { RedirectTo } from "../shared/navigation/RedirectTo";

const HomeDashboard = lazy(() => import("../modules/home/components/HomeDashboard").then(module => ({ default: module.HomeDashboard })));
const AskHint = lazy(() => import("../modules/ask").then(module => ({ default: module.AskHint })));
const LoginView = lazy(() => import("../modules/auth").then(module => ({ default: module.LoginView })));
const RoomsLibrary = lazy(() => import("../modules/rooms").then(module => ({ default: module.RoomsLibrary })));
const ReadingDetailView = lazy(() => import("../modules/readings/ReadingsView").then(module => ({ default: module.ReadingDetailView })));
const ReadingsView = lazy(() => import("../modules/readings/ReadingsView").then(module => ({ default: module.ReadingsView })));
const MeView = lazy(() => import("../modules/me").then(module => ({ default: module.MeView })));
const AnimalTarotView = lazy(() => import("../modules/animal-tarot").then(module => ({ default: module.AnimalTarotView })));
const CardCollectionView = lazy(() => import("../modules/collection").then(module => ({ default: module.CardCollectionView })));
const LazyAstrologyView = lazy(() => loadAstrologyRoom().then(module => ({ default: module.AstrologyView })));
function AstrologyView() {
  const [Room] = useState(() => getPreloadedAstrologyRoom()?.AstrologyView ?? LazyAstrologyView);
  return <Room />;
}
const CompatibilityView = lazy(() => import("../modules/features/CompatibilityView").then(module => ({ default: module.CompatibilityView })));
const DailyPullView = lazy(() => import("../modules/features/DailyPullView").then(module => ({ default: module.DailyPullView })));
const DreamView = lazy(() => import("../modules/features/DreamView").then(module => ({ default: module.DreamView })));
const JournalView = lazy(() => import("../modules/features/JournalView").then(module => ({ default: module.JournalView })));
const PersonalitiesView = lazy(() => import("../modules/features/PersonalitiesView").then(module => ({ default: module.PersonalitiesView })));

const LazyTarotRoom = lazy(() =>
  loadTarotRoom().then((module) => ({ default: module.TarotRoom })),
);
function TarotRoom() {
  // A resolved import must render synchronously: a fresh React.lazy promise
  // still paints Suspense's loading state even when the network cache is warm.
  // Keep this choice for the mounted visit; switching component types later
  // would reset a cold-started reading when an unrelated parent rerenders.
  const [Room] = useState(() => getPreloadedTarotRoom()?.TarotRoom ?? LazyTarotRoom);
  return <Room />;
}

function currentProductPath(location: string) {
  const pathname = location.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
  const productPath = pathname.startsWith("/app") ? pathname.slice("/app".length) || "/" : pathname;
  return productPath || "/";
}

export function ProductRouter() {
  const [location] = useLocation();
  return <RouteLoader route={currentProductPath(location)}><ProductPage /></RouteLoader>;
}

function ProductPage() {
  const [location] = useLocation();
  const path = currentProductPath(location);

  if (path === "/") return <HomeDashboard />;
  if (path === "/daily") return <DailyPullView />;
  if (path === "/daily-pull" || path === "/sky-deck" || path.startsWith("/sky-deck/")) return <RedirectTo to="/app/daily" />;
  if (path === "/tarot" || path.startsWith("/tarot/")) return <TarotRoom />;
  if (path === "/animal-tarot" || path.startsWith("/animal-tarot/")) return <AnimalTarotView />;
  if (path === "/astrology") return <AstrologyView />;
  if (path === "/collection") return <CardCollectionView />;
  if (path === "/profile") return <MeView />;
  if (path === "/me" || path === "/settings") return <RedirectTo to="/app/profile" />;
  if (path === "/ask") return <AskHint />;
  if (path === "/rooms") return <RoomsLibrary />;
  if (path.startsWith("/readings/")) return <ReadingDetailView />;
  if (path === "/readings") return <ReadingsView />;
  if (path === "/login" || path === "/signup") return <LoginView />;
  if (path === "/compatibility" || path.startsWith("/compatibility/")) return <CompatibilityView />;
  if (path === "/dream") return <DreamView />;
  if (path === "/journal") return <JournalView />;
  if (path === "/personalities") return <PersonalitiesView />;

  return (
    <div className="h-full overflow-y-auto px-6 pb-32 pt-[calc(2rem+var(--hint-safe-top))]" style={{ color: "var(--hint-text)" }}>
      <h1 className="font-serif text-[30px]"><LocalizedText text={"Page not found"} /></h1>
      <p className="mt-3 text-[14px]" style={{ color: "var(--hint-muted)" }}><LocalizedText text={"This page may have moved. Choose a room to continue."} /></p>
      <Link href="/app" className="mt-5 inline-flex min-h-11 items-center rounded-full border px-5"><LocalizedText text={"Back to Today"} /></Link>
    </div>
  );
}
