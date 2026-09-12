import { RelationshipReading } from "./RelationshipReading";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { BirthProfileForm, type BirthProfileDraft } from "@/components/astro/BirthProfileForm";
import { birthDetailsError, birthInputFingerprint, optionalBirthNumber } from "@/lib/birthDetails";
import { apiFetch, apiUrl } from "@/lib/api";
import { publicAppUrl } from "@/lib/publicUrls";
import { getSynastry } from "@/lib/astro/astroClient";
import { useLanguage } from "@/lib/i18n";
import type { AstroSynastryResponse, BirthProfile } from "@/types/astrology";
import { at } from "../astrologyCopy";
import { togetherText } from "../togetherCopy";
import { captureRelationshipContext, useRelationshipReset } from "../relationshipContext";

type Comparison = { user: BirthProfile; partner: BirthProfile; result: AstroSynastryResponse };

export function TogetherReading({ profile }: { profile: BirthProfile | null }) {
  const { language } = useLanguage();
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [consent, setConsent] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<"incomplete" | "unavailable" | null>(null);
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviteError, setInviteError] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [shareError, setShareError] = useState(false);
  const sharing = useRef(false);
  const request = useRef<AbortController | null>(null);
  const inviteRequest = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const inviteGeneration = useRef(0);
  const copying = useRef(false);
  const profileKey = profile ? JSON.stringify([profile.id, profile.name, birthInputFingerprint(profile)]) : "";
  const currentProfileKey = useRef(profileKey); currentProfileKey.current = profileKey;
  const tx = (key: Parameters<typeof togetherText>[1]) => togetherText(language, key);

  function invalidateComparison() {
    generation.current++; request.current?.abort(); request.current = null;
    setComparison(null); setCalculating(false); setCalculationError(null);
  }
  useRelationshipReset(() => {
    invalidateComparison(); setConsent(false);
    inviteGeneration.current++; inviteRequest.current?.abort(); inviteRequest.current = null;
    setInvite(null); setCreating(false); setInviteError(false); setCopyStatus("idle"); setShareError(false);
  });
  useEffect(() => {
    invalidateComparison(); setConsent(false);
    inviteGeneration.current++; inviteRequest.current?.abort(); inviteRequest.current = null;
    setInvite(null); setCreating(false); setInviteError(false); setCopyStatus("idle"); setShareError(false);
    return () => { generation.current++; inviteGeneration.current++; request.current?.abort(); inviteRequest.current?.abort(); };
  }, [profileKey]);

  async function calculate(draft: BirthProfileDraft) {
    if (!profile || !consent || request.current) return;
    const now = new Date().toISOString();
    const partner: BirthProfile = { ...draft, id: "partner", latitude: optionalBirthNumber(draft.latitude), longitude: optionalBirthNumber(draft.longitude), timezoneOffset: optionalBirthNumber(draft.timezoneOffset), createdAt: now, updatedAt: now };
    const complete = (value: BirthProfile) => !birthDetailsError(value) && value.birthTime && value.latitude !== undefined && value.longitude !== undefined && value.timezoneOffset !== undefined;
    if (!complete(profile) || !complete(partner)) { setCalculationError("incomplete"); return; }
    const user = { ...profile };
    const key = profileKey;
    const controller = new AbortController(); request.current = controller;
    const context = captureRelationshipContext();
    const attempt = ++generation.current;
    setComparison(null); setCalculating(true); setCalculationError(null);
    try {
      const result = await getSynastry(user, partner, controller.signal);
      if (controller.signal.aborted || attempt !== generation.current || key !== currentProfileKey.current || !context.isCurrent()) return;
      if (result.source !== "astrologyapi" || result.mode !== "live" || !Array.isArray(result.aspects)) throw new Error("Unavailable comparison");
      setComparison({ user, partner, result });
    } catch {
      if (!controller.signal.aborted && attempt === generation.current && context.isCurrent()) setCalculationError("unavailable");
    } finally {
      if (attempt === generation.current) { request.current = null; setCalculating(false); }
    }
  }

  async function createInvite() {
    if (!profile || inviteRequest.current) return;
    const controller = new AbortController(); inviteRequest.current = controller;
    const attempt = ++inviteGeneration.current;
    const key = profileKey;
    const context = captureRelationshipContext();
    setCreating(true); setInviteError(false); setCopyStatus("idle"); setShareError(false);
    try {
      publicAppUrl("/app");
      const response = await apiFetch(apiUrl("/api/compatibility/invite"), {
        method: "POST", signal: controller.signal, headers: { "content-type": "application/json" },
        body: JSON.stringify({ relationshipType: "unclear", birthProfile: {
          name: profile.name, birthday: profile.birthDate, birthTime: profile.birthTime, birthCity: profile.birthPlace,
          latitude: profile.latitude, longitude: profile.longitude, timezone: profile.timezoneOffset ?? profile.timezone,
        } }),
      });
      if (!response.ok) throw new Error("Invite unavailable");
      const result = await response.json() as { token: string; expiresAt: string };
      if (controller.signal.aborted || attempt !== inviteGeneration.current || key !== currentProfileKey.current || !context.isCurrent()) return;
      if (!result.token || !Number.isFinite(Date.parse(result.expiresAt))) throw new Error("Invalid invite");
      setInvite({ url: publicAppUrl(`/app/compatibility/invite/${encodeURIComponent(result.token)}`), expiresAt: result.expiresAt });
    } catch {
      if (!controller.signal.aborted && attempt === inviteGeneration.current && context.isCurrent()) setInviteError(true);
    } finally {
      if (attempt === inviteGeneration.current) { inviteRequest.current = null; setCreating(false); }
    }
  }

  async function copyInvite() {
    if (!invite || copying.current) return;
    copying.current = true;
    const attempt = inviteGeneration.current;
    const context = captureRelationshipContext();
    try {
      await navigator.clipboard.writeText(invite.url);
      if (attempt === inviteGeneration.current && context.isCurrent()) setCopyStatus("copied");
    } catch {
      if (attempt === inviteGeneration.current && context.isCurrent()) setCopyStatus("failed");
    } finally { copying.current = false; }
  }

  async function shareInvite() {
    if (!invite || sharing.current) return;
    if (!navigator.share) { await copyInvite(); return; }
    sharing.current = true; setShareError(false);
    const attempt = inviteGeneration.current;
    const context = captureRelationshipContext();
    try { await navigator.share({ title: at(language, "together"), url: invite.url }); }
    catch (error) {
      const cancelled = Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError");
      if (attempt === inviteGeneration.current && !cancelled && context.isCurrent()) setShareError(true);
    } finally { sharing.current = false; }
  }

  return <div className="astro-guide-stack" data-testid="together-reading">
    <section className="astro-guide-panel">
      <p className="astro-guide-eyebrow">{tx("private")}</p>
      <h2>{at(language, "together")}</h2><p>{at(language, "togetherIntro")}</p>
      {!profile && <Link className="astro-guide-button" href="/app/astrology?tab=birth">{at(language, "create")}</Link>}
    </section>
    {profile && <>
      <section className="astro-guide-panel">
        <h2>{tx("invite")}</h2><p>{tx("inviteNote")}</p>
        <button type="button" className="astro-guide-button" disabled={creating} onClick={() => void createInvite()}>{tx(creating ? "creating" : "create")}</button>
        {inviteError && <p role="alert">{tx("inviteError")}</p>}
        {invite && <div className="mt-4 grid min-w-0 gap-2">
          <code className="break-all text-sm">{invite.url}</code>
          <p className="astro-guide-note">{tx("expires")} · {new Date(invite.expiresAt).toLocaleDateString(language)}</p>
          <button type="button" className="astro-guide-link" onClick={() => void copyInvite()}>{tx("copy")}</button>
          <button type="button" className="astro-guide-link" onClick={() => void shareInvite()}>{tx("share")}</button>
          {copyStatus !== "idle" && <p role="status">{tx(copyStatus === "copied" ? "copied" : "copyError")}</p>}
          {shareError && <p role="alert">{tx("shareError")}</p>}
        </div>}
      </section>
      <section className="astro-guide-panel">
        <h2>{tx("compare")}</h2>
        <label className="my-4 flex min-h-11 items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={consent} className="mt-1 shrink-0" onChange={event => { setConsent(event.target.checked); invalidateComparison(); }} />{tx("consent")}</label>
        <BirthProfileForm title={tx("partner")} description={tx("comparisonNote")} submitLabel={tx(calculating ? "calculating" : "calculate")} disabled={!consent || calculating} onDraftChange={invalidateComparison} onSubmit={calculate} />
        {calculationError && <p role="alert">{calculationError === "incomplete" ? at(language, "incomplete") : tx("calculationError")}</p>}
        {calculating && <p role="status">{tx("calculating")}</p>}
      </section>
    </>}
    {comparison && <section className="astro-guide-stack" data-testid="together-result"><RelationshipReading user={comparison.user} partner={comparison.partner} result={comparison.result}/></section>}
  </div>;
}
