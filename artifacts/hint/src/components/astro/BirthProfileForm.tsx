import { LocalizedText } from "../../lib/LocalizedText";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, MapPin, Search } from "lucide-react";
import { getGeoDetails, getTimezoneDetails, type AstroGeoPlace } from "../../lib/astro/astroClient";
import { useLanguage } from "../../lib/i18n";
import type { BirthProfile } from "../../types/astrology";

import { validBirthDate, birthDetailsError, optionalBirthNumber } from "../../lib/birthDetails";

export type BirthProfileDraft = {
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  latitude: string;
  longitude: string;
  timezone: string;
  timezoneOffset: string;
};

function draftFrom(profile?: BirthProfile | null): BirthProfileDraft {
  return {
    name: profile?.name ?? "",
    birthDate: profile?.birthDate ?? "",
    birthTime: profile?.birthTime ?? "",
    birthPlace: profile?.birthPlace ?? "",
    latitude: profile?.latitude !== undefined ? String(profile.latitude) : "",
    longitude: profile?.longitude !== undefined ? String(profile.longitude) : "",
    timezone: profile?.timezone ?? "",
    timezoneOffset: profile?.timezoneOffset !== undefined ? String(profile.timezoneOffset) : "",
  };
}

const ASTRO_TEXT = "var(--astro-text)";
const ASTRO_MUTED = "var(--astro-muted)";
const ASTRO_GOLD_BRIGHT = "var(--astro-gold-bright)";
const ASTRO_GOLD = "var(--astro-gold)";
const ASTRO_BORDER = "var(--astro-border)";
const ASTRO_SURFACE = "var(--astro-surface)";
const ASTRO_INNER = "var(--astro-inner)";
const ASTRO_INPUT = "var(--astro-input)";
const ASTRO_BUTTON = "var(--astro-button)";
const ASTRO_BUTTON_TEXT = "var(--astro-button-text)";

function FieldLabel({ label, required, detail }: { label: string; required?: boolean; detail?: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <span className="text-[12px] font-semibold" style={{ color: ASTRO_MUTED }}>
        {label}
      </span>
      <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ background: ASTRO_INNER, borderColor: ASTRO_BORDER, color: required ? ASTRO_GOLD_BRIGHT : ASTRO_MUTED }}>
        <LocalizedText text={required ? "Required" : detail ?? "Optional"} />
      </span>
    </div>
  );
}

export function BirthProfileForm({
  profile,
  title = "Add birth profile",
  submitLabel = "Save birth profile",
  description,
  onSubmit,
  disabled = false,
  onDraftChange,
}: {
  profile?: BirthProfile | null;
  disabled?: boolean;
  onDraftChange?: (draft: BirthProfileDraft) => void;
  title?: string;
  submitLabel?: string;
  description?: string;
  onSubmit: (profile: BirthProfileDraft) => void | Promise<void>;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<BirthProfileDraft>(() => draftFrom(profile));
  const [placeResults, setPlaceResults] = useState<AstroGeoPlace[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeMode, setPlaceMode] = useState<"live" | "fallback" | null>(null);
  const [placeError, setPlaceError] = useState("");
  const locationRequest = useRef(0);
  const locationController = useRef<AbortController | null>(null);
  const submitBusy = useRef(false);
  const [saveError, setSaveError] = useState("");
  const validDate = validBirthDate(draft.birthDate);
  const validNumber = (value: string, min: number, max: number) => !value.trim() || Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
  const validLocation = validNumber(draft.latitude, -90, 90) && validNumber(draft.longitude, -180, 180) && validNumber(draft.timezoneOffset, -12, 14);
  const complete = !disabled && draft.name.trim().length > 0 && validDate && validLocation && !birthDetailsError({ ...draft, latitude: optionalBirthNumber(draft.latitude), longitude: optionalBirthNumber(draft.longitude), timezoneOffset: optionalBirthNumber(draft.timezoneOffset) }) && !placeLoading && draft.birthPlace.trim().length > 0;
  useEffect(() => () => { locationRequest.current++; locationController.current?.abort(); }, []);

  useEffect(() => {
    setDraft(draftFrom(profile));
  }, [profile?.birthDate, profile?.birthPlace, profile?.birthTime, profile?.latitude, profile?.longitude, profile?.name, profile?.timezone, profile?.timezoneOffset]);

  function update<Key extends keyof BirthProfileDraft>(key: Key, value: BirthProfileDraft[Key]) {
    setSaveError("");
    onDraftChange?.({ ...draft, [key]: value });
    if (key === "birthPlace" || key === "birthDate") {
      locationRequest.current++;
      locationController.current?.abort();
      setPlaceResults([]);
      setPlaceLoading(false);
      setPlaceMode(null);
      setPlaceError("");
      setDraft((current) => ({ ...current, [key]: value, timezoneOffset: "", ...(key === "birthPlace" ? { latitude: "", longitude: "", timezone: "" } : {}) }));
      return;
    }
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function searchPlace() {
    const query = draft.birthPlace.trim();
    if (!query) return;
    const request = ++locationRequest.current;
    locationController.current?.abort();
    const controller = new AbortController(); locationController.current = controller;
    setPlaceLoading(true);
    setPlaceError("");
    try {
      const response = await getGeoDetails(query, 6, controller.signal);
      if (request !== locationRequest.current) return;
      setPlaceResults(response.results);
      setPlaceMode(response.mode);
      if (!response.results.length) setPlaceError(t("birthProfile.placeNotFound"));
    } catch {
      if (request !== locationRequest.current) return;
      setPlaceError(t("birthProfile.placeUnavailable"));
      setPlaceResults([]);
      setPlaceMode(null);
    } finally {
      if (request === locationRequest.current) setPlaceLoading(false);
    }
  }

  async function selectPlace(place: AstroGeoPlace) {
    onDraftChange?.(draft);
    const request = ++locationRequest.current;
    locationController.current?.abort();
    const controller = new AbortController(); locationController.current = controller;
    setPlaceLoading(true);
    setPlaceResults([]);
    setPlaceError("");
    const label = place.label ?? [place.name, place.region, place.country].filter(Boolean).join(", ");
    setDraft((current) => ({
      ...current,
      birthPlace: label || place.name,
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezone: place.timezoneId ?? place.timezone ?? current.timezone,
      timezoneOffset: "",
    }));
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate) ? draft.birthDate : new Date().toISOString().slice(0, 10);
      const timezone = await getTimezoneDetails(place.latitude, place.longitude, date, controller.signal);
      if (request !== locationRequest.current) return;
      setDraft((current) => ({
        ...current,
        timezone: timezone.timezoneId ?? place.timezoneId ?? place.timezone ?? current.timezone,
        timezoneOffset: typeof timezone.timezoneOffset === "number" ? String(timezone.timezoneOffset) : current.timezoneOffset,
      }));
    } catch {
      if (request === locationRequest.current) setPlaceError(t("birthProfile.placeUnavailable"));
    } finally {
      if (request === locationRequest.current) setPlaceLoading(false);
    }
  }

  return (
    <form
      className="rounded-[8px] border p-3.5 shadow-[var(--astro-shadow)]"
      style={{ background: ASTRO_SURFACE, borderColor: ASTRO_BORDER }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!complete || submitBusy.current) return;
        submitBusy.current = true;
        try { await onSubmit(draft); } catch { setSaveError("Birth details could not be saved on this device. Your entries are still here; please try again."); }
        finally { submitBusy.current = false; }
      }}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border" style={{ background: ASTRO_INNER, borderColor: ASTRO_BORDER, color: ASTRO_GOLD_BRIGHT }}>
          <CalendarDays size={17} />
        </span>
        <div className="min-w-0">
          <p className="mb-1 text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: ASTRO_GOLD_BRIGHT }}>{t("birthProfile.editor")}</p>
          <h2 className="font-serif text-[20px] leading-tight" style={{ color: ASTRO_TEXT }}>
            <LocalizedText text={title} />
          </h2>
          <p className="mt-1 text-[11px] font-semibold leading-snug" style={{ color: ASTRO_MUTED }}>
            {description ?? t("birthProfile.localSave")}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <label>
          <FieldLabel label={t("birthProfile.name")} required />
          <input required maxLength={200} aria-label={t("birthProfile.name")} className="astro-themed-input h-11 w-full rounded-[8px] border px-3 text-[16px] font-semibold outline-none" style={{ background: ASTRO_INPUT, borderColor: ASTRO_BORDER, color: ASTRO_TEXT }} value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder={t("birthProfile.name")} />
        </label>
        <label>
          <FieldLabel label={t("birthProfile.birthDate")} required />
          <input required max={new Date().toLocaleDateString("en-CA")} aria-label={t("birthProfile.birthDate")} type="date" className="astro-themed-input h-11 w-full rounded-[8px] border px-3 text-[16px] font-semibold outline-none" style={{ background: ASTRO_INPUT, borderColor: ASTRO_BORDER, color: ASTRO_TEXT }} value={draft.birthDate} onChange={(event) => update("birthDate", event.target.value)} placeholder={t("birthProfile.birthDate")} />
        </label>
        <label>
          <FieldLabel label={t("birthProfile.birthTime")} detail="Optional" />
          <input
            aria-label={t("birthProfile.birthTime")}
            className="astro-themed-input h-11 w-full rounded-[8px] border px-3 text-[16px] font-semibold outline-none"
            style={{ background: ASTRO_INPUT, borderColor: ASTRO_BORDER, color: ASTRO_TEXT }}
            value={draft.birthTime}
            onChange={(event) => update("birthTime", event.target.value)}
            placeholder={t("birthProfile.birthTimeOptional")}
            type="time"
          />
        </label>
        <div className="sm:col-span-2">
          <FieldLabel label={t("birthProfile.birthPlace")} required />
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="flex h-11 items-center gap-2 rounded-[8px] border px-3" style={{ background: ASTRO_INPUT, borderColor: ASTRO_BORDER, color: ASTRO_TEXT }}>
              <MapPin size={14} style={{ color: ASTRO_GOLD_BRIGHT }} />
              <input aria-label={t("birthProfile.birthPlace")} className="astro-themed-input h-full min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none" style={{ color: ASTRO_TEXT }} value={draft.birthPlace} onChange={(event) => update("birthPlace", event.target.value)} placeholder={t("birthProfile.birthPlace")} />
            </label>
            <button type="button" onClick={searchPlace} disabled={placeLoading || !draft.birthPlace.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border px-3 text-[12px] font-black transition-[opacity] disabled:opacity-50" style={{ background: ASTRO_INPUT, borderColor: ASTRO_BORDER, color: ASTRO_TEXT }}>
              <Search size={13} />
              {placeLoading ? t("birthProfile.searching") : t("birthProfile.findPlace")}
            </button>
          </div>
          {placeMode ? <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: ASTRO_MUTED }}>{placeMode === "live" ? t("birthProfile.liveMatch") : t("birthProfile.fallbackMatch")}</p> : null}
          {placeError ? <p className="mt-2 text-[12px] font-semibold" style={{ color: ASTRO_GOLD }}><LocalizedText text={placeError} /></p> : null}
          {placeResults.length ? (
            <div className="mt-3 grid gap-2">
              {placeResults.map((place) => {
                const label = place.label ?? [place.name, place.region, place.country].filter(Boolean).join(", ");
                return (
                  <button key={`${place.name}-${place.latitude}-${place.longitude}`} type="button" onClick={() => void selectPlace(place)} className="min-h-11 rounded-[8px] border px-3 py-2 text-left transition-[transform,opacity] duration-200 hover:-translate-y-0.5" style={{ background: ASTRO_INPUT, borderColor: ASTRO_BORDER, color: ASTRO_TEXT }}>
                    <span className="block text-[13px] font-black">{label || place.name}</span>
                    <span className="mt-1 block text-[11px] font-semibold" style={{ color: ASTRO_MUTED }}>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}{place.timezone ? ` · ${place.timezone}` : ""}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      <details className="mt-3 rounded-[8px] border p-3" style={{ background: ASTRO_INNER, borderColor: ASTRO_BORDER }}>
        <summary className="flex min-h-11 cursor-pointer items-center text-[11px] font-black uppercase tracking-[0.13em]" style={{ color: ASTRO_GOLD_BRIGHT }}>{t("birthProfile.advancedLocation")}</summary>
        <p className="mt-2 text-[12px] font-semibold leading-relaxed" style={{ color: ASTRO_MUTED }}>
          {t("birthProfile.advancedHelp")}
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <input className="astro-themed-input h-11 rounded-[8px] border px-3 text-[16px] font-semibold outline-none" style={{ background: ASTRO_INPUT, borderColor: ASTRO_BORDER, color: ASTRO_TEXT }} aria-label={t("birthProfile.latitude")} value={draft.latitude} onChange={(event) => update("latitude", event.target.value)} placeholder={t("birthProfile.latitude")} inputMode="decimal" />
          <input className="astro-themed-input h-11 rounded-[8px] border px-3 text-[16px] font-semibold outline-none" style={{ background: ASTRO_INPUT, borderColor: ASTRO_BORDER, color: ASTRO_TEXT }} aria-label={t("birthProfile.longitude")} value={draft.longitude} onChange={(event) => update("longitude", event.target.value)} placeholder={t("birthProfile.longitude")} inputMode="decimal" />
          <input className="astro-themed-input h-11 rounded-[8px] border px-3 text-[16px] font-semibold outline-none" style={{ background: ASTRO_INPUT, borderColor: ASTRO_BORDER, color: ASTRO_TEXT }} aria-label={t("birthProfile.timezone")} value={draft.timezone} onChange={(event) => update("timezone", event.target.value)} placeholder={t("birthProfile.timezone")} />
          <input className="astro-themed-input h-11 rounded-[8px] border px-3 text-[16px] font-semibold outline-none" style={{ background: ASTRO_INPUT, borderColor: ASTRO_BORDER, color: ASTRO_TEXT }} aria-label={t("birthProfile.timezoneOffset")} value={draft.timezoneOffset} onChange={(event) => update("timezoneOffset", event.target.value)} placeholder={t("birthProfile.timezoneOffset")} inputMode="decimal" />
        </div>
      </details>
      {saveError ? <p role="alert" className="mt-3 text-[13px]" style={{ color: ASTRO_TEXT }}><LocalizedText text={saveError} /></p> : null}
      <button
        type="submit"
        disabled={!complete}
        className="mt-3 min-h-11 w-full rounded-[8px] text-[13px] font-black shadow-[var(--astro-button-shadow)] transition-[transform,opacity] duration-200 hover:-translate-y-0.5 disabled:opacity-45"
        style={{ background: ASTRO_BUTTON, color: ASTRO_BUTTON_TEXT }}
      >
        <LocalizedText text={submitLabel} />
      </button>
    </form>
  );
}
