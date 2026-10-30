import { PRACTICE_SKY, type SkyStar } from "../utils";

/**
 * The person's own constellation: one star per kept reading, joined in the
 * order they happened, the newest lit in candle gold. Purely decorative; the
 * practice ledger below states the same facts in words. Before the first
 * reading it is a single unlit seed beside its caption.
 */
export function PracticeSky({ stars }: { stars: SkyStar[] }) {
  const { width, height } = PRACTICE_SKY;
  if (!stars.length) {
    return <svg className="me-sky-art" data-empty="true" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle className="me-sky-seed" cx={20} cy={20} r={13} />
      <circle className="me-sky-star" cx={20} cy={20} r={1.8} />
    </svg>;
  }
  return <svg className="me-sky-art" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
    {stars.length > 1 && <polyline className="me-sky-line" points={stars.map(star => `${star.x.toFixed(1)},${star.y.toFixed(1)}`).join(" ")} />}
    {stars.map(star => star.latest
      ? <g key={star.id} className="me-sky-latest">
        <circle className="me-sky-halo" cx={star.x} cy={star.y} r={10} />
        <circle className="me-sky-star" cx={star.x} cy={star.y} r={3.2} />
      </g>
      : <circle key={star.id} className="me-sky-star" cx={star.x} cy={star.y} r={1.9} />)}
  </svg>;
}
