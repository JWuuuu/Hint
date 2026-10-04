import type { RitualCard } from "./createHiddenDeck";

export type WashPointer = {
  x: number;
  y: number;
  movementX: number;
  movementY: number;
  width: number;
  height: number;
  spinDirection: 1 | -1;
  forceScale?: number;
};

export type WashResult = {
  cards: RitualCard[];
  activeVisualIds: string[];
  movementScore: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampFieldX(value: number) {
  return clamp(value, 16, 84);
}

function clampFieldY(value: number) {
  return clamp(value, 17, 85);
}

function radialBasis(x: number, y: number, index: number) {
  const dx = x - 50;
  const dy = y - 52;
  const distance = Math.hypot(dx, dy);
  // The exact center has no angle. Give it a stable outward direction rather
  // than multiplying every force by a zero tangent and pinning that card.
  const angle = distance < 0.1 ? index * 2.399963229728653 : Math.atan2(dy, dx);
  return { x: Math.cos(angle), y: Math.sin(angle), distance };
}

function isBaseLayer(card: RitualCard, index: number) {
  return card.washLayer === "base" || (!card.washLayer && index % 2 === 0);
}

function getHome(card: RitualCard) {
  return {
    x: card.homeX ?? card.x,
    y: card.homeY ?? card.y,
  };
}

function isInnerWashLane(index: number) {
  return index % 10 === 0 || index % 17 === 6 || index % 23 === 4;
}

function isMiddleWashLane(index: number) {
  return index % 4 === 0 || index % 7 === 3 || index % 13 === 5;
}

function getWashRadius(index: number, baseLayer: boolean, laneShift = 0) {
  const lane = (((index * 7) % 19) + laneShift + 19) % 19;
  const innerLane = isInnerWashLane(index);
  const middleLane = isMiddleWashLane(index);
  const shared = innerLane
    ? 9 + (index % 6) * 1.1
    : middleLane
      ? 17 + (lane % 8) * 1.0
      : 26 + lane * 0.35;
  const layerDrift = innerLane
    ? Math.sin(index * 1.27 + laneShift * 0.42) * 1
    : middleLane
      ? Math.sin(index * 1.09 + laneShift * 0.36) * (baseLayer ? 1.3 : 1.6)
      : baseLayer
        ? Math.sin(index * 1.27 + laneShift * 0.42) * 1.8
        : Math.cos(index * 1.19 + laneShift * 0.38) * 2.1;
  return clamp(
    shared + layerDrift,
    innerLane ? 8 : middleLane ? 15 : 24,
    innerLane ? 17 : middleLane ? 25 : 33,
  );
}

function getRingPull(distance: number, desiredDistance: number, strength: number) {
  return clamp((desiredDistance - distance) * strength, -1.15, 1.15);
}

function projectWithForwardSpin(
  x: number,
  y: number,
  tangentX: number,
  tangentY: number,
  radialX: number,
  radialY: number,
) {
  const forwardTangent = Math.max(0, x * tangentX + y * tangentY);
  const radial = x * radialX + y * radialY;

  return {
    x: tangentX * forwardTangent + radialX * radial,
    y: tangentY * forwardTangent + radialY * radial,
  };
}

function rotateAroundWashCenter(x: number, y: number, turn: number) {
  const dx = x - 50;
  const dy = y - 52;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);

  return {
    x: 50 + dx * cos - dy * sin,
    y: 52 + dx * sin + dy * cos,
  };
}

function normalizeAngle(value: number) {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function keepForwardOrbit(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  spinDirection: 1 | -1,
  minTurn: number,
) {
  const clampedToX = clampFieldX(toX);
  const clampedToY = clampFieldY(toY);
  const fromDx = fromX - 50;
  const fromDy = fromY - 52;
  const toDx = clampedToX - 50;
  const toDy = clampedToY - 52;
  const fromDistance = Math.hypot(fromDx, fromDy);
  const toDistance = Math.hypot(toDx, toDy);

  if (fromDistance < 1.8 || toDistance < 1.8) {
    return {
      x: clampedToX,
      y: clampedToY,
    };
  }

  const fromAngle = Math.atan2(fromDy, fromDx);
  const toAngle = Math.atan2(toDy, toDx);
  const signedTurn = normalizeAngle(toAngle - fromAngle) * spinDirection;

  if (signedTurn >= minTurn) {
    return {
      x: clampedToX,
      y: clampedToY,
    };
  }

  const enforcedAngle = fromAngle + spinDirection * minTurn;

  return {
    x: clampFieldX(50 + Math.cos(enforcedAngle) * toDistance),
    y: clampFieldY(52 + Math.sin(enforcedAngle) * toDistance),
  };
}

function getOrbitPoint(
  card: RitualCard,
  index: number,
  baseLayer: boolean,
  orbitTurn = 0,
) {
  const home = getHome(card);
  const homeDx = home.x - 50;
  const homeDy = home.y - 52;
  const homeDistance = Math.hypot(homeDx, homeDy);
  const seedAngle = index * 2.399963229728653;
  const innerLane = isInnerWashLane(index);
  const angle = seedAngle + (homeDistance > 3 ? Math.atan2(homeDy, homeDx) * 0.18 : 0)
    + Math.sin(index * 1.37) * 0.24;
  const turnedAngle = angle + orbitTurn + Math.sin(index * 0.73) * 0.16;
  const laneShift = Math.sin(orbitTurn * 4.4 + index * 1.11 + card.rotate * 0.025 + card.x * 0.035 + card.y * 0.022) * 7.2;
  const radius = getWashRadius(index, baseLayer, laneShift) * (baseLayer ? 1.0 : 1.05);
  const xScale = innerLane
    ? 0.96 + Math.sin(index * 0.43) * 0.05
    : 1.04 + Math.sin(index * 0.43) * 0.06;
  const yScale = innerLane
    ? 0.9 + Math.cos(index * 0.51) * 0.05
    : 0.98 + Math.cos(index * 0.51) * 0.06;
  return {
    x: 50 + Math.cos(turnedAngle) * radius * xScale + Math.sin(seedAngle * 1.7) * 1.6,
    y: 52 + Math.sin(turnedAngle) * radius * yScale + Math.cos(seedAngle * 1.3) * 1.4,
  };
}

// Positions are table percentages. Contact acts locally; friction carries a
// card a short distance after the hand passes, without an autonomous orbit.
function coastCard(card: RitualCard): RitualCard {
  const friction = 0.83;
  const rest = (v: number) => Math.abs(v) < 0.002 ? 0 : v * friction;
  let velocityX = rest(card.velocityX ?? 0);
  let velocityY = rest(card.velocityY ?? 0);
  const velocityRotate = rest(card.velocityRotate ?? 0);
  const x = clampFieldX(card.x + velocityX);
  const y = clampFieldY(card.y + velocityY);
  if (x !== card.x + velocityX) velocityX *= -0.18;
  if (y !== card.y + velocityY) velocityY *= -0.18;
  const rotation = card.rotate + velocityRotate;
  return { ...card, x, y, rotate: rotation, rotation, velocityX, velocityY, velocityRotate };
}

export function applyWashForce(
  ritualCards: readonly RitualCard[],
  pointer: WashPointer,
): WashResult {
  const activeVisualIds: string[] = [];
  let movementScore = 0;
  const width = Math.max(1, pointer.width);
  const height = Math.max(1, pointer.height);
  const handTravel = Math.hypot(pointer.movementX, pointer.movementY);
  const speed = Math.min(22, handTravel);
  // Lighter contact for small hand movements. Auto Wash supplies its own force
  // envelope, while the existing speed cap and friction keep touch controlled.
  const strength = clamp(pointer.forceScale ?? 1.45, 0, 1.45);
  const contactRadius = Math.min(width, height) * 0.34;
  const hand = radialBasis(pointer.x / width * 100, pointer.y / height * 100, 0);
  const handRadial = (pointer.movementX * hand.x + pointer.movementY * hand.y) / Math.max(1, handTravel);
  const handTangent = Math.abs(-pointer.movementX * hand.y + pointer.movementY * hand.x) / Math.max(1, handTravel);
  const handX = hand.x * handRadial - hand.y * handTangent * pointer.spinDirection;
  const handY = hand.y * handRadial + hand.x * handTangent * pointer.spinDirection;
  const cards = ritualCards.map((card, index) => {
    const distance = Math.hypot(card.x / 100 * width - pointer.x, card.y / 100 * height - pointer.y);
    const contact = Math.exp(-2.5 * (distance / contactRadius) ** 2);
    const pressure = contact * speed / 18 * strength;
    const radial = radialBasis(card.x, card.y, index);
    const tangentX = -radial.y * pointer.spinDirection;
    const tangentY = radial.x * pointer.spinDirection;
    // Carry nearby cards with the hand, including inward strokes. A purely
    // table-centred tangent gradually evacuates the middle into a rigid ring.
    const sweep = projectWithForwardSpin(
      handX * 0.7 + tangentX * 0.3,
      handY * 0.7 + tangentY * 0.3,
      tangentX, tangentY, radial.x, radial.y,
    );
    const radialForce = radial.distance < 4 ? 0.12 : 0;
    const mobility = 0.64 + (index % 7) * 0.035;
    const velocityX = clamp((card.velocityX ?? 0) * 0.7 + (sweep.x * mobility + radial.x * radialForce) * pressure, -1.05, 1.05);
    const velocityY = clamp((card.velocityY ?? 0) * 0.7 + (sweep.y * mobility + radial.y * radialForce) * pressure, -1.05, 1.05);
    const velocityRotate = (card.velocityRotate ?? 0) * 0.65 + pointer.spinDirection * pressure * (0.42 + index % 9 * 0.065);
    const next = coastCard({ ...card, velocityX, velocityY, velocityRotate });
    const moved = Math.hypot(next.x - card.x, next.y - card.y);
    movementScore += moved;
    if (pressure > 0.025) activeVisualIds.push(card.visualId);
    return next;
  });
  return { cards, activeVisualIds, movementScore };
}

export function loosenDeckForWash(ritualCards: readonly RitualCard[]): RitualCard[] {
  return ritualCards.map((card, index) => {
    const angle = index * 2.399963229728653 + Math.sin(index * 1.31) * 0.15;
    const radius = Math.sqrt((index + 0.65) / Math.max(1, ritualCards.length));
    const x = clampFieldX(50 + Math.cos(angle) * radius * 33);
    const y = clampFieldY(52 + Math.sin(angle) * radius * 32);
    const rotation = Math.sin(index * 2.13 + 0.4) * 52 + Math.cos(index * 0.71) * 14;
    return { ...card, x, y, homeX: x, homeY: y, rotate: rotation, rotation,
      velocityX: 0, velocityY: 0, velocityRotate: 0, lift: 0, gatherDelay: 0,
      washLayer: index % 2 === 0 ? "base" : "top", zIndex: index };
  });
}

export function applyTableCurrent(
  ritualCards: readonly RitualCard[],
  _elapsed: number,
  _strength = 1,
  _spinDirection: 1 | -1 = 1,
): RitualCard[] {
  return ritualCards.map(coastCard);
}

export function applyAutoWashWave(
  ritualCards: readonly RitualCard[],
  elapsed: number,
  spinDirection: 1 | -1 = 1,
): RitualCard[] {
  // An unhurried virtual hand sweeps across the inner and outer cards. Use the
  // same contact physics as touch, with no lane reversal or angle clamping.
  const pointAt = (time: number) => {
    const angle = time / 1800 * Math.PI * 2 * spinDirection;
    const radius = 78 + Math.sin(time / 1150 * Math.PI * 2) * 29;
    return { x: 200 + Math.cos(angle) * radius, y: 208 + Math.sin(angle) * radius };
  };
  const point = pointAt(elapsed);
  const previous = pointAt(elapsed - 1000 / 60);
  return applyWashForce(ritualCards, {
    ...point, width: 400, height: 400, spinDirection,
    movementX: point.x - previous.x, movementY: point.y - previous.y,
    forceScale: Math.min(1, 0.3 + elapsed / 450),
  }).cards;
}

function nearestCardAngle(from: number, target: number) {
  return from + ((target - from + 180) % 360 + 360) % 360 - 180;
}

export function gatherDeckToCenter(ritualCards: readonly RitualCard[]): RitualCard[] {
  const distances = ritualCards.map((card) => Math.hypot(card.x - 50, card.y - 52));
  const maxDistance = Math.max(...distances, 1);

  return ritualCards.map((card, index) => {
    const distance = distances[index] ?? 0;
    const outsideFirstDelay = 1 - distance / maxDistance;
    const row = index % 13;
    const stack = Math.floor(index / 13);
    const rotation = nearestCardAngle(card.rotate, (row - 6) * 0.9 + Math.sin(index * 1.47) * 1.4);
    return {
      ...card,
      x: 50 + (row - 6) * 0.16 + Math.sin(index * 1.31) * 1.05,
      y: 52 - stack * 0.12 + Math.cos(index * 1.17) * 0.62,
      rotate: rotation,
      rotation,
      velocityX: 0,
      velocityY: 0,
      velocityRotate: 0,
      lift: 0,
      gatherDelay: outsideFirstDelay * 0.24 + (index % 6) * 0.014,
      zIndex: index,
    };
  });
}

export function squareDeckAtCenter(ritualCards: readonly RitualCard[]): RitualCard[] {
  return ritualCards.map((card, index) => {
    const depth = ritualCards.length - 1 - index;
    const rotation = nearestCardAngle(card.rotate, 0);
    return {
      ...card,
      x: 50 + Math.min(depth, 8) * 0.035,
      y: 52 + Math.min(depth, 8) * 0.055,
      rotate: rotation,
      rotation,
      velocityX: 0,
      velocityY: 0,
      velocityRotate: 0,
      lift: 0,
      gatherDelay: (index % 7) * 0.012,
      zIndex: index,
    };
  });
}

export function cutDeckIntoPackets(
  ritualCards: readonly RitualCard[],
  direction: 1 | -1 = 1,
  pass = 0,
): RitualCard[] {
  const cutRatio = pass % 2 === 0 ? 0.42 : 0.58;
  const cutIndex = Math.floor(ritualCards.length * cutRatio);

  return ritualCards.map((card, index) => {
    const isLiftedPacket = index < cutIndex;
    const packet = isLiftedPacket ? 0 : 1;
    const packetStart = packet === 0 ? 0 : cutIndex;
    const packetIndex = index - packetStart;
    const packetSize = packet === 0 ? cutIndex : ritualCards.length - cutIndex;
    const packetDepth = packetSize <= 1 ? 0 : packetIndex / (packetSize - 1);
    const packetSide = isLiftedPacket ? direction : -direction;
    const edge = packetIndex % 9;
    const passLift = pass % 2 === 0 ? 1 : -1;
    const thickness = packetDepth * (isLiftedPacket ? 3.4 : 2.8);
    const packetBaseX =
      50 + packetSide * (isLiftedPacket ? 14.2 : 6.1) + passLift * 1.05;
    const packetBaseY =
      52 + (isLiftedPacket ? -6.2 : 3.8) + pass * 0.42;
    const rotation =
      packetSide * (isLiftedPacket ? 2.1 : 0.62) +
      passLift * (isLiftedPacket ? 0.26 : -0.12) +
      (edge - 4) * 0.018;

    return {
      ...card,
      x: packetBaseX + packetSide * packetDepth * 1.75 + (edge - 4) * 0.026,
      y: packetBaseY + thickness + Math.sin(packetIndex * 0.64) * 0.08,
      rotate: rotation,
      rotation,
      velocityX: 0,
      velocityY: 0,
      velocityRotate: 0,
      lift: isLiftedPacket ? 1 : 0,
      gatherDelay: packetIndex * 0.0018 + packet * 0.034 + pass * 0.026,
      zIndex: isLiftedPacket ? 420 + pass * 90 + (packetSize - packetIndex) : 90 + (packetSize - packetIndex),
    };
  });
}

export function transferCutPacket(
  ritualCards: readonly RitualCard[],
  direction: 1 | -1 = 1,
  pass = 0,
): RitualCard[] {
  const cutRatio = pass % 2 === 0 ? 0.42 : 0.58;
  const cutIndex = Math.floor(ritualCards.length * cutRatio);

  return ritualCards.map((card, index) => {
    const lifted = index < cutIndex;
    const packet = lifted ? 0 : 1;
    const packetStart = packet === 0 ? 0 : cutIndex;
    const packetIndex = index - packetStart;
    const packetSize = lifted ? cutIndex : ritualCards.length - cutIndex;
    const edge = packetIndex % 9;
    const depth = packetSize <= 1 ? 0 : packetIndex / (packetSize - 1);
    const passLift = pass % 2 === 0 ? 1 : -1;
    const liftedSlide = -direction * (7.8 + depth * 1.2) + passLift * 0.68;
    const lowerSlide = direction * (5.2 + depth * 0.7) - passLift * 0.32;
    const rotation =
      (lifted ? -direction * 0.86 : direction * 0.48) +
      passLift * (lifted ? -0.18 : 0.12) +
      (edge - 4) * 0.014;

    return {
      ...card,
      x: 50 + (lifted ? liftedSlide : lowerSlide) + (edge - 4) * 0.018,
      y: 52 + (lifted ? 2.2 : -2.2) + depth * (lifted ? 3.2 : 2.8) + pass * 0.34,
      rotate: rotation,
      rotation,
      velocityX: 0,
      velocityY: 0,
      velocityRotate: 0,
      lift: lifted ? 0.1 : 0.72,
      gatherDelay: packetIndex * 0.002 + (lifted ? 0.018 : 0.004) + pass * 0.02,
      zIndex: lifted ? 150 + (packetSize - packetIndex) : 520 + pass * 90 + (packetSize - packetIndex),
    };
  });
}

export function mergeCutDeckAtCenter(ritualCards: readonly RitualCard[]): RitualCard[] {
  return ritualCards.map((card, index) => {
    const rotation = (index % 7 - 3) * 0.07;
    const depth = index / Math.max(1, ritualCards.length - 1);

    return {
      ...card,
      x: 50 + (index % 8 - 3.5) * 0.018,
      y: 52 - depth * 1.45,
      rotate: rotation,
      rotation,
      velocityX: 0,
      velocityY: 0,
      velocityRotate: 0,
      lift: 0,
      gatherDelay: (index % 6) * 0.008,
      zIndex: index,
    };
  });
}

export function settleWashedDeck(
  ritualCards: readonly RitualCard[],
  spinDirection: 1 | -1 = 1,
): RitualCard[] {
  return ritualCards.map((card, index) => {
    const baseLayer = isBaseLayer(card, index);
    const home = getHome(card);
    const orbitPoint = getOrbitPoint(card, index, baseLayer);
    const dx = card.x - 50;
    const dy = card.y - 52;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const radialX = dx / distance;
    const radialY = dy / distance;
    const tangentX = -radialY * spinDirection;
    const tangentY = radialX * spinDirection;
    const laneShift = Math.sin(index * 1.21 + card.rotate * 0.025 + card.x * 0.04 + card.y * 0.025) * 5.2;
    const desiredDistance = getWashRadius(index, baseLayer, laneShift);
    const centerPush = Math.max(0, desiredDistance * 0.70 - distance) * (baseLayer ? 0.007 : 0.010);
    const ringPull = getRingPull(distance, desiredDistance, baseLayer ? 0.010 : 0.008) + centerPush;
    const velocity = projectWithForwardSpin(
      (card.velocityX ?? 0) * (baseLayer ? 0.64 : 0.62),
      (card.velocityY ?? 0) * (baseLayer ? 0.64 : 0.62),
      tangentX,
      tangentY,
      radialX,
      radialY,
    );
    const velocityRotate = (card.velocityRotate ?? 0) * (baseLayer ? 0.58 : 0.54);
    const rotation = clamp(card.rotate + velocityRotate, -58, 58);
    const move = projectWithForwardSpin(
      velocity.x +
        radialX * ringPull * 0.22 +
        (orbitPoint.x - card.x) * (baseLayer ? 0.0022 : 0.0028) +
        (home.x - card.x) * (baseLayer ? 0.00025 : 0.00018),
      velocity.y +
        radialY * ringPull * 0.22 +
        (orbitPoint.y - card.y) * (baseLayer ? 0.0022 : 0.0028) +
        (home.y - card.y) * (baseLayer ? 0.00025 : 0.00018),
      tangentX,
      tangentY,
      radialX,
      radialY,
    );
    const nextPoint = rotateAroundWashCenter(
      card.x + move.x,
      card.y + move.y,
      spinDirection * 0.0075,
    );
    const finalPoint = keepForwardOrbit(
      card.x,
      card.y,
      nextPoint.x,
      nextPoint.y,
      spinDirection,
      0.0036,
    );

    return {
      ...card,
      x: finalPoint.x,
      y: finalPoint.y,
      rotate: rotation,
      rotation,
      velocityX: velocity.x,
      velocityY: velocity.y,
      velocityRotate,
      lift: (card.lift ?? 0) * 0.52,
    };
  });
}
