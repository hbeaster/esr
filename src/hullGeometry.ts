import type { HullZone } from "./presentation";

/** Mock hull outline in a 640 × 160 viewBox, bow on the left. Not to scale. */
export const HULL_VIEWBOX = "0 0 640 160";
export const HULL_PATH =
  "M70 62H470C540 62 580 78 600 90C580 102 540 118 470 118H70A28 28 0 0 1 70 62Z";
export const HULL_TOP = 62;
export const HULL_HEIGHT = 56;
export const HULL_CENTER_Y = 90;

/** Bow-to-stern x ranges of each zone inside the hull outline. */
export const zoneBands: Record<HullZone, [number, number]> = {
  forward: [42, 150],
  operations: [150, 250],
  midships: [250, 340],
  auxiliary: [340, 430],
  engineering: [430, 530],
  aft: [530, 610],
};

/** Horizontal center for a zone's label or marker. The aft band tapers, so it leans toward the wider end. */
export function zoneCenter(zone: HullZone): number {
  const [start, end] = zoneBands[zone];
  return zone === "aft" ? start + 22 : (start + end) / 2;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const FULL_VIEW: ViewBox = { x: 0, y: 0, w: 640, h: 160 };
const DIVE_PAD = 24;
/** The zoomed view for a compartment dive: the band plus some neighbors, with the full hull height. */
export function diveViewBox(zone: HullZone): ViewBox {
  const [start, end] = zoneBands[zone];
  const w = end - start + DIVE_PAD * 2;
  const h = Math.max(0.42 * w, HULL_HEIGHT + 16);
  return { x: start - DIVE_PAD, y: HULL_CENTER_Y - h / 2, w, h };
}
/** Where contacts may sit inside a band. The aft band tapers, so it is shorter and narrower. */
export function zoneInterior(zone: HullZone): ViewBox {
  const [start, end] = zoneBands[zone];
  if (zone === "aft") return { x: start + 4, y: 74, w: 42, h: 32 };
  return {
    x: start + 6,
    y: HULL_TOP + 4,
    w: end - start - 12,
    h: HULL_HEIGHT - 8,
  };
}
/**
 * Most contacts a dive draws before collapsing the rest into one overflow
 * marker. A boat can carry thousands of ESRs, and the tapered aft band holds fewer.
 */
export const contactCap = (zone: HullZone): number =>
  zone === "aft" ? 12 : 24;
export interface Contact {
  id: string;
  x: number;
  y: number;
  r: number;
}
/** Two stable pseudo-random numbers in [-1, 1] from a string. */
function jitter(id: string): [number, number] {
  let h = 2166136261;
  for (const char of id) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return [
    ((h & 0xffff) / 0xffff) * 2 - 1,
    (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1,
  ];
}
/**
 * Deterministic, non-overlapping contact positions for a dive: a grid shaped
 * like the band, each contact nudged by a hash of its id for a sonar scatter.
 */
export function contactLayout(ids: string[], zone: HullZone): Contact[] {
  const n = ids.length;
  if (!n) return [];
  const box = zoneInterior(zone);
  const cols = Math.min(n, Math.ceil(Math.sqrt((n * box.w) / box.h)));
  const rows = Math.ceil(n / cols);
  const cellW = box.w / cols;
  const cellH = box.h / rows;
  const half = Math.min(cellW, cellH) / 2;
  const r = Math.min(9, Math.max(2.5, half - 0.5));
  const slack = Math.max(0, Math.min(2, half - r));
  return ids.map((id, i) => {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    // Center a short last row.
    const offset = ((cols - inRow) * cellW) / 2;
    const [jx, jy] = jitter(id);
    return {
      id,
      x: box.x + offset + cellW * (i % cols) + cellW / 2 + jx * slack,
      y: box.y + cellH * row + cellH / 2 + jy * slack,
      r,
    };
  });
}
