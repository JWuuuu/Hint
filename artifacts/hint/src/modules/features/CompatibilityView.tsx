import { RelationshipReading } from "../astrology/components/RelationshipReading";
import type { BirthProfile as ReportBirthProfile } from "@/types/astrology";
import { LocalizedText, translateText } from "../../lib/LocalizedText";
import { useLanguage, type HintLanguage } from "../../lib/i18n";
import { publicAppUrl } from "../../lib/publicUrls";
import { getAnonId } from "../../lib/identity";
import { BirthProfileForm } from "../../components/astro/BirthProfileForm";
import { optionalBirthNumber } from "../../lib/birthDetails";
import type { BirthProfile } from "../../types/astrology";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Copy, Sparkles, UserRound } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { apiFetch, apiUrl } from "../../lib/api";
import { useProfile } from "../../lib/useProfile";
import { AppScreen, SpaceNavigation } from "../../components/app/AppChrome";
import { at } from "../astrology/astrologyCopy";
import { togetherText } from "../astrology/togetherCopy";
import { bodyName } from "../astrology/astrologyLibrary";
import { captureRelationshipContext, useRelationshipReset } from "../astrology/relationshipContext";
import "../astrology/components/astrology-guide.css";
import "./compatibility.css";
import type { BirthProfileInput, CompatibilityResult, NormalizedBirthChart, ZodiacSign } from "../astrology/types";
import { useBirthChart } from "../astrology/useBirthChart";

type BirthDetails = {
  name: string;
  birthDate: string;
  birthTime?: string | null;
  birthPlace?: string | null;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  timezoneOffset?: number;
};

type InviteSummary = {
  token: string;
  status: "pending" | "processing" | "completed" | "expired" | "failed";
  expiresAt: string;
  creatorName?: string;
  resultId?: string | null;
};

const SIGN_LABELS: Record<ZodiacSign, string> = {
  aries: "Aries",
  taurus: "Taurus",
  gemini: "Gemini",
  cancer: "Cancer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  scorpio: "Scorpio",
  sagittarius: "Sagittarius",
  capricorn: "Capricorn",
  aquarius: "Aquarius",
  pisces: "Pisces",
};

function signLabel(sign: ZodiacSign | undefined, language: HintLanguage) {
  return sign ? translateText(SIGN_LABELS[sign], language) : at(language, "unavailable");
}

function compatibilityStorageKey(id: string, owner = getAnonId()) {
  return `hint_compatibility_result_v2:${encodeURIComponent(owner)}:${id}`;
}

function isReadableResult(value: unknown, id: string): value is CompatibilityResult {
  const result = value as CompatibilityResult | null;
  return Boolean(result && result.id === id && (result.source === "api" || result.source === "preview")
    && ["user", "friend"].every(key => {
      const chart = result.people?.[key as "user" | "friend"]?.chart;
      return chart && chart.input && Array.isArray(chart.placements);
    })
    && ["overall", "attraction", "communication", "emotionalRhythm", "stability", "tension"].every(key => {
      const score = result.scores?.[key as keyof CompatibilityResult["scores"]];
      return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;
    })
    && ["strongestLink", "easyPart", "frictionPoint", "advice"].every(key => typeof result.highlights?.[key as keyof CompatibilityResult["highlights"]] === "string"));
}

function readStoredResult(id: string) {
  try {
    const raw = window.localStorage.getItem(compatibilityStorageKey(id));
    const result: unknown = raw ? JSON.parse(raw) : null;
    return isReadableResult(result, id) ? result : null;
  } catch {
    return null;
  }
}

function writeStoredResult(result: CompatibilityResult, owner: string) {
  try {
    window.localStorage.setItem(compatibilityStorageKey(result.id, owner), JSON.stringify(result));
  } catch {
    // Local result cache is best-effort.
  }
}

function detailsToBirthInput(input: BirthDetails): BirthProfileInput {
  return {
    name: input.name,
    birthday: input.birthDate,
    birthTime: input.birthTime ?? undefined,
    birthCity: input.birthPlace ?? undefined,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: input.timezoneOffset ?? input.timezone,
  };
}

function BirthDetailsForm({
  title,
  subtitle,
  initial,
  submitLabel,
  saving,
  requireConsent = false,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  initial?: BirthDetails | null;
  submitLabel: string;
  saving?: boolean;
  requireConsent?: boolean;
  onSubmit: (input: BirthDetails, consent: boolean) => void | Promise<void>;
}) {
  const { language } = useLanguage();
  const [consent, setConsent] = useState(!requireConsent);
  const profile: BirthProfile | null = initial ? {
    ...initial, birthPlace: initial.birthPlace ?? "", birthTime: initial.birthTime ?? undefined,
    id: "form", createdAt: "", updatedAt: "",
  } : null;
  return <div className="grid gap-3">
    <p className="text-sm"><LocalizedText text={subtitle} /></p>
    {requireConsent && <label className="flex gap-3 p-3 text-sm">
      <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><LocalizedText text={" I consent to share these birth details for this compatibility preview. "} /></label>}
    <BirthProfileForm profile={profile} title={title} submitLabel={submitLabel} description={requireConsent ? togetherText(language, "comparisonNote") : undefined} disabled={Boolean(saving) || !consent}
      onSubmit={async draft => {
        if (!consent || saving) return;
        await onSubmit({ ...draft, latitude: optionalBirthNumber(draft.latitude), longitude: optionalBirthNumber(draft.longitude), timezoneOffset: optionalBirthNumber(draft.timezoneOffset) }, consent);
      }} />
  </div>;
}

function ChartMini({ label, chart }: { label: string; chart: NormalizedBirthChart }) {
  const { language } = useLanguage();
  return <article className="astro-guide-panel">
    <p className="astro-guide-eyebrow">{at(language, "birthSky")}</p><h2>{label}</h2>
    <div className="astro-placement-list">{(["sun", "moon", "rising"] as const).map(body => {
      const placement = chart.placements?.find(item => item.body === body);
      return <div key={body}><span>{bodyName(body, language)}</span><span>{placement?.sign ? signLabel(placement.sign, language) : at(language, "unavailable")}</span></div>;
    })}</div>
    <details><summary>{at(language, "birth")}</summary><p>{chart.input?.birthday || at(language, "unavailable")} · {chart.input?.birthTime || at(language, "unavailable")} · {chart.input?.birthCity || at(language, "unavailable")}</p></details>
  </article>;
}

function reportProfile(chart: NormalizedBirthChart, name: string | undefined, id: string): ReportBirthProfile {
  const input = chart.input;
  return { id, name: name ?? input.name ?? "", birthDate: input.birthday, birthTime: input.birthTime, birthPlace: input.birthCity ?? "", latitude: input.latitude, longitude: input.longitude,
    timezone: typeof input.timezone === "string" ? input.timezone : undefined,
    timezoneOffset: typeof input.timezone === "number" ? input.timezone : undefined,
    createdAt: chart.calculatedAt, updatedAt: chart.calculatedAt };
}

function ResultView({ id }: { id: string }) {
  const { t, language } = useLanguage();
  const [result, setResult] = useState<CompatibilityResult | null>(() => readStoredResult(id));
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useRelationshipReset(() => {
    request.current?.abort(); setResult(null);
    setError(togetherText(language, "contextChanged"));
  });

  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const context = captureRelationshipContext();
    const current = () => !controller.signal.aborted && context.isCurrent();
    setError("");
    void apiFetch(apiUrl(`/api/compatibility/${id}`), { signal: controller.signal })
      .then(async response => {
        if (!current()) return null;
        if (response.status === 404 || response.status === 410) {
          setResult(null);
          try { localStorage.removeItem(compatibilityStorageKey(id, context.owner)); } catch {}
          throw new Error("Result unavailable. The link may have been removed.");
        }
        if (!response.ok) throw new Error("Could not refresh this result. Retry when connected.");
        return response.json() as Promise<CompatibilityResult>;
      }).then(payload => {
        if (!current()) return;
        if (!isReadableResult(payload, id)) throw new Error("Could not refresh this result. Retry when connected.");
        setResult(payload); writeStoredResult(payload, context.owner);
      })
      .catch(error => { if (current()) setError(error.message); });
    return () => controller.abort();
  }, [id, retry]);

  if (!result) {
    return (
      <PanelShell eyebrow="Together" title="Shared chart" subtitle={error || "Opening compatibility result..."}>
        {error && <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11"><LocalizedText text={"Retry"} /></button>}
        <Link className="inline-flex rounded-full border px-5 py-3 text-[13px] font-black" style={{ borderColor: "var(--hint-border)", color: "var(--hint-text)" }} href="/app/compatibility"><LocalizedText text={" Back to Together "} /></Link>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      eyebrow="Together"
      title={`${result.people.user.name || translateText("You", language)} + ${result.people.friend.name || translateText("Friend", language)}`}
      subtitle={at(language, "togetherIntro")}
    >
      {error && <p role="status"><LocalizedText text={error} /> <button type="button" className="min-h-11" onClick={() => setRetry(value => value + 1)}><LocalizedText text={"Retry"} /></button></p>}
      {result.source === "api" && result.synastry?.natal && result.synastry.calculation?.aspectSource === "hint-geometry" ? <RelationshipReading user={reportProfile(result.people.user.chart,result.people.user.name,"user")} partner={reportProfile(result.people.friend.chart,result.people.friend.name,"partner")} result={result.synastry}/> : <>
      <section className="astro-guide-panel">
        <p className="astro-guide-eyebrow">{togetherText(language, "private")}</p>
        <h2>{togetherText(language, "placements")}</h2><p>{togetherText(language, "snapshot")}</p>
        <p className="astro-guide-note">{t(result.source === "api" ? "quality.calculatedChart" : "quality.preview")}</p>
        <p className="astro-guide-note">{togetherText(language, "noAspects")}</p>
      </section>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <ChartMini label={result.people.user.name || translateText("You", language)} chart={result.people.user.chart} />
          <ChartMini label={result.people.friend.name || translateText("Friend", language)} chart={result.people.friend.chart} />
        </div>
      </>}
    </PanelShell>
  );
}

function InviteView({ token }: { token: string }) {
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
  const [invite, setInvite] = useState<InviteSummary | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  const loadRequest = useRef<AbortController | null>(null);
  useRelationshipReset(() => {
    loadRequest.current?.abort(); request.current?.abort();
    setInvite(null); setIsSubmitting(false); inFlight.current = false;
    setError(togetherText(language, "contextChanged"));
  });
  useEffect(() => () => { request.current?.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadRequest.current = controller;
    const context = captureRelationshipContext();
    const current = () => !controller.signal.aborted && context.isCurrent();
    setError("");
    setInvite(null);
    void apiFetch(apiUrl(`/api/compatibility/invite/${token}`), { signal: controller.signal })
      .then(async response => {
        if (!current()) return null;
        if (!response.ok) throw new Error(response.status === 410 ? "This invitation has expired." : response.status === 404 ? "Invite not found." : "Invite service unavailable. Please retry.");
        return response.json() as Promise<InviteSummary>;
      }).then(payload => { if (current()) setInvite(payload); })
      .catch(error => { if (current()) { setInvite(null); setError(error.message); } });
    return () => controller.abort();
  }, [token, retry]);

  useEffect(() => {
    if (invite?.status === "completed" && invite.resultId) {
      navigate(`/app/compatibility/${invite.resultId}`);
    }
  }, [invite?.resultId, invite?.status, navigate]);

  async function completeInvite(input: BirthDetails, consent: boolean) {
    if (inFlight.current || !consent || !invite) return;
    inFlight.current = true;
    const controller = new AbortController(); request.current = controller;
    const signal = controller.signal;
    const context = captureRelationshipContext();
    const current = () => !signal.aborted && context.isCurrent();
    setIsSubmitting(true);
    setError("");
    try {
      const response = await apiFetch(apiUrl(`/api/compatibility/invite/${token}/complete`), {
        signal,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          friendName: input.name,
          friendBirthProfile: detailsToBirthInput(input),
          consent,
        }),
      });
      if (!current()) return;
      if (response.status === 202) { setInvite(current => current ? { ...current, status: "processing" } : current); return; }
      if (!response.ok) throw new Error(response.status === 410 ? "This invitation has expired." : "Calculation could not be completed. Your details are still here; retry.");
      const payload = (await response.json()) as { resultId: string; result: CompatibilityResult };
      if (!current()) return;
      if (!isReadableResult(payload.result, payload.resultId)) throw new Error("Calculation could not be completed. Your details are still here; retry.");
      writeStoredResult(payload.result, context.owner);
      navigate(`/app/compatibility/${payload.resultId}`);
    } catch (submitError) {
      if (!current()) return;
      setError(submitError instanceof Error ? submitError.message : "Could not complete invite.");
    } finally {
      if (request.current === controller) {
        inFlight.current = false;
        if (current()) setIsSubmitting(false);
      }
    }
  }

  if (error && !invite) {
    return (
      <PanelShell eyebrow="Together" title="Invite unavailable" subtitle={error}>
        <button type="button" className="min-h-11" onClick={() => setRetry(value => value + 1)}><LocalizedText text={"Retry"} /></button>
        <Link className="inline-flex rounded-full border px-5 py-3 text-[13px] font-black" style={{ borderColor: "var(--hint-border)", color: "var(--hint-text)" }} href="/app/compatibility"><LocalizedText text={" Create a new invite "} /></Link>
      </PanelShell>
    );
  }

  if (!invite) return <PanelShell eyebrow="Together" title="Shared chart" subtitle="Loading invitation..."><p role="status"><LocalizedText text={"Please wait."} /></p></PanelShell>;
  if (invite.status === "processing") return <PanelShell eyebrow="Together" title="Calculation in progress" subtitle="This invitation already has a calculation in progress."><button type="button" className="min-h-11" onClick={() => setRetry(value => value + 1)}><LocalizedText text={"Check result"} /></button></PanelShell>;
  if (invite.status === "completed" && invite.resultId) {
    return null;
  }
  if (invite.status === "completed") return <PanelShell eyebrow="Together" title={t("quality.inviteAccepted")} subtitle={t("quality.privateResult")}>
    <Link href="/app/compatibility" className="inline-flex min-h-11 items-center underline"><LocalizedText text={"Back to Together"} /></Link>
  </PanelShell>;
  if (invite.status === "expired") return <PanelShell eyebrow="Together" title="Invite unavailable" subtitle="This invitation has expired.">
    <Link href="/app/compatibility" className="inline-flex min-h-11 items-center underline"><LocalizedText text={"Create a new invite"} /></Link>
  </PanelShell>;

  return (
    <PanelShell
      eyebrow="Together"
      title={t("quality.invited").replace("{name}", invite?.creatorName ?? t("quality.someone"))}
      subtitle="Add your birth details only if you consent. Hint will build a shared compatibility preview from both charts."
    >
      {error || invite.status === "failed" ? <p role="alert" className="mb-4 rounded-[18px] border p-3 text-[13px] font-semibold" style={{ background: "var(--hint-card-inner)", borderColor: "var(--hint-border)", color: "var(--hint-rose)" }}><LocalizedText text={error || "Calculation could not be completed. Your details are still here; retry."} /></p> : null}
      <BirthDetailsForm
        title="Your birth details"
        subtitle="These details are used only for this shared comparison. Review them before continuing."
        submitLabel="Open shared chart"
        saving={isSubmitting}
        requireConsent
        onSubmit={completeInvite}
      />
    </PanelShell>
  );
}

function PanelShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t, language } = useLanguage();
  const [location] = useLocation();
  const isNested = /\/compatibility\/[^/?#]+/.test(location);
  return (
    <AppScreen>
      <main className="hint-compatibility astro-guide astro-guide-stack">
        <SpaceNavigation backHref={isNested ? "/app/compatibility" : undefined} backLabel={isNested ? at(language, "together") : undefined} />
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="min-w-0 break-words">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--hint-gold)" }}><LocalizedText text={eyebrow} /></p>
            <h1 className="mt-2 font-serif text-[34px] leading-tight" style={{ color: "var(--hint-text)" }}><LocalizedText text={title} /></h1>
            <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--hint-muted)" }}><LocalizedText text={subtitle} /></p>
          </div>
          <Link href="/app/astrology" aria-label={t("nav.astrology")} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border" style={{ background: "var(--hint-surface-soft)", borderColor: "var(--hint-border)", color: "var(--hint-text)" }}>
            <Sparkles size={20} />
          </Link>
        </div>
        {children}
        <p className="mt-7 rounded-[20px] border p-4 text-[12px] font-semibold leading-relaxed" style={{ background: "var(--hint-surface-soft)", borderColor: "var(--hint-border)", color: "var(--hint-muted)" }}><LocalizedText text={" Compatibility is a reflective chart preview. It is not a guaranteed prediction, and invite completion requires consent. "} /></p>
      </main>
    </AppScreen>
  );
}

function DefaultCompatibilityView() {
  const { t, language } = useLanguage();
  const { anonId, profile, saveProfile, isSaving } = useProfile();
  const selfDetails = profile?.birthDate
    ? {
        name: profile.name,
        birthDate: profile.birthDate,
        birthTime: profile.birthTime,
        birthPlace: profile.birthPlace,
        latitude: profile.latitude ?? undefined, longitude: profile.longitude ?? undefined, timezone: profile.timezone ?? undefined, timezoneOffset: profile.timezoneOffset ?? undefined,
      }
    : null;
  const { birthInput, chart, isLoading: chartLoading, error: chartError, recalculate } = useBirthChart(anonId, selfDetails);
  const [chartRetrying, setChartRetrying] = useState(false);
  const [chartRetryFailed, setChartRetryFailed] = useState(false);
  const chartRetry = useRef<symbol | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const createRequest = useRef<AbortController | null>(null);
  const createGeneration = useRef(0);
  const creating = useRef(false);
  const canInvite = Boolean(birthInput && chart);
  const inputKey = JSON.stringify(birthInput);
  useRelationshipReset(() => {
    createGeneration.current++; createRequest.current?.abort(); creating.current = false;
    chartRetry.current = null; setChartRetrying(false); setChartRetryFailed(false);
    setIsCreating(false); setInviteUrl(""); setCopyStatus(""); setError(togetherText(language, "contextChanged"));
  });
  useEffect(() => {
    createGeneration.current++;
    createRequest.current?.abort();
    creating.current = false;
    chartRetry.current = null; setChartRetrying(false); setChartRetryFailed(false);
    setIsCreating(false); setInviteUrl(""); setCopyStatus(""); setError("");
    return () => { createGeneration.current++; createRequest.current?.abort(); };
  }, [inputKey]);

  const coreLine = useMemo(() => {
    if (!chart) return birthInput ? at(language, "setupCopy") : at(language, "incomplete");
    return t("quality.chartAnchor").replace("{sun}", signLabel(chart.sunSign, language)).replace("{moon}", signLabel(chart.moonSign, language)).replace("{rising}", signLabel(chart.risingSign, language));
  }, [chart, birthInput, language, t]);

  async function retryChart() {
    if (chartRetry.current || chartLoading || !birthInput) return;
    const attempt = Symbol(); chartRetry.current = attempt;
    const context = captureRelationshipContext();
    setChartRetrying(true); setChartRetryFailed(false);
    try { await recalculate(); }
    catch { if (chartRetry.current === attempt && context.isCurrent()) setChartRetryFailed(true); }
    finally {
      if (chartRetry.current === attempt) { chartRetry.current = null; setChartRetrying(false); }
    }
  }

  async function saveSelf(input: BirthDetails) {
    await saveProfile({
      name: input.name,
      birthDate: input.birthDate,
      birthTime: input.birthTime ?? undefined,
      birthPlace: input.birthPlace ?? undefined,
      latitude: input.latitude ?? null, longitude: input.longitude ?? null, timezone: input.timezone ?? null, timezoneOffset: input.timezoneOffset ?? null,
    });
  }

  async function createInvite() {
    if (!birthInput || !canInvite || creating.current) return;
    creating.current = true;
    const generation = ++createGeneration.current;
    createRequest.current = new AbortController();
    const signal = createRequest.current.signal;
    const context = captureRelationshipContext();
    setIsCreating(true);
    setError("");
    try {
      publicAppUrl("/app/compatibility");
      const response = await apiFetch(apiUrl("/api/compatibility/invite"), {
        signal,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          createdByUserId: anonId,
          relationshipType: "unclear",
          birthProfile: birthInput,
        }),
      });
      if (!response.ok) throw new Error("Could not create invite.");
      const invite = (await response.json()) as { token: string };
      if (signal.aborted || generation !== createGeneration.current || !context.isCurrent()) return;
      setInviteUrl(publicAppUrl(`/app/compatibility/invite/${encodeURIComponent(invite.token)}`));
    } catch (inviteError) {
      if (!signal.aborted && generation === createGeneration.current && context.isCurrent()) setError("Could not create invite.");
    } finally {
      if (generation === createGeneration.current) { creating.current = false; setIsCreating(false); }
    }
  }
  async function copyInvite() {
    const generation = createGeneration.current;
    const context = captureRelationshipContext();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(inviteUrl);
      if (generation === createGeneration.current && context.isCurrent()) setCopyStatus(t("quality.copied"));
    } catch { if (generation === createGeneration.current && context.isCurrent()) setCopyStatus(t("quality.copyFailed")); }
  }

  return (
    <PanelShell
      eyebrow="Together"
      title="Shared chart room"
      subtitle="Invite-based compatibility. Your chart starts the room; their chart is added only after they consent."
    >
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[34px] border p-5 shadow-[var(--hint-elevated-shadow)]" style={{ background: "var(--hint-hero-surface)", borderColor: "var(--hint-border)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "var(--hint-surface-soft)", borderColor: "var(--hint-border)", color: "var(--hint-gold)" }}>
              <UserRound size={14} /><LocalizedText text={" Invite flow "} /></span>
            <span className="rounded-full border px-3 py-1.5 text-[11px] font-semibold" style={{ background: "var(--hint-surface-soft)", borderColor: "var(--hint-border)", color: "var(--hint-muted)" }}><LocalizedText text={" Consent required "} /></span>
          </div>
          <h2 className="mt-5 font-serif text-[28px] leading-tight" style={{ color: "var(--hint-text)" }}>{at(language, "together")}</h2>
          <p className="mt-4 max-w-2xl text-[16px] font-semibold leading-relaxed" style={{ color: "var(--hint-muted)" }}>{coreLine}</p>
          <button
            type="button"
            disabled={!canInvite || isCreating}
            onClick={createInvite}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 text-[14px] font-semibold transition-[transform,opacity] duration-200 hover:-translate-y-0.5 disabled:opacity-45"
            style={{ background: "linear-gradient(135deg, var(--hint-gold-bright), var(--hint-gold))", color: "#080B14" }}
          >
            <LocalizedText text={isCreating ? "Creating..." : "Create invite link"} />
          </button>
          {!canInvite && !birthInput ? <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--hint-muted)" }}>{at(language, "incomplete")}</p> : null}
          {!chart && birthInput && <div className="mt-4 grid gap-3">
            {(chartLoading || chartRetrying) && <p role="status">{at(language, "calculating")}</p>}
            {(chartError || chartRetryFailed) && !chartLoading && !chartRetrying && <p role="alert">{at(language, "chartError")}</p>}
            <button type="button" className="astro-guide-button" disabled={chartLoading || chartRetrying} onClick={() => void retryChart()}>{at(language, chartLoading || chartRetrying ? "calculating" : "refresh")}</button>
          </div>}
          {error ? <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--hint-rose)" }}><LocalizedText text={error} /></p> : null}
          {inviteUrl ? (
            <div className="mt-5 rounded-[22px] border p-4" style={{ background: "var(--hint-card-inner)", borderColor: "var(--hint-border)" }}>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--hint-faint)" }}><LocalizedText text={"Invite link"} /></p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 break-all rounded-[14px] px-3 py-2 text-[13px]" style={{ background: "var(--hint-surface-soft)", color: "var(--hint-text)" }}>{inviteUrl}</code>
                <button type="button" onClick={() => void copyInvite()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold" style={{ borderColor: "var(--hint-border)", color: "var(--hint-text)" }}>
                  <Copy size={15} /><LocalizedText text={" Copy "} /></button>
              </div>
              {copyStatus && <p role="status" className="mt-2 text-sm">{copyStatus}</p>}
            </div>
          ) : null}
        </div>
        {chart ? (
          <div className="rounded-[30px] border p-5 shadow-[var(--hint-elevated-shadow)]" style={{ background: "var(--hint-card-surface)", borderColor: "var(--hint-border)" }}>
            <div className="astro-placement-list">{(["sun", "moon", "rising"] as const).map(body => <div key={body}><span>{bodyName(body, language)}</span><span>{signLabel(chart.placements?.find(placement => placement.body === body)?.sign, language)}</span></div>)}</div>
            <h2 className="mt-2 font-serif text-[30px]" style={{ color: "var(--hint-text)" }}><LocalizedText text={"Your side is ready."} /></h2>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed" style={{ color: "var(--hint-muted)" }}>
              {signLabel(chart.venusSign, language)}<LocalizedText text={" Venus and "} />{signLabel(chart.marsSign, language)}<LocalizedText text={" Mars help shape the relationship preview. "} /></p>
          </div>
        ) : (
          <BirthDetailsForm initial={selfDetails} title={selfDetails ? at(language, "edit") : "Save your birth details"} subtitle={at(language, "setupCopy")} submitLabel="Save profile" saving={isSaving} onSubmit={saveSelf} />
        )}
      </section>
    </PanelShell>
  );
}

export function CompatibilityView() {
  const owner = getAnonId();
  const [isInvite, inviteParams] = useRoute("/app/compatibility/invite/:token");
  const [isResult, resultParams] = useRoute("/app/compatibility/:id");

  if (isInvite && inviteParams?.token) return <InviteView key={`${owner}:${inviteParams.token}`} token={inviteParams.token} />;
  if (isResult && resultParams?.id) return <ResultView key={`${owner}:${resultParams.id}`} id={resultParams.id} />;
  return <DefaultCompatibilityView />;
}
