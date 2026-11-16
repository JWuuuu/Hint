import { useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogPortal,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";
import type { NatalChart, PlanetPlacement } from "@/types/astrology";
import { astroText, at, type AstroCopy } from "../astrologyCopy";
import { SIGN_ORDER, signName } from "../astrologyLibrary";
import { CHART_POINT_SYMBOLS, chartPointName, longitude, usesQuadrantHouses, ZodiacSymbol } from "./NatalWheel";

const copy = {
  title: ["Chart details", "星盘参数", "Detalles de la carta", "チャートの詳細", "차트 세부 정보"],
  back: ["Back to My Chart", "返回我的星盘", "Volver a mi carta", "私のチャートに戻る", "내 차트로 돌아가기"],
  sections: ["Chart information", "星盘资料", "Información de la carta", "チャート情報", "차트 정보"],
  planets: ["Planets & angles", "行星与四轴", "Planetas y ángulos", "天体とアングル", "행성과 앵글"],
  points: ["Asteroids & points", "小行星与配置点", "Asteroides y puntos", "小惑星と感受点", "소행성과 주요 지점"],
  body: ["Body", "星体", "Cuerpo", "天体", "천체"],
  placement: ["Your placement", "你的落点", "Tu posición", "あなたの配置", "나의 배치"],
  rising: ["Ascendant", "上升点", "Ascendente", "アセンダント", "상승점"],
  descendant: ["Descendant", "下降点", "Descendente", "ディセンダント", "하강점"],
  imum_coeli: ["Imum Coeli", "天底", "Fondo del cielo", "天底", "천저점"],
  midheaven: ["Midheaven", "天顶", "Medio cielo", "天頂", "중천점"],
  chiron: ["Chiron", "凯龙星", "Quirón", "キロン", "키론"],
  ceres: ["Ceres", "谷神星", "Ceres", "セレス", "세레스"],
  pallas: ["Pallas", "智神星", "Palas", "パラス", "팔라스"],
  vesta: ["Vesta", "灶神星", "Vesta", "ベスタ", "베스타"],
  south_node: ["South Node", "南交点", "Nodo sur", "サウスノード", "남쪽 노드"],
  lilith: ["Lilith", "莉莉丝", "Lilith", "リリス", "릴리스"],
  fortune: ["Part of Fortune", "福点", "Parte de la fortuna", "幸運点", "행운점"],
  vertex: ["Vertex", "宿命点", "Vértice", "バーテックス", "버텍스"],
  east_point: ["East Point", "东方点", "Punto este", "東方点", "동쪽 지점"],
} as const;

const planetRows = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
  "rising", "descendant", "imum_coeli", "midheaven",
] as const;
const pointRows = [
  "chiron", "ceres", "pallas", "juno", "vesta", "north_node", "south_node", "lilith", "fortune", "vertex", "east_point",
] as const;
type TableBody = (typeof planetRows)[number] | (typeof pointRows)[number];
type Position = Pick<PlanetPlacement, "sign" | "degree" | "house" | "retrograde">;

const labels: Partial<Record<TableBody, AstroCopy>> = {
  rising: copy.rising, descendant: copy.descendant, imum_coeli: copy.imum_coeli, midheaven: copy.midheaven,
  chiron: copy.chiron, ceres: copy.ceres, pallas: copy.pallas, vesta: copy.vesta, south_node: copy.south_node,
  lilith: copy.lilith, fortune: copy.fortune, vertex: copy.vertex, east_point: copy.east_point,
};
const glyphs: Record<string, string> = {
  ...CHART_POINT_SYMBOLS,
  rising: "ASC", descendant: "DSC", imum_coeli: "IC", midheaven: "MC",
  chiron: "⚷", ceres: "⚳", pallas: "⚴", vesta: "⚶", south_node: "☋", lilith: "⚸",
  fortune: "⊗", vertex: "Vx", east_point: "EP",
};

function opposite(position: Position | undefined, house?: number): Position | undefined {
  const degrees = longitude(position?.sign, position?.degree);
  if (degrees === null) return undefined;
  return { sign: SIGN_ORDER[(Math.floor(degrees / 30) + 6) % 12], degree: position?.degree, house };
}

function chartRows(chart: NatalChart) {
  const placements = new Map<string, Position>();
  for (const item of [...(chart.additionalPlacements ?? []), ...chart.placements]) placements.set(item.body, item);
  const rising = placements.get("rising");
  const quadrant = usesQuadrantHouses(chart);
  const mc = placements.get("midheaven") ?? opposite(placements.get("imum_coeli"))
    ?? (quadrant ? chart.houses.find(house => house.house === 10) : undefined);
  if (rising?.sign) placements.set("rising", { ...rising, house: rising.house ?? 1 });
  if (mc) placements.set("midheaven", { ...mc, house: mc.house ?? (quadrant ? 10 : undefined) });
  const descendant = placements.get("descendant") ?? opposite(rising, 7);
  const ic = placements.get("imum_coeli") ?? opposite(mc, quadrant ? 4 : undefined);
  if (descendant) placements.set("descendant", { ...descendant, house: descendant.house ?? 7 });
  if (ic) placements.set("imum_coeli", { ...ic, house: ic.house ?? (quadrant ? 4 : undefined) });
  return placements;
}

function degreeLabel(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || value < 0 || value >= 30) return null;
  const minutes = Math.min(1799, Math.round(value * 60));
  return `${Math.floor(minutes / 60)}°${String(minutes % 60).padStart(2, "0")}′`;
}

export function NatalChartDetails({ chart }: { chart: NatalChart }) {
  const { language } = useLanguage();
  const [group, setGroup] = useState<"planets" | "points">("planets");
  const scroll = useRef<HTMLDivElement>(null);
  const tableId = useId();
  const rows = chartRows(chart);
  const missing = at(language, "unavailable");
  const retrograde = at(language, "retrograde");

  return (
    <Dialog onOpenChange={open => { if (open) setGroup("planets"); }}>
      <DialogTrigger type="button" className="astro-natal-details-trigger">
        {astroText(language, copy.title)}
        <ChevronRight size={13} aria-hidden="true" />
      </DialogTrigger>
      <DialogPortal>
        <DialogSurface
          className="astro-theme astro-chart-details"
          aria-describedby={undefined}
          ref={scroll}
        >
          <div className="astro-chart-details-inner">
            <header className="astro-chart-details-header">
              <DialogClose type="button" aria-label={astroText(language, copy.back)}>
                <ChevronLeft size={18} aria-hidden="true" />
              </DialogClose>
              <DialogTitle>{astroText(language, copy.title)}</DialogTitle>
            </header>
            <nav className="astro-chart-details-tabs" aria-label={astroText(language, copy.sections)}>
              {(["planets", "points"] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={group === value}
                  aria-controls={tableId}
                  onClick={() => {
                    setGroup(value);
                    if (scroll.current) scroll.current.scrollTop = 0;
                  }}
                >
                  {astroText(language, copy[value])}
                </button>
              ))}
            </nav>
            <table id={tableId} aria-label={astroText(language, copy[group])}>
              <thead>
                <tr>
                  <th scope="col">{astroText(language, copy.body)}</th>
                  <th scope="col">{astroText(language, copy.placement)}</th>
                  <th scope="col">{at(language, "house")}</th>
                  <th scope="col"><abbr title={retrograde}>Rx</abbr></th>
                </tr>
              </thead>
              <tbody>
                {(group === "planets" ? planetRows : pointRows).map(body => {
                  const placement = rows.get(body);
                  const value = degreeLabel(placement?.degree);
                  const sign = placement?.sign;
                  const name = labels[body];
                  return (
                    <tr key={body}>
                      <th scope="row">
                        <span className="astro-chart-details-body">
                          <span className="astro-chart-details-glyph" data-short={glyphs[body].length > 1} aria-hidden="true">{glyphs[body]}</span>
                          <span>{name ? astroText(language, name) : chartPointName(body, language)}</span>
                        </span>
                      </th>
                      <td>
                        {sign ? (
                          <span className="astro-chart-details-sign">
                            <ZodiacSymbol index={SIGN_ORDER.indexOf(sign)} />
                            <span>{signName(sign, language)}{value && <small>{value}</small>}</span>
                          </span>
                        ) : <span className="astro-chart-details-unavailable" aria-label={missing}>—</span>}
                      </td>
                      <td>{placement?.house ?? <span className="astro-chart-details-unavailable" aria-label={missing}>—</span>}</td>
                      <td>{placement?.retrograde
                        ? <abbr title={retrograde}>Rx</abbr>
                        : <span className="astro-chart-details-unavailable" aria-label={placement?.retrograde === false ? undefined : missing}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogSurface>
      </DialogPortal>
    </Dialog>
  );
}
