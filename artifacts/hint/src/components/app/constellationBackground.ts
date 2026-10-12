/* Fixed zodiac lines with subtly graded white-gold cores and eight tapered rays. */
type Point = [number, number];
type Placement = [number, number, number, number];
type Color = [number, number, number];

interface ConstellationSign {
  name: string;
  points: Point[];
  edges: [number, number][];
  major: number[];
}

interface StarSlot {
  id: number;
  start: number;
  rise: number;
  hold: number;
  fall: number;
  end: number;
  next: number;
  peak: number;
}

interface StarTimeline {
  random: () => number;
  slots: StarSlot[];
  recent: number[];
  time: number;
}

interface StarNode {
  x: number;
  y: number;
  radius: number;
}

export interface ConstellationConfig {
  strength?: number;
  motion?: number;
  glow?: number;
}

export interface ConstellationRenderer {
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, config?: ConstellationConfig): void;
}

export function createConstellationRenderer(): ConstellationRenderer {

  // Hand-drawn point and edge topology follows the user's twelve-sign reference.
  // Coordinates preserve the silhouette of each constellation; labels are omitted.
  const signs: ConstellationSign[] = [
    {
      name: "Capricorn",
      points: [[46, 5], [48, 18], [31, 57], [22, 68], [12, 78], [12, 87], [25, 83], [41, 81], [57, 73], [72, 69], [74, 59]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 1]],
      major: [1, 3, 7, 9]
    },
    {
      name: "Aquarius",
      points: [[82, 6], [53, 29], [26, 51], [48, 63], [69, 60], [26, 67], [18, 68], [17, 78], [39, 99], [44, 80], [60, 77], [69, 82], [80, 92]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12]],
      major: [1, 2, 3, 8, 11]
    },
    {
      name: "Pisces",
      points: [[48, 4], [57, 1], [66, 5], [69, 16], [65, 24], [53, 23], [47, 15], [57, 36], [69, 62], [73, 71], [88, 89], [100, 100], [79, 95], [59, 94], [31, 96], [23, 106], [13, 99]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [5, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16]],
      major: [2, 5, 8, 11, 13, 15]
    },
    {
      name: "Aries",
      points: [[10, 17], [59, 37], [79, 54], [84, 71]],
      edges: [[0, 1], [1, 2], [2, 3]],
      major: [1, 2]
    },
    {
      name: "Taurus",
      points: [[18, 5], [34, 30], [40, 48], [43, 63], [30, 57], [81, 92], [86, 101]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [5, 6]],
      major: [1, 3, 5]
    },
    {
      name: "Gemini",
      points: [[24, 11], [38, 16], [16, 29], [20, 39], [31, 46], [46, 52], [72, 64], [78, 50], [82, 39], [67, 32], [92, 35], [69, 79]],
      edges: [[0, 1], [1, 9], [9, 8], [8, 10], [0, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [6, 11]],
      major: [0, 2, 4, 8]
    },
    {
      name: "Cancer",
      points: [[17, 7], [38, 34], [46, 47], [41, 86], [90, 67]],
      edges: [[0, 1], [1, 2], [2, 3], [2, 4]],
      major: [1, 2, 4]
    },
    {
      name: "Leo",
      points: [[78, 8], [67, 9], [65, 31], [76, 41], [90, 40], [103, 49], [42, 71], [42, 101], [57, 85]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [3, 6], [6, 7], [7, 8], [8, 5]],
      major: [1, 3, 5, 6]
    },
    {
      name: "Virgo",
      points: [[70, 8], [69, 27], [63, 39], [48, 44], [20, 37], [46, 69], [66, 61], [78, 77], [63, 96], [51, 98], [41, 109], [28, 80], [13, 101]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [2, 6], [6, 7], [5, 7], [7, 8], [8, 9], [9, 10], [5, 11], [11, 12]],
      major: [0, 3, 7, 11]
    },
    {
      name: "Libra",
      points: [[43, 14], [32, 38], [22, 43], [10, 48], [75, 33], [72, 69], [46, 79], [46, 91]],
      edges: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [6, 7], [0, 5]],
      major: [0, 3, 5, 7]
    },
    {
      name: "Scorpio",
      points: [[83, 9], [85, 22], [84, 36], [84, 49], [65, 33], [56, 40], [42, 59], [41, 76], [27, 94], [10, 94], [-3, 86], [1, 74], [15, 61]],
      edges: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12]],
      major: [1, 4, 6, 9, 11]
    },
    {
      name: "Sagittarius",
      points: [[19, 12], [35, 21], [46, 25], [54, 16], [52, 40], [63, 42], [49, 54], [42, 46], [17, 40], [2, 60], [17, 83], [27, 102], [44, 104], [41, 93], [80, 15], [72, 37], [79, 52], [92, 55], [109, 41], [77, 67], [82, 75]],
      edges: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [11, 13], [5, 15], [14, 15], [15, 16], [16, 17], [17, 18], [16, 19], [19, 20]],
      major: [0, 2, 9, 11, 14, 16, 18]
    }
  ];

  const lavender: Color = [151, 129, 164];
  const warmGold: Color = [182, 151, 112];
  // Stable, art-directed positions remain fixed while only the star light changes.
  const placements: Placement[] = [
    [.18, .14, .82, -8], [.72, .19, 1.02, 5],
    [.40, .305, .96, -4], [.82, .365, .88, 7],
    [.15, .405, .91, -5], [.64, .495, 1.06, -7],
    [.27, .56, .82, 6], [.85, .635, .91, -5],
    [.43, .705, 1.03, 3], [.16, .825, .86, -7],
    [.76, .845, 1.02, 4], [.49, .91, .72, -5]
  ];
  const clamp = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value as number)) : fallback;
  const rgba = (rgb: Color, opacity: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`;
  const offsets: number[] = [];
  let starCount = 0;
  signs.forEach(sign => {
    offsets.push(starCount);
    starCount += sign.points.length;
  });
  const allStars = Array.from({ length: starCount }, (_, index) => index);
  let timeline: StarTimeline | undefined;
  const smooth = (value: number) => {
    const x = Math.min(1, Math.max(0, value));
    return x * x * (3 - 2 * x);
  };

  function randomFor(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function scheduleStar(slotIndex: number, start: number): void {
    const current = timeline!;
    const random = current.random;
    const occupied = new Set(current.slots.map(star => star.id));
    const recent = new Set(current.recent);
    const candidates = allStars.filter(id => !occupied.has(id) && !recent.has(id));
    const id = candidates[Math.floor(random() * candidates.length)];
    const rise = .55 + random() * .65;
    const hold = .12 + random() * .58;
    const fall = .70 + random() * 1.05;
    const end = start + rise + hold + fall;
    current.slots[slotIndex] = {
      id, start, rise, hold, fall, end,
      next: end + .10 + random() * .20,
      peak: .72 + random() * .28
    };
    current.recent.push(id);
    if (current.recent.length > 20) current.recent.shift();
  }

  function starsAt(time: number): Map<number, number> {
    if (!timeline || time < timeline.time) {
      timeline = { random: randomFor(0xA57A10), slots: [], recent: [], time: -Infinity };
      for (let index = 0; index < 8; index++) {
        // Different initial phases also prevent a synchronized first flash.
        scheduleStar(index, -1.25 + timeline.random() * 3.4);
      }
    }
    const current = timeline;
    // Process replacement events in time order, independent of the frame rate.
    while (true) {
      let earliest = 0;
      current.slots.forEach((star, index) => {
        if (star.next < current.slots[earliest].next) earliest = index;
      });
      if (current.slots[earliest].next > time) break;
      scheduleStar(earliest, current.slots[earliest].next);
    }
    current.time = time;
    const lights = new Map<number, number>();
    current.slots.forEach(star => {
      const age = time - star.start;
      if (age <= 0 || time >= star.end) return;
      const rise = smooth(age / star.rise);
      const fall = 1 - smooth((age - star.rise - star.hold) / star.fall);
      lights.set(star.id, rise * fall * star.peak);
    });
    return lights;
  }

  return {
    draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, config?: ConstellationConfig): void {
      if (!ctx || !(w > 0 && h > 0)) return;
      const opts = config || {};
      const strength = clamp(opts.strength, 0.65);
      const motion = clamp(opts.motion, 0.65);
      const glow = clamp(opts.glow, 0.95);
      if (strength === 0) return;
      const time = (Number.isFinite(t) ? Math.max(0, t) : 0) * (.65 + motion * .70) * .8;
      const lights = starsAt(time);
      const unit = Math.min(w / 402, h / 874);
      const nodes: StarNode[] = [];

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      signs.forEach((sign, index) => {
        const placement = placements[index];
        const xs = sign.points.map(p => p[0]);
        const ys = sign.points.map(p => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const fit = Math.min(w * .30 * placement[2] / Math.max(1, maxX - minX), h * .12 * placement[2] / Math.max(1, maxY - minY), 1.15 * unit * placement[2]);
        const cx = w * placement[0];
        const cy = h * placement[1];
        const middleX = (minX + maxX) / 2;
        const middleY = (minY + maxY) / 2;
        const rotation = placement[3] * Math.PI / 180;
        const cos = Math.cos(rotation), sin = Math.sin(rotation);
        const mapped: Point[] = sign.points.map(p => {
          const x = (p[0] - middleX) * fit, y = (p[1] - middleY) * fit;
          return [cx + x * cos - y * sin, cy + x * sin + y * cos];
        });
        const color = index % 3 === 1 ? warmGold : lavender;

        ctx.strokeStyle = rgba(color, 0.18 * strength);
        ctx.lineWidth = Math.max(0.45, 0.76 * unit);
        ctx.beginPath();
        sign.edges.forEach(([a, b]) => {
          ctx.moveTo(mapped[a][0], mapped[a][1]);
          ctx.lineTo(mapped[b][0], mapped[b][1]);
        });
        ctx.stroke();

        mapped.forEach(([x, y], pointIndex) => {
          const prominent = sign.major.includes(pointIndex);
          const radius = Math.max(.55, (prominent ? 1.85 : 1.12) * unit);
          nodes[offsets[index] + pointIndex] = { x, y, radius };
          ctx.fillStyle = rgba(color, (prominent ? .20 : .16) * strength);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // Each active point becomes a solid light-gold star with eight rays.
      lights.forEach((light, id) => {
        const { x, y } = nodes[id];
        const rayAlpha = .88 * glow * Math.pow(light, 1.05);
        const coreAlpha = (.85 + .15 * glow) * Math.pow(light, .65);
        const vertical = (16 + id % 3) * unit;
        const horizontal = (13 + id % 2) * unit;
        const diagonal = (11 + id % 2) * unit;

        function ray(dx: number, dy: number, length: number, halfWidth: number, alpha: number, hot: boolean): void {
          const px = -dy, py = dx;
          const tipX = x + dx * length, tipY = y + dy * length;
          const beam = ctx.createLinearGradient(x, y, tipX, tipY);
          beam.addColorStop(0, rgba(hot ? [250, 239, 195] : [244, 224, 166], alpha));
          beam.addColorStop(.35, rgba(hot ? [251, 241, 201] : [247, 228, 173], alpha * .9));
          beam.addColorStop(.75, rgba(hot ? [252, 243, 210] : [250, 234, 185], alpha * .28));
          beam.addColorStop(1, rgba(hot ? [253, 245, 217] : [252, 238, 195], 0));
          ctx.fillStyle = beam;
          ctx.beginPath();
          ctx.moveTo(x + px * halfWidth, y + py * halfWidth);
          ctx.quadraticCurveTo(x + dx * length * .30 + px * halfWidth * .40, y + dy * length * .30 + py * halfWidth * .40, tipX, tipY);
          ctx.quadraticCurveTo(x + dx * length * .30 - px * halfWidth * .40, y + dy * length * .30 - py * halfWidth * .40, x - px * halfWidth, y - py * halfWidth);
          ctx.closePath();
          ctx.fill();
        }

        const d = Math.SQRT1_2;
        [[0, -1, vertical], [d, -d, diagonal], [1, 0, horizontal], [d, d, diagonal], [0, 1, vertical], [-d, d, diagonal], [-1, 0, horizontal], [-d, -d, diagonal]].forEach(([dx, dy, length]) => {
          const slanted = dx !== 0 && dy !== 0;
          const alpha = rayAlpha * (slanted ? .85 : 1);
          ray(dx, dy, length, (slanted ? 1.65 : 2.2) * unit, alpha, false);
          ray(dx, dy, length * .88, (slanted ? .48 : .65) * unit, alpha * .85, true);
        });

        // A slight outward lightening keeps the center filled, with no pale hole.
        const coreRadius = 3.78 * unit;
        const core = ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
        core.addColorStop(0, rgba([246, 230, 176], coreAlpha));
        core.addColorStop(.65, rgba([247, 232, 181], coreAlpha));
        core.addColorStop(1, rgba([249, 234, 186], coreAlpha));
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    }
  };
}

export function paintConstellationBackground(ctx: CanvasRenderingContext2D, width: number, height: number, theme: 'dark' | 'bright'): void {
  const dark = theme === 'dark';
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = dark ? '#17151e' : '#fcfaf6';
  ctx.fillRect(0, 0, width, height);
  const corner = ctx.createRadialGradient(width * .9, height * .1, 0, width * .9, height * .1, width * .85);
  corner.addColorStop(0, dark ? 'rgba(55,42,68,.36)' : 'rgba(229,215,234,.36)');
  corner.addColorStop(1, dark ? 'rgba(23,21,30,0)' : 'rgba(252,250,246,0)');
  ctx.fillStyle = corner;
  ctx.fillRect(0, 0, width, height);
  const bottom = ctx.createRadialGradient(width * .25, height * .98, 0, width * .25, height * .98, width * 1.05);
  bottom.addColorStop(0, dark ? 'rgba(46,35,62,.44)' : 'rgba(232,219,238,.44)');
  bottom.addColorStop(1, dark ? 'rgba(23,21,30,0)' : 'rgba(252,250,246,0)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, width, height);
}
