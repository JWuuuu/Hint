import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { getAnonId } from "@/lib/identity";
import { historyClearVersion } from "@/lib/clearHistory";
import { normalizeClientNatal } from "@/lib/astro/normalizeClientAstro";
import type { AstroSynastryResponse, BirthProfile } from "@/types/astrology";
import { createLetter } from "../reportModel";
import { rt } from "../reportCopy";
import { togetherText } from "../togetherCopy";
import { at } from "../astrologyCopy";
import { bodyName, aspectName, aspectDescription } from "../astrologyLibrary";
import { ComparisonChart } from "./ComparisonChart";
import { CelestialReport } from "./CelestialReports";

export function RelationshipReading({
  user,
  partner,
  result,
}: {
  user: BirthProfile;
  partner: BirthProfile;
  result: AstroSynastryResponse;
}) {
  const { language } = useLanguage();
  const owner = getAnonId(),
    version = historyClearVersion(owner);
  const [report, setReport] = useState(false);
  const letter = useMemo(() => {
    if (!result.natal || result.calculation?.aspectSource !== "hint-geometry")
      return null;
    const first = normalizeClientNatal(user, result.natal.user),
      second = normalizeClientNatal(partner, result.natal.partner);
    return first && second
      ? createLetter(owner, version, first, language, {
          partner: second,
          result,
        })
      : null;
  }, [user, partner, result, owner, version]);
  if (report && letter)
    return (
      <>
        <button
          type="button"
          className="astro-guide-link"
          onClick={() => setReport(false)}
        >
          <ArrowLeft size={16} />
          {rt(language, "both")}
        </button>
        <CelestialReport letter={letter} />
      </>
    );
  return (
    <div className="astro-guide-stack astro-theme">
      <header>
        <p className="astro-guide-eyebrow">{at(language, "together")}</p>
        <h2>
          {user.name} + {partner.name}
        </h2>
        <p className="astro-guide-note">
          {at(language, "calculated")} ·{" "}
          {new Date(result.fetchedAt).toLocaleString(language)}
        </p>
      </header>
      {letter && letter.charts.partner ? (
        <>
          <ComparisonChart
            user={letter.charts.user}
            partner={letter.charts.partner}
            result={result}
          />
          <button
            type="button"
            className="astro-guide-button"
            onClick={() => setReport(true)}
          >
            <BookOpen size={18} />
            {rt(language, "open")}
          </button>
        </>
      ) : (
        <>
          <p className="astro-guide-note">{rt(language, "partialNote")}</p>
          <div className="astro-placement-list">
            {result.aspects.map((a, i) => (
              <div key={i}>
                <h3>
                  {bodyName(a.from, language)} · {aspectName(a.type, language)}{" "}
                  · {bodyName(a.to, language)}
                </h3>
                <p>{aspectDescription(a.type, language)}</p>
              </div>
            ))}
          </div>
          <details>
            <summary>{togetherText(language, "original")}</summary>
            <p className="astro-guide-note">
              {togetherText(language, "originalNote")}
            </p>
            <p>{result.plainEnglish.main}</p>
            {result.aspects.map((a, i) => (
              <p key={i}>{a.meaning}</p>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
