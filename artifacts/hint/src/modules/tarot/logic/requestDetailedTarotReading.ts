import { apiFetch, apiUrl } from "../../../lib/api";
import { parseStructuredTarotReading, type LocalStructuredTarotReading } from "../../readings/localTarotReadings";

export type DetailedTarotRequest = {
  question: string;
  spreadType: string;
  emotionalContext?: string | null;
  cards: Array<{ cardId: string; name: string; orientation: "upright" | "reversed"; position: string }>;
  originalReading: LocalStructuredTarotReading;
  additionalContext?: string;
};

export async function requestDetailedTarotReading(
  input: DetailedTarotRequest,
  { signal, timeoutMs = 15_000 }: { signal: AbortSignal; timeoutMs?: number },
): Promise<LocalStructuredTarotReading> {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: Error | null, reading?: LocalStructuredTarotReading) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      controller.abort();
      if (error) reject(error);
      else resolve(reading!);
    };
    const cancel = () => finish(new DOMException("Reading closed", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Detailed reading timed out")), timeoutMs);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) { cancel(); return; }
    void apiFetch(apiUrl("/api/tarot/structured-reading"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, depth: "detailed", requiredCardCount: input.cards.length }),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Detailed reading unavailable");
      const raw: unknown = await response.json();
      const reading = parseStructuredTarotReading(raw);
      if (!raw || typeof raw !== "object" || !("source" in raw) || raw.source !== "api" ||
          !reading || reading.cards.length !== input.cards.length || input.cards.some((card, index) => {
            const detail = reading.cards[index]!;
            return detail.card_name !== card.name || detail.position !== card.position || detail.orientation !== card.orientation;
          })) throw new Error("Detailed reading did not match the selected cards");
      finish(null, reading);
    }).catch((error: unknown) => finish(error instanceof Error ? error : new Error("Detailed reading unavailable")));
  });
}
