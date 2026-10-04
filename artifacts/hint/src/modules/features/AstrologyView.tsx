import { ReportLibrary } from "../astrology/components/CelestialReports";
import { rt } from "../astrology/reportCopy";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Heart, Sparkles } from "lucide-react";
import { AppScreen, SpaceNavigation } from "@/components/app/AppChrome";
import {
  BirthProfileForm,
  type BirthProfileDraft,
} from "@/components/astro/BirthProfileForm";
import { useLanguage } from "@/lib/i18n";
import { useLocalAccount } from "@/lib/auth";
import { captureIdentityContext, getAnonId } from "@/lib/identity";
import { useMotionPolicy } from "@/lib/motionPolicy";
import { historyClearVersion } from "@/lib/clearHistory";
import { optionalBirthNumber, birthDetailsError } from "@/lib/birthDetails";
import {
  readBirthProfile,
  saveBirthProfile,
  getBirthProfileConflict,
} from "@/lib/astro/userBirthProfile";
import {
  getNatalChart,
  getTransits,
  type AstroNatalResponse,
} from "@/lib/astro/astroClient";
import { normalizeClientNatal } from "@/lib/astro/normalizeClientAstro";
import { at } from "../astrology/astrologyCopy";
import {
  chartContext,
  migrateLegacyChart,
  readAstroLocation,
  storeChart,
  writeAstroLocation,
  type AstroTab,
  type ChartSelection,
} from "../astrology/chartState";
import {
  AstrologyOrientation,
  AstroPanel,
  ZodiacGuide,
  NatalReading,
  TransitReading,
} from "../astrology/components/AstrologyGuide";
import { TogetherReading } from "../astrology/components/TogetherReading";
import type {
  AstroTransitsResponse,
  BirthProfile,
  NatalChart,
  ZodiacSign,
} from "@/types/astrology";

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function personalChartReady(
  profile: BirthProfile | null,
): profile is BirthProfile {
  return Boolean(
    profile &&
    !birthDetailsError(profile) &&
    profile.birthTime &&
    profile.latitude !== undefined &&
    profile.longitude !== undefined &&
    profile.timezoneOffset !== undefined,
  );
}
function draftProfile(
  draft: BirthProfileDraft,
): Omit<BirthProfile, "id" | "createdAt" | "updatedAt"> {
  return {
    ...draft,
    birthTime: draft.birthTime || undefined,
    latitude: optionalBirthNumber(draft.latitude),
    longitude: optionalBirthNumber(draft.longitude),
    timezoneOffset: optionalBirthNumber(draft.timezoneOffset),
    timezone: draft.timezone || undefined,
  };
}
export function AstrologyView() {
  const { language, t } = useLanguage();
  const account = useLocalAccount();
  const owner = getAnonId();
  const [location, setLocation] = useState(readAstroLocation);
  const { tab, sign, selection } = location;
  const [profile, setProfile] = useState<BirthProfile | null>(readBirthProfile);
  const [clearVersion, setClearVersion] = useState(() =>
    historyClearVersion(owner),
  );
  const clearVersionRef = useRef(clearVersion);
  const { reduced, pageVisible } = useMotionPolicy();
  const [onScreen, setOnScreen] = useState(true);
  const headerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(localDate);
  const [range, setRange] = useState<"daily" | "weekly">("daily");
  const [review, setReview] = useState<BirthProfileDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState<BirthProfileDraft | null>(null);
  const [saveError, setSaveError] = useState(false);
  const saving = useRef(false);
  const context = `${profile ? chartContext(owner, profile) : `${owner}:empty`}:${clearVersion}`;
  const currentContext = useRef(context);
  currentContext.current = context;
  const cached = useMemo(
    () =>
      profile
        ? migrateLegacyChart(
            owner,
            profile,
            account?.identifier || account?.email || account?.phone,
          )
        : null,
    [context],
  );
  const [calculation, setCalculation] = useState<{
    key: string;
    chart: NatalChart;
    response: AstroNatalResponse;
    stored: boolean;
  } | null>(null);
  const chart =
    calculation?.key === context
      ? { ...calculation.chart, birthProfile: profile! }
      : cached;
  const [natalLoading, setNatalLoading] = useState(false);
  const [natalError, setNatalError] = useState(false);
  const [natalAttempt, setNatalAttempt] = useState(0);
  const natalRequested = useRef("");
  const natalController = useRef<AbortController | null>(null);
  const [transitState, setTransitState] = useState<{
    key: string;
    data: AstroTransitsResponse;
  } | null>(null);
  const [transitLoading, setTransitLoading] = useState(false);
  const [transitError, setTransitError] = useState(false);
  const [transitAttempt, setTransitAttempt] = useState(0);
  const transitKey = `${context}:${date}:${range}`;
  const transitRequested = useRef("");
  const transitController = useRef<AbortController | null>(null);
  const activeTransit =
    transitState?.key === transitKey ? transitState.data : null;
  const ready = personalChartReady(profile);

  useEffect(() => {
    const sync = () => {
      setProfile(readBirthProfile());
      const nextVersion = historyClearVersion(owner);
      if (nextVersion !== clearVersionRef.current) {
        clearVersionRef.current = nextVersion;
        natalController.current?.abort();
        transitController.current?.abort();
        setCalculation(null);
        setTransitState(null);
        setNatalAttempt(0);
        setTransitAttempt(0);
        setClearVersion(nextVersion);
      }
    };
    const pop = () => {
      setLocation(readAstroLocation());
      setReview(null);
    };
    window.addEventListener("storage", sync);
    window.addEventListener("hint.birthProfile.updated", sync);
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("hint.birthProfile.updated", sync);
      window.removeEventListener("popstate", pop);
    };
  }, []);
  useEffect(() => {
    if (!headerRef.current || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry.isIntersecting),
    );
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setDate(localDate());
    update();
    const next = new Date();
    next.setHours(24, 0, 0, 30);
    const timer = window.setTimeout(
      update,
      Math.max(1, next.getTime() - Date.now()),
    );
    window.addEventListener("pageshow", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", update);
    };
  }, [date, pageVisible]);
  useEffect(() => {
    natalController.current?.abort();
    transitController.current?.abort();
    natalRequested.current = "";
    transitRequested.current = "";
    setNatalError(false);
    setTransitError(false);
    setNatalLoading(false);
    setTransitLoading(false);
  }, [context]);

  useEffect(() => {
    if (
      !profile ||
      !ready ||
      !["chart", "transits"].includes(tab) ||
      (clearVersion && natalAttempt === 0 && !chart)
    )
      return;
    const key = `${context}:${natalAttempt}`;
    if (natalRequested.current === key || (chart && natalAttempt === 0)) return;
    const controller = new AbortController();
    natalController.current = controller;
    let settled = false;
    const identity = captureIdentityContext();
    const abort = () => controller.abort();
    identity.signal.addEventListener("abort", abort, { once: true });
    natalRequested.current = key;
    setNatalLoading(true);
    setNatalError(false);
    void getNatalChart(profile, controller.signal)
      .then((response) => {
        identity.assertCurrent();
        if (
          controller.signal.aborted ||
          currentContext.current !== context ||
          historyClearVersion(owner) !== clearVersion
        )
          return;
        const result = normalizeClientNatal(profile, response);
        if (!result?.placements.length)
          throw new Error("Unavailable calculated chart");
        const stored = storeChart(owner, profile, response, clearVersion);
        if (historyClearVersion(owner) !== clearVersion) return;
        setCalculation({
          key: context,
          chart: result,
          response,
          stored,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted && currentContext.current === context)
          setNatalError(true);
      })
      .finally(() => {
        settled = true;
        identity.signal.removeEventListener("abort", abort);
        if (!controller.signal.aborted && currentContext.current === context)
          setNatalLoading(false);
      });
    return () => {
      controller.abort();
      identity.signal.removeEventListener("abort", abort);
      if (natalRequested.current === key && !settled)
        natalRequested.current = "";
      setNatalLoading(false);
    };
  }, [context, tab, natalAttempt, ready]);

  useEffect(() => {
    if (tab !== "transits" || !profile || !ready || !chart) return;
    const key = `${transitKey}:${transitAttempt}`;
    if (transitRequested.current === key) return;
    const controller = new AbortController();
    transitController.current = controller;
    const identity = captureIdentityContext();
    const abort = () => controller.abort();
    identity.signal.addEventListener("abort", abort, { once: true });
    transitRequested.current = key;
    setTransitLoading(true);
    setTransitError(false);
    void getTransits(profile, date, range, controller.signal)
      .then((data) => {
        identity.assertCurrent();
        if (
          controller.signal.aborted ||
          currentContext.current !== context ||
          historyClearVersion(owner) !== clearVersion
        )
          return;
        if (
          data.source !== "astrologyapi" ||
          data.mode !== "live" ||
          !Array.isArray(data.transits)
        )
          throw new Error("Unavailable transits");
        setTransitState({ key: transitKey, data });
      })
      .catch(() => {
        if (!controller.signal.aborted && currentContext.current === context)
          setTransitError(true);
      })
      .finally(() => {
        identity.signal.removeEventListener("abort", abort);
        if (!controller.signal.aborted && currentContext.current === context)
          setTransitLoading(false);
      });
    return () => {
      controller.abort();
      identity.signal.removeEventListener("abort", abort);
      transitRequested.current = "";
    };
  }, [tab, context, transitKey, transitAttempt, Boolean(chart)]);

  function navigate(
    next: AstroTab,
    nextSign?: string | null,
    nextSelection?: ChartSelection | null,
  ) {
    setLocation({
      tab: next,
      sign: nextSign ?? null,
      selection: nextSelection ?? null,
    });
    writeAstroLocation(next, nextSign, nextSelection);
    setReview(null);
    setSaveError(false);
    if (next !== tab || nextSign !== sign)
      requestAnimationFrame(() =>
        sectionRef.current?.scrollIntoView({ block: "start" }),
      );
  }
  function saveReviewed() {
    if (!review || saving.current) return;
    saving.current = true;
    setSaveError(false);
    try {
      const identity = captureIdentityContext();
      identity.assertCurrent();
      const next = saveBirthProfile(draftProfile(review));
      identity.assertCurrent();
      setProfile(next);
      setSavedDraft(null);
      setReview(null);
      setNatalAttempt(1);
      navigate("chart");
    } catch {
      setSaveError(true);
    } finally {
      saving.current = false;
    }
  }
  const formProfile = savedDraft
    ? {
        ...draftProfile(savedDraft),
        id: owner,
        createdAt: profile?.createdAt ?? "",
        updatedAt: profile?.updatedAt ?? "",
      }
    : profile;
  const setup = (
    <AstroPanel
      eyebrow={at(language, "birth")}
      title={at(language, "setupTitle")}
    >
      <p>{at(language, "setupCopy")}</p>
      <p>{at(language, "unknownTime")}</p>
      {profile && (
        <p className="astro-guide-note">
          {at(language, "local")} · {profile.name}
        </p>
      )}
      <button
        type="button"
        className="astro-guide-button"
        onClick={() => navigate("birth")}
      >
        {profile ? at(language, "edit") : at(language, "create")}
        <ArrowRight size={16} />
      </button>
      {ready ? (
        <>
          <button
            type="button"
            className="astro-guide-link"
            disabled={natalLoading}
            onClick={() => {
              setNatalAttempt((a) => a + 1);
              navigate("chart");
            }}
          >
            {natalLoading
              ? at(language, "calculating")
              : at(language, "calculate")}
          </button>
          {natalError && <p role="alert">{at(language, "chartError")}</p>}
        </>
      ) : (
        profile && (
          <p className="astro-guide-note">{at(language, "incomplete")}</p>
        )
      )}
      <button
        type="button"
        className="astro-guide-link"
        onClick={() => navigate("signs")}
      >
        {at(language, "explore")}
      </button>
    </AstroPanel>
  );

  return (
    <AppScreen>
      <div
        className="astro-guide astro-theme astro-guide-stack"
        data-testid="astrology-screen"
        data-motion={reduced || !pageVisible ? "off" : "on"}
      >
        <SpaceNavigation />
        <div ref={headerRef} data-glow-visible={onScreen}>
          {tab === "signs" && !sign ? <AstrologyOrientation /> : <p className="astro-guide-eyebrow astro-compact-title">{at(language,"room")}</p>}
        </div>
        <nav className="astro-guide-nav" aria-label={at(language, "sections")}>
          {(["signs", "chart", "transits"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={
                tab === value || (value === "chart" && tab === "birth")
              }
              onClick={() => navigate(value)}
            >
              {at(
                language,
                value === "signs"
                  ? "explore"
                  : value === "transits"
                    ? "now"
                    : "chart",
              )}
            </button>
          ))}
        </nav>
        <div
          ref={sectionRef}
          className="astro-guide-stack"
          style={{ scrollMarginTop: "20px" }}
        >
          {getBirthProfileConflict() && (
            <p role="alert">{t("quality.birthConflict")}</p>
          )}
          {tab === "signs" && (
            <ZodiacGuide
              chart={chart}
              selected={sign}
              onSign={(value: ZodiacSign | null) => navigate("signs", value)}
              onChart={(next) => navigate("chart", null, next)}
            />
          )}
          {tab === "chart" &&
            (chart ? (
              <>
                <NatalReading
                  chart={chart}
                  selection={selection}
                  onSelection={(next) => navigate("chart", null, next)}
                  onEdit={() => navigate("birth")}
                  onTransits={() => navigate("transits")}
                  refreshing={natalLoading}
                  onRefresh={() => setNatalAttempt((a) => a + 1)}
                  error={natalError ? at(language, "chartError") : ""}
                />
                {calculation?.key === context && !calculation.stored && (
                  <div role="status">
                    <p>{at(language, "notStored")}</p>
                    <button
                      type="button"
                      className="astro-guide-button"
                      onClick={() => {
                        const identity = captureIdentityContext();
                        identity.assertCurrent();
                        if (profile && calculation)
                          setCalculation({
                            ...calculation,
                            stored: storeChart(
                              owner,
                              profile,
                              calculation.response,
                              clearVersion,
                            ),
                          });
                      }}
                    >
                      {at(language, "retrySave")}
                    </button>
                  </div>
                )}
              </>
            ) : (
              setup
            ))}
          {tab === "transits" &&
            (chart ? (
              <TransitReading
                chart={chart}
                transits={activeTransit}
                loading={transitLoading}
                error={transitError ? at(language, "transitError") : ""}
                range={range}
                onRange={setRange}
                onRefresh={() => setTransitAttempt((a) => a + 1)}
                onPlacement={(body) =>
                  navigate("chart", null, {
                    kind: "body",
                    id: body.toLowerCase(),
                  })
                }
              />
            ) : (
              setup
            ))}
          {tab === "birth" && (
            <div className="astro-guide-stack astro-page-enter">
              <button
                type="button"
                className="astro-guide-link"
                onClick={() => navigate("chart")}
              >
                <ArrowLeft size={16} />
                {at(language, "chart")}
              </button>
              {review ? (
                <AstroPanel
                  title={at(language, "review")}
                  className="astro-review"
                >
                  <p>{at(language, "reviewNote")}</p>
                  <dl>
                    <div>
                      <dt>{t("birthProfile.name")}</dt>
                      <dd>{review.name}</dd>
                    </div>
                    <div>
                      <dt>{t("birthProfile.birthDate")}</dt>
                      <dd>{review.birthDate}</dd>
                    </div>
                    <div>
                      <dt>{t("birthProfile.birthTime")}</dt>
                      <dd>{review.birthTime || at(language, "unknownTime")}</dd>
                    </div>
                    <div>
                      <dt>{t("birthProfile.birthPlace")}</dt>
                      <dd>{review.birthPlace}</dd>
                    </div>
                    <div>
                      <dt>{t("birthProfile.timezone")}</dt>
                      <dd>
                        {review.timezone || at(language, "unavailable")}{" "}
                        {review.timezoneOffset
                          ? `UTC ${Number(review.timezoneOffset) >= 0 ? "+" : ""}${review.timezoneOffset}`
                          : ""}
                      </dd>
                    </div>
                  </dl>
                  {saveError && <p role="alert">{at(language, "saveError")}</p>}
                  <button
                    type="button"
                    className="astro-guide-button"
                    onClick={saveReviewed}
                  >
                    {at(language, "save")}
                  </button>
                  <button
                    type="button"
                    className="astro-guide-link"
                    onClick={() => setReview(null)}
                  >
                    {at(language, "edit")}
                  </button>
                </AstroPanel>
              ) : (
                <>
                  <AstroPanel title={at(language, "setupTitle")}>
                    <p>{at(language, "unknownTime")}</p>
                  </AstroPanel>
                  <BirthProfileForm
                    profile={formProfile}
                    title={at(language, "birth")}
                    submitLabel={at(language, "review")}
                    onSubmit={(draft) => {
                      setSavedDraft(draft);
                      setReview(draft);
                      requestAnimationFrame(() =>
                        sectionRef.current?.scrollIntoView({ block: "start" }),
                      );
                    }}
                  />
                </>
              )}
            </div>
          )}
          {tab === "together" &&
            (ready ? (
              <>
                <button
                  type="button"
                  className="astro-guide-link"
                  onClick={() => navigate("chart")}
                >
                  <ArrowLeft size={16} />
                  {at(language, "chart")}
                </button>
                <TogetherReading profile={profile} />
              </>
            ) : (
              setup
            ))}
          {tab === "reports" && <ReportLibrary owner={owner} chart={chart} onCreate={()=>navigate("birth")} onTogether={()=>navigate("together")}/>}

        </div>
        {!["birth", "together"].includes(tab) && (
          <button
            type="button"
            className="astro-secondary-entry"
            onClick={() => navigate("together")}
          >
            <Heart size={21} aria-hidden="true" />
            <span>
              <strong>{at(language, "together")}</strong>
              <small>{at(language, "togetherIntro")}</small>
            </span>
            <ArrowRight size={16} />
          </button>
        )}
        {tab === "chart" && (
          <button
            type="button"
            className="astro-guide-link"
            onClick={() => navigate("reports")}
          >
            <Sparkles size={15} />
            {rt(language, "open")}
          </button>
        )}
        <p className="astro-guide-note">{at(language, "footer")}</p>
      </div>
    </AppScreen>
  );
}
