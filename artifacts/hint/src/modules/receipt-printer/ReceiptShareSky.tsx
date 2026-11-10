import { useId, type CSSProperties } from "react";
import { useMotionPolicy } from "../../lib/motionPolicy";

const constellations = [
  [[357, 64], [319, 97], [357, 136]],
  [[77, 162], [39, 235], [27, 260], [59, 248], [96, 226], [77, 162]],
  [[18, 414], [39, 453], [91, 500], [55, 515], [39, 453]],
  [[384, 377], [410, 401], [383, 447]],
  [[22, 702], [54, 682], [83, 767], [63, 804]],
  [[388, 574], [404, 609], [371, 647]],
  [[21, 857], [60, 887], [109, 914], [116, 936], [166, 912]],
  [[435, 813], [393, 823], [337, 887], [288, 941]],
  [[337, 887], [395, 918]],
];
const stars = [
  [357, 136, 7, 6.8, -2.1], [27, 260, 4, 5.9, -4.4],
  [39, 453, 11, 7.2, -1.2], [381, 339, 7, 5.8, -3.7],
  [83, 609, 6, 6.4, -5.1], [388, 574, 5, 8.1, -2.8],
  [393, 823, 17, 7.6, -4.6], [60, 887, 15, 6.9, -.8],
  [337, 887, 6, 5.7, -3.4], [288, 941, 4, 8.3, -6.1],
];

/** A quiet, fixed night sky: only the star light changes, never the layout. */
export function ReceiptShareSky() {
  const { reduced, pageVisible } = useMotionPolicy();
  const id = `receipt-sky-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return <div className="receipt-share-sky" aria-hidden="true" data-reduced={reduced} data-paused={!pageVisible}>
    <svg viewBox="0 0 440 956" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <radialGradient id={`${id}-glow`}><stop stopColor="#efc697" stopOpacity=".35" /><stop offset=".3" stopColor="#c28e78" stopOpacity=".12" /><stop offset="1" stopColor="#ad708a" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f2d3ad" /><stop offset=".5" stopColor="#c79a83" /><stop offset="1" stopColor="#927078" /></linearGradient>
      </defs>
      <g className="receipt-share-sky__constellations">
        {constellations.map((points, index) => <g key={index}>
          <polyline points={points.map(point => point.join(",")).join(" ")} />
          {points.map(([x, y], point) => <circle key={point} cx={x} cy={y} r={point % 2 ? 1.55 : 1.15} />)}
        </g>)}
      </g>
      <g fill="#c6a09c">
        {Array.from({ length: 70 }, (_, i) => <circle key={i} cx={12 + ((i * 97 + 23) % 416)} cy={45 + ((i * 173 + 31) % 891)} r={i % 5 === 0 ? .7 : .4} opacity={.12 + (i % 4) * .065} />)}
      </g>
      <path className="receipt-share-sky__moon" d="M 391 204 C 419 220 405 251 378 244 C 400 243 405 219 391 204 Z" fill={`url(#${id}-gold)`} />
      {stars.map(([x, y, size, duration, delay], index) => <g key={index} transform={`translate(${x} ${y})`}>
        <g className="receipt-share-sky__star" style={{ "--star-duration": `${duration}s`, "--star-delay": `${delay}s` } as CSSProperties}>
          <circle r={size * 2.8} fill={`url(#${id}-glow)`} />
          <path d={`M0 ${-size} L${size * .12} ${-size * .13} L${size} 0 L${size * .12} ${size * .13} L0 ${size} L${-size * .12} ${size * .13} L${-size} 0 L${-size * .12} ${-size * .13} Z`} fill={`url(#${id}-gold)`} />
          <path d={`M${-size * .48} ${-size * .48} L0 ${-size * .12} L${size * .48} ${-size * .48} L${size * .12} 0 L${size * .48} ${size * .48} L0 ${size * .12} L${-size * .48} ${size * .48} L${-size * .12} 0 Z`} fill="#d0a589" opacity=".72" />
          <circle r={size > 10 ? 1.15 : .7} fill="#ffe7c5" />
        </g>
      </g>)}
    </svg>
  </div>;
}
