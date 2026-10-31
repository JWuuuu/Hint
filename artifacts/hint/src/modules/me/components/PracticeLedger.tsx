import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "../../../lib/i18n";
import { useCardCollection } from "../../../shared/hooks/useCardCollection";
import { PERSONALITY_TRANSLATIONS } from "../../features/personalityCopy";
import { ME_COPY, ME_LOCALES } from "../meCopy";
import { practiceRhythm, type PracticeEntry } from "../utils";

/** The newest thing the person kept: a tarot reading or a daily pull. */
export type KeptLetter = {
  kind: "tarot" | "daily";
  createdAt: string;
  question?: string;
  spreadLabel?: string;
  cards: { cardId?: string; name: string; reversed: boolean }[];
};

const STAR = "M8 .8C8.6 5.4 10.6 7.4 15.2 8 10.6 8.6 8.6 10.6 8 15.2 7.4 10.6 5.4 8.6.8 8 5.4 7.4 7.4 5.4 8 .8Z";
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/**
 * What the person has kept, shown as what it is: the latest letter with its
 * own cards, the nights they came back, and the deck they are filling. A new
 * person sees one invitation instead of a column of zeros.
 */
export function PracticeLedger({ entries, latest, personality }: {
  entries: PracticeEntry[];
  latest: KeptLetter | null;
  personality: string | null;
}) {
  const { language } = useLanguage();
  const copy = ME_COPY[language];
  const collection = useCardCollection();
  const rhythm = practiceRhythm(entries);
  const images = new Map(collection.cards.map(card => [card.cardId, card.image]));
  const personalityName = personality ? PERSONALITY_TRANSLATIONS[personality]?.[language]?.name ?? personality : null;
  const kept = entries.length > 0;
  const date = latest
    ? new Intl.DateTimeFormat(ME_LOCALES[language], { month: "long", day: "numeric" }).format(new Date(latest.createdAt))
    : null;
  const title = latest?.question?.trim()
    ? fill(copy.quoted, { text: latest.question.trim() })
    : latest?.kind === "daily" ? copy.dailyCard : latest?.spreadLabel ?? copy.dailyCard;
  const fan = latest?.cards.slice(0, 3) ?? [];

  return <section className="me-section me-kept" aria-labelledby="me-kept-heading">
    <div className="me-kept-head">
      <h2 id="me-kept-heading">{copy.keptHeading}</h2>
      {kept && <Link href="/app/readings" className="me-see-all"><span>{fill(copy.seeAll, { count: entries.length })}</span><ChevronRight size={15} aria-hidden="true" /></Link>}
    </div>

    {latest ? <Link href="/app/readings" className="me-letter">
      <span className="me-letter-fan" data-count={fan.length} aria-hidden="true">
        {fan.map((card, index) => {
          const image = card.cardId ? images.get(card.cardId) : null;
          return <span key={`${card.name}-${index}`} className="me-mini-card" data-reversed={card.reversed || undefined}>
            {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <svg viewBox="0 0 16 16"><path d={STAR} /></svg>}
          </span>;
        })}
      </span>
      <span className="me-letter-copy">
        <span className="me-letter-date">{date}</span>
        <span className="me-letter-title" data-question={latest.question?.trim() ? "true" : undefined}>{title}</span>
        {latest.cards.length > 0 && <span className="me-letter-cards">{latest.cards.map(card => card.name).join(", ")}</span>}
      </span>
    </Link> : <div className="me-invite">
      <svg className="me-invite-art" viewBox="0 0 72 52" aria-hidden="true" focusable="false">
        <rect x="1" y="1" width="70" height="50" rx="6" />
        <polyline points="1.5,2 36,30 70.5,2" />
        <circle cx="36" cy="30" r="7" />
      </svg>
      <p className="me-invite-title">{copy.firstLetterTitle}</p>
      <p className="me-invite-body">{copy.firstLetterBody}</p>
      <Link href="/app/daily" className="me-primary">{copy.firstLetterAction}</Link>
    </div>}

    {kept && <div className="me-tiles">
      <Link href="/app/daily" className="me-tile">
        <strong>{copy.rhythm}</strong>
        <span className="me-rhythm-stars" aria-hidden="true">
          {rhythm.active.map((on, index) => <svg key={index} viewBox="0 0 16 16" data-on={on || undefined}><path d={STAR} /></svg>)}
        </span>
        <span className="me-tile-value">{fill(copy.rhythmSummary, { count: rhythm.count })}</span>
      </Link>
      <Link href="/app/collection" className="me-tile">
        <strong>{copy.deck}</strong>
        <span className="me-deck-grid" aria-hidden="true">
          {collection.cards.map(card => <i key={card.cardId} data-on={card.unlocked || undefined} />)}
        </span>
        <span className="me-tile-value">{fill(copy.collectionSummary, { unlocked: collection.unlocked, total: collection.total })}</span>
      </Link>
    </div>}

    <Link href="/app/personalities" className="me-type-row">
      <span className="me-type-copy">
        <span>{copy.personalityKept}</span>
        <strong>{personalityName ?? copy.personalityNone}</strong>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  </section>;
}
