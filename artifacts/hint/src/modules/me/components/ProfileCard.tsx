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
import { Constellation, sunSignFromDate } from "./Constellation";

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

/** The last 14 days, oldest first, and how many of them had a reading. */
export type Rhythm = { active: boolean[]; count: number };

/**
 * The postmark: today's date in the cancel ring, and one mark around the ring
 * for each of the last 14 days, starting at the top and running clockwise to
 * today. A day the person came back is inked in.
 */
function Postmark({ rhythm, label, locale }: { rhythm: Rhythm; label: string; locale: string }) {
  const today = new Date();
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(today);
  const day = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(today);
  const days = rhythm.active.length;
  return <svg className="me-postmark" viewBox="0 0 172 96" role="img" aria-label={label} focusable="false">
    {/* Cancellation waves run off the stamp, over the flap. */}
    <g className="me-postmark-waves" aria-hidden="true">
      {[30, 42, 54, 66].map(y => <path key={y} d={`M2 ${y} q 9 -5 18 0 t 18 0 t 18 0 t 18 0 t 16 0`} />)}
    </g>
    <circle className="me-postmark-ring" cx="124" cy="48" r="44" />
    <circle className="me-postmark-ring me-postmark-inner" cx="124" cy="48" r="29" />
    {rhythm.active.map((on, index) => {
      const angle = (index / days) * Math.PI * 2 - Math.PI / 2;
      return <circle key={index} className="me-postmark-day" data-on={on || undefined}
        cx={124 + Math.cos(angle) * 36.5} cy={48 + Math.sin(angle) * 36.5} r={on ? 2.9 : 2} />;
    })}
    <text className="me-postmark-month" x="124" y="42" textAnchor="middle">{month}</text>
    <text className="me-postmark-date" x="124" y="62" textAnchor="middle">{day}</text>
  </svg>;
}

/**
 * The letter the universe wrote to this person, rising out of its envelope.
 * The letter carries their Sun constellation drawn in gold, their name, and
 * their birth details set like an address; the envelope keeps the wax seal
 * (their Sun glyph once a real chart exists, their initial before that) and,
 * once they have kept a reading, a postmark of the days they came back.
 */
export function ProfileCard({ profile, onEdit, signs, rhythm = null, reveal = false }: {
  profile: Profile | null;
  onEdit: () => void;
  signs: SkySigns | null;
  rhythm?: Rhythm | null;
  /** Play the one arrival moment: the letter rises and the constellation draws in. */
  reveal?: boolean;
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
  const sun = signs?.sun ?? (hasBirth ? sunSignFromDate(profile!.birthDate) : null);
  const placements: { key: "sun" | "moon" | "rising"; sign: ZodiacSign }[] = [];
  if (signs) {
    placements.push({ key: "sun", sign: signs.sun });
    if (signs.moon) placements.push({ key: "moon", sign: signs.moon });
    if (signs.rising) placements.push({ key: "rising", sign: signs.rising });
  }

  const rhythmLabel = rhythm ? `${copy.rhythm}: ${fill(copy.rhythmSummary, { count: String(rhythm.count) })}` : "";

  return <section className="me-envelope" aria-labelledby="me-envelope-name" data-empty={hasBirth ? undefined : "true"}
    data-postmarked={rhythm ? "true" : undefined} data-reveal={reveal || undefined}>
    {/* The open envelope behind the letter: its back and the raised flap. */}
    <div className="me-envelope-back" aria-hidden="true" />

    <div className="me-letter-sheet">
      <Constellation sign={sun} reveal={reveal}
        label={sun ? fill(copy.constellationOf, { sign: signName(sun, language) }) : copy.unwrittenSky} />
      <p className="me-constellation-name" aria-hidden="true">{sun ? signName(sun, language) : copy.unwrittenSky}</p>
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
      </> : <p className="me-envelope-prompt">{copy.birthPrompt}</p>}
    </div>

    {/* The envelope's front: the pocket the letter rose from. */}
    <div className="me-pocket">
      <svg className="me-pocket-folds" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <polygon points="0,0 400,0 400,100 0,100" />
        <polyline points="0,0 200,62 400,0" />
        <polyline points="0,100 200,62 400,100" />
      </svg>
      <span className="me-seal" data-glyph={signs ? "true" : undefined} aria-hidden="true"><span>{signs ? glyph(signs.sun) : initial}</span></span>
      {rhythm && <Postmark rhythm={rhythm} label={rhythmLabel} locale={locale} />}
    </div>

    {hasBirth ? <div className="me-envelope-actions">
      <button type="button" onClick={onEdit} aria-label={t("me.editProfile")} data-testid="button-edit-profile">
        <Pencil size={15} aria-hidden="true" /><span>{copy.edit}</span>
      </button>
      <Link href="/app/astrology?tab=chart"><span>{copy.openChart}</span><ChevronRight size={16} aria-hidden="true" /></Link>
    </div> : <div className="me-envelope-actions" data-single="true">
      <button type="button" className="me-envelope-add" onClick={onEdit} data-testid="button-edit-profile">{copy.addBirth}</button>
    </div>}
  </section>;
}
