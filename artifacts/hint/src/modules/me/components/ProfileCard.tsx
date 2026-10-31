import { ChevronRight, Pencil } from "lucide-react";
import { Link } from "wouter";
import type { Profile } from "@workspace/api-client-react";
import { useLanguage } from "../../../lib/i18n";
import { useLocalAccount } from "../../../lib/auth";
import { validBirthDate } from "../../../lib/birthDetails";
import type { ZodiacSign } from "../../../types/astrology";
import { SIGN_ORDER, SIGN_SYMBOLS, signName } from "../../astrology/astrologyLibrary";
import { ME_COPY, ME_LOCALES } from "../meCopy";
import { initialsFrom } from "../utils";

/** Signs taken from a chart the app actually calculated; never inferred here. */
export type SkySigns = { sun: ZodiacSign; moon?: ZodiacSign; rising?: ZodiacSign };

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

/** Text presentation, so phones draw the glyph rather than an emoji. */
const glyph = (sign: ZodiacSign) => `${SIGN_SYMBOLS[SIGN_ORDER.indexOf(sign)] ?? ""}︎`;

function birthTimeLabel(time: string, locale: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return time;
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, 0, 1, Number(match[1]), Number(match[2]))));
}

/**
 * The envelope the universe addresses to this person: a wax seal where the
 * flap meets (their Sun glyph once a real chart exists, their initial before
 * that), their name, and their birth details set like an address.
 */
export function ProfileCard({ profile, onEdit, signs }: {
  profile: Profile | null;
  onEdit: () => void;
  signs: SkySigns | null;
}) {
  const { language, t } = useLanguage();
  const copy = ME_COPY[language];
  const locale = ME_LOCALES[language];
  const account = useLocalAccount();
  const name = profile?.name?.trim() || account?.name?.trim() || t("me.guest");
  const initial = Array.from(initialsFrom(name))[0] ?? "";
  const hasBirth = Boolean(profile?.birthDate && validBirthDate(profile.birthDate));
  const date = hasBirth
    ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
      .format(new Date(`${profile!.birthDate}T12:00:00Z`))
    : "";
  const time = hasBirth && profile?.birthTime ? birthTimeLabel(profile.birthTime, locale) : null;
  const place = profile?.birthPlace?.trim() || null;
  const placements: { key: "sun" | "moon" | "rising"; sign: ZodiacSign }[] = [];
  if (signs) {
    placements.push({ key: "sun", sign: signs.sun });
    if (signs.moon) placements.push({ key: "moon", sign: signs.moon });
    if (signs.rising) placements.push({ key: "rising", sign: signs.rising });
  }

  return <section className="me-envelope" aria-labelledby="me-envelope-name" data-empty={hasBirth ? undefined : "true"}>
    <svg className="me-envelope-flap" viewBox="0 0 400 104" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polygon points="0,0 400,0 200,94" />
      <polyline points="0,0 200,94 400,0" />
    </svg>
    <span className="me-seal" data-glyph={signs ? "true" : undefined} aria-hidden="true"><span>{signs ? glyph(signs.sun) : initial}</span></span>
    <h2 id="me-envelope-name" className="me-envelope-name">{name}</h2>

    {hasBirth ? <>
      <p className="me-address">
        <span>{time ? fill(copy.atTime, { date, time }) : date}</span>
        {place && <><br /><span>{place}</span></>}
      </p>
      {!time && <p className="me-address-note">{copy.unknownTime}</p>}
      {placements.length > 0 && <dl className="me-sky-signs">
        {placements.map(({ key, sign }) => <div key={key}>
          <dt>{copy[key]}</dt>
          <dd><span className="me-sign-glyph" aria-hidden="true">{glyph(sign)}</span>{signName(sign, language)}</dd>
        </div>)}
      </dl>}
      <div className="me-envelope-actions">
        <button type="button" onClick={onEdit} aria-label={t("me.editProfile")} data-testid="button-edit-profile">
          <Pencil size={15} aria-hidden="true" /><span>{copy.edit}</span>
        </button>
        <Link href="/app/astrology?tab=chart"><span>{copy.openChart}</span><ChevronRight size={16} aria-hidden="true" /></Link>
      </div>
    </> : <>
      <p className="me-envelope-prompt">{copy.birthPrompt}</p>
      <button type="button" className="me-secondary" onClick={onEdit} data-testid="button-edit-profile">{copy.addBirth}</button>
    </>}
  </section>;
}
