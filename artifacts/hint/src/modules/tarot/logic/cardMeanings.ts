import { getCardKeywords, type RitualCard } from "./createHiddenDeck";

const MAJOR_MEANINGS: Record<string, { keywords: string[]; upright: string; reversed: string }> = {
  "0-fool": {
    keywords: ["beginning", "risk", "trust"],
    upright: "The Fool points to a fresh start: take the next step, but do not mistake hope for a plan.",
    reversed: "The Fool reversed warns against either reckless action or freezing because you cannot see the whole path yet.",
  },
  "1-magician": {
    keywords: ["will", "skill", "focus"],
    upright: "The Magician says you already have tools to act; the issue is focus and execution.",
    reversed: "The Magician reversed points to scattered effort, self-doubt, or someone using skill without honesty.",
  },
  "2-high-priestess": {
    keywords: ["intuition", "mystery", "silence"],
    upright: "The High Priestess says the answer is quiet but not absent; trust what you already know and verify it calmly.",
    reversed: "The High Priestess reversed says you may be ignoring a clear inner signal or missing hidden information.",
  },
  "3-empress": {
    keywords: ["growth", "care", "abundance"],
    upright: "The Empress points to growth through care, patience, and making the situation easier to nourish.",
    reversed: "The Empress reversed points to neglect, overgiving, or trying to force growth before it is ready.",
  },
  "4-emperor": {
    keywords: ["structure", "order", "authority"],
    upright: "The Emperor asks for structure: make the plan concrete, set boundaries, and lead with steadiness.",
    reversed: "The Emperor reversed points to rigidity, control issues, or a lack of stable structure.",
  },
  "5-hierophant": {
    keywords: ["guidance", "tradition", "belief"],
    upright: "The Hierophant points to guidance, rules, and proven paths; use the system instead of fighting every step alone.",
    reversed: "The Hierophant reversed asks which rule, belief, or outside voice no longer fits your life.",
  },
  "6-lovers": {
    keywords: ["choice", "bond", "alignment"],
    upright: "The Lovers is about alignment and choice; choose what matches your values, not only what feels intense.",
    reversed: "The Lovers reversed points to misalignment, avoidance, or choosing against yourself to keep a bond intact.",
  },
  "7-chariot": {
    keywords: ["direction", "drive", "control"],
    upright: "The Chariot says progress needs direction; pick the route and keep moving even if it is not effortless.",
    reversed: "The Chariot reversed points to scattered direction, impatience, or trying to force a result before steering clearly.",
  },
  "8-strength": {
    keywords: ["courage", "patience", "heart"],
    upright: "Strength asks for calm courage: handle this firmly without becoming harsh.",
    reversed: "Strength reversed points to self-doubt, pressure, or using force where patience would work better.",
  },
  "9-hermit": {
    keywords: ["solitude", "truth", "search"],
    upright: "The Hermit says step back and get honest; the next answer comes from clarity, not noise.",
    reversed: "The Hermit reversed warns that distance may be turning into avoidance or isolation.",
  },
  "10-wheel": {
    keywords: ["cycle", "change", "timing"],
    upright: "Wheel of Fortune points to timing and change; adapt quickly instead of treating this moment as fixed.",
    reversed: "Wheel of Fortune reversed points to resistance, bad timing, or repeating a cycle without learning from it.",
  },
  "11-justice": {
    keywords: ["truth", "balance", "accountability"],
    upright: "Justice asks for facts, fairness, and accountability; look at what is true before what is comforting.",
    reversed: "Justice reversed points to avoidance, unfairness, or a truth that has not been fully faced.",
  },
  "12-hanged-man": {
    keywords: ["pause", "surrender", "perspective"],
    upright: "The Hanged Man says pause and look differently; forcing this now may cost more than waiting well.",
    reversed: "The Hanged Man reversed points to stuckness, delay, or refusing the perspective that would free you.",
  },
  "13-death": {
    keywords: ["ending", "release", "change"],
    upright: "Death says something has to end cleanly so the next phase can begin.",
    reversed: "Death reversed points to clinging to what is already ending or delaying a necessary change.",
  },
  "14-temperance": {
    keywords: ["balance", "healing", "blend"],
    upright: "Temperance asks for balance and pacing; mix the pieces slowly instead of making an extreme move.",
    reversed: "Temperance reversed points to imbalance, overreaction, or a situation that needs moderation.",
  },
  "15-devil": {
    keywords: ["attachment", "shadow", "pattern"],
    upright: "The Devil points to attachment and pattern; name what has power over you before it keeps steering you.",
    reversed: "The Devil reversed says awareness is starting; the pattern can loosen if you stop feeding it.",
  },
  "16-tower": {
    keywords: ["shock", "truth", "collapse"],
    upright: "The Tower says a false structure is breaking; deal with the truth instead of defending the old shape.",
    reversed: "The Tower reversed points to a collapse being delayed, minimized, or happening inside first.",
  },
  "17-star": {
    keywords: ["hope", "renewal", "faith"],
    upright: "The Star points to recovery and hope; choose the step that restores your energy instead of draining it.",
    reversed: "The Star reversed points to discouragement or losing sight of the help and hope still available.",
  },
  "18-moon": {
    keywords: ["uncertainty", "fear", "dream"],
    upright: "The Moon says the situation is unclear; do not make fear sound like evidence.",
    reversed: "The Moon reversed says confusion is lifting, but the truth may still need time to settle.",
  },
  "19-sun": {
    keywords: ["clarity", "warmth", "joy"],
    upright: "The Sun points to clarity, visibility, and a result that becomes easier to see.",
    reversed: "The Sun reversed points to delayed clarity, muted confidence, or joy blocked by doubt.",
  },
  "20-judgement": {
    keywords: ["calling", "reckoning", "awakening"],
    upright: "Judgement asks for a clear decision based on who you are becoming, not who you were.",
    reversed: "Judgement reversed points to self-criticism, avoidance, or refusing a necessary wake-up call.",
  },
  "21-world": {
    keywords: ["completion", "arrival", "wholeness"],
    upright: "The World points to completion and readiness; close the loop before starting the next one.",
    reversed: "The World reversed says something is nearly complete but still needs one final honest step.",
  },
};

const RANK_MEANINGS: Record<string, string> = {
  ace: "a new opening",
  two: "a choice or balancing point",
  three: "growth through others",
  four: "stability, pause, or protection",
  five: "friction that cannot be ignored",
  six: "movement toward repair, recognition, or progress",
  seven: "pressure that asks for persistence",
  eight: "movement, effort, or acceleration",
  nine: "a near-finish point with pressure attached",
  ten: "the end of a cycle and the cost of carrying too much",
  page: "learning, messages, and early signals",
  knight: "active pursuit and momentum",
  queen: "maturity, care, and inner authority",
  king: "leadership, control, and outer authority",
};

const SUIT_MEANINGS: Record<string, { keywords: string[]; field: string; advice: string }> = {
  wands: {
    keywords: ["action", "confidence", "visibility"],
    field: "action, ambition, confidence, and visibility",
    advice: "move in a way people can see; effort needs direction and proof",
  },
  cups: {
    keywords: ["emotion", "connection", "care"],
    field: "feelings, connection, care, and emotional truth",
    advice: "listen to the emotional reality without letting it replace the facts",
  },
  swords: {
    keywords: ["truth", "decision", "pressure"],
    field: "thoughts, decisions, conflict, and hard truth",
    advice: "separate facts from fear and say the thing clearly",
  },
  pentacles: {
    keywords: ["work", "money", "stability"],
    field: "work, money, body, timing, and practical stability",
    advice: "make the next step practical, measurable, and grounded",
  },
};

export function getCardSuit(cardId: string) {
  const suit = cardId.split("-").at(-1);
  return suit === "wands" || suit === "cups" || suit === "swords" || suit === "pentacles"
    ? suit
    : null;
}

function getCardRank(cardId: string) {
  const rank = cardId.split("-")[0] ?? "";
  return rank in RANK_MEANINGS ? rank : null;
}

export function getReadableCardMeaning(card: Pick<RitualCard, "cardId" | "name" | "orientation">) {
  const major = MAJOR_MEANINGS[card.cardId];
  if (major) {
    return {
      keywords: major.keywords,
      upright: major.upright,
      reversed: major.reversed,
      sentence: card.orientation === "reversed" ? major.reversed : major.upright,
    };
  }

  const suit = getCardSuit(card.cardId);
  const rank = getCardRank(card.cardId);
  const suitMeaning = suit ? SUIT_MEANINGS[suit] : null;
  const rankMeaning = rank ? RANK_MEANINGS[rank] : "a clear signal";
  const keywords = suitMeaning?.keywords ?? getCardKeywords(card.cardId);
  const upright = `${card.name} shows ${rankMeaning} in ${suitMeaning?.field ?? "this situation"}. In plain terms, ${suitMeaning?.advice ?? "choose the next honest step"}.`;
  const reversed = `${card.name} reversed shows ${rankMeaning} being blocked or mishandled. In plain terms, ${suitMeaning?.advice ?? "slow down and correct the next step"} before pushing harder.`;

  return {
    keywords,
    upright,
    reversed,
    sentence: card.orientation === "reversed" ? reversed : upright,
  };
}
