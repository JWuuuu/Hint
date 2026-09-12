import { Switch, Route, Link, Router as WouterRouter } from "wouter";
import { LocalizedText } from "./lib/LocalizedText";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./AppShell";
import { OnboardingGate } from "./components/app/OnboardingGate";
import { PublicInvitationLanding, shouldShowPublicInvitationLanding } from "./components/app/PublicInvitationLanding";
import { LanguageProvider } from "./lib/i18n";
import { AboutView, ContactView, DisclaimerView, PrivacyPolicyView, TermsView } from "./modules/legal";
import { ProductRouter } from "./product/ProductRouter";
import { RedirectTo } from "./shared/navigation/RedirectTo";
import { MotionPolicyProvider } from "./lib/motionPolicy";
import { RoomVisitBoundary, guardRoomNavigation } from "./components/app/RoomVisitBoundary";

const queryClient = new QueryClient();

const PRODUCT_ROUTES = [
  "/tarot",
  "/ask",
  "/rooms",
  "/readings",
  "/login",
  "/signup",
  "/me",
  "/astrology",
  "/compatibility",
  "/dream",
  "/journal",
  "/daily-pull",
  "/daily",
  "/animal-tarot",
  "/sky-deck",
  "/collection",
  "/profile",
  "/settings",
  "/personalities",
];

function currentPathWithSuffix() {
  if (typeof window === "undefined") return "/";
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const pathname = base && window.location.pathname.startsWith(`${base}/`) ? window.location.pathname.slice(base.length) : window.location.pathname;
  return `${pathname}${window.location.search}${window.location.hash}`;
}

function toAppPath(path: string) {
  if (path === "/" || path.startsWith("/?") || path.startsWith("/#")) return `/app${path.slice(1)}`;
  if (path === "/daily-pull" || path.startsWith("/daily-pull?") || path.startsWith("/daily-pull#")) {
    return `/app/daily${path.slice("/daily-pull".length)}`;
  }
  if (path === "/sky-deck" || path.startsWith("/sky-deck?") || path.startsWith("/sky-deck#")) {
    return `/app/daily${path.slice("/sky-deck".length)}`;
  }
  if (path === "/me" || path.startsWith("/me?") || path.startsWith("/me#")) {
    return `/app/profile${path.slice("/me".length)}`;
  }
  return path.startsWith("/app") ? path : `/app${path}`;
}

function RootRedirect() {
  return <RedirectTo to={toAppPath(currentPathWithSuffix())} />;
}

function LegacyProductRedirect() {
  return <RedirectTo to={toAppPath(currentPathWithSuffix())} />;
}

function ProductRouteBoundary() {
  if (shouldShowPublicInvitationLanding()) return <PublicInvitationLanding />;
  return (
    <OnboardingGate>
      <ProductRouter />
    </OnboardingGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MotionPolicyProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")} aroundNav={guardRoomNavigation}>
          <RoomVisitBoundary>
          <AppShell>
            <Switch>
              <Route path="/" component={RootRedirect} />
              <Route path="/app" component={ProductRouteBoundary} />
              <Route path="/app/readings/:id" component={ProductRouteBoundary} />
              <Route path="/app/*" component={ProductRouteBoundary} />
              <Route path="/privacy" component={PrivacyPolicyView} />
              <Route path="/terms" component={TermsView} />
              <Route path="/disclaimer" component={DisclaimerView} />
              <Route path="/contact" component={ContactView} />
              <Route path="/about" component={AboutView} />
              <Route path="/readings/:id" component={LegacyProductRedirect} />
              {PRODUCT_ROUTES.map((route) => (
                <Route key={route} path={route} component={LegacyProductRedirect} />
              ))}
              {PRODUCT_ROUTES.map((route) => (
                <Route key={`${route}/*`} path={`${route}/*`} component={LegacyProductRedirect} />
              ))}
              <Route path="*">
                <main className="hint-app-scroll h-full overflow-y-auto px-6 pb-32 pt-16" style={{ color: "var(--hint-text)" }}>
                  <h1 className="font-serif text-3xl"><LocalizedText text="Page not found" /></h1>
                  <p className="mt-3"><LocalizedText text="This page may have moved. Choose a room to continue." /></p>
                  <Link href="/app" className="mt-5 inline-flex min-h-11 items-center rounded-full border px-5"><LocalizedText text="Back to Today" /></Link>
                </main>
              </Route>
            </Switch>
          </AppShell>
          </RoomVisitBoundary>
        </WouterRouter>
        </MotionPolicyProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
