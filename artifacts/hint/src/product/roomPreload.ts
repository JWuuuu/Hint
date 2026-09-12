/** Warm only code, never mount a room or start its data/provider requests. */
type TarotModule = typeof import("../modules/tarot");
type AstrologyModule = typeof import("../modules/features/AstrologyView");
let tarot: TarotModule | undefined;
let astrology: AstrologyModule | undefined;
let tarotPending: Promise<TarotModule> | undefined;
let astrologyPending: Promise<AstrologyModule> | undefined;
export const getPreloadedTarotRoom = () => tarot;
export const getPreloadedAstrologyRoom = () => astrology;
export function loadTarotRoom() {
  return tarotPending ??= import("../modules/tarot").then(module => {
    tarot = module;
    return module;
  }).catch(error => { tarotPending = undefined; throw error; });
}
export function loadAstrologyRoom() {
  return astrologyPending ??= import("../modules/features/AstrologyView").then(module => {
    astrology = module;
    return module;
  }).catch(error => { astrologyPending = undefined; throw error; });
}

export function preloadRoom(path: string) {
  const room = path.split(/[?#]/, 1)[0];
  const load = room === "/app/tarot" ? loadTarotRoom : room === "/app/astrology" ? loadAstrologyRoom : null;
  if (load) void load().catch(() => { /* The existing route boundary owns errors and retry. */ });
}
