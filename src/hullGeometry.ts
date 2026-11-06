import { compartments, levelsOf } from "./presentation";
import type { CompartmentId, Level } from "./presentation";

/**
 * Mock side view of an Ohio-class hull in a 640 × 150 viewBox, bow on the
 * right and keel at the bottom, as in Navy profile drawings. Not to scale,
 * but proportioned like the boat: a long parallel midbody about ten times its
 * height, a rounded bow, the sail over the aft end of the FWD Compartment, a
 * raised missile deck, and a long stern cone with cruciform planes.
 */
export const HULL_VIEWBOX = "0 0 640 150";
export const HULL_TOP = 50;
export const HULL_HEIGHT = 60;
export const HULL_CENTER_Y = HULL_TOP + HULL_HEIGHT / 2;
export const HULL_BOTTOM = HULL_TOP + HULL_HEIGHT;
/** Stern tip and bow tip. */
export const HULL_X: [number, number] = [24, 628];
export const HULL_PATH =
  "M165 50H575C605 50 628 62 628 80C628 98 605 110 575 110H165C120 110 60 92 24 80C60 68 120 50 165 50Z";
/** Sail (with fairwater planes), over the aft end of the FWD Compartment. */
export const SAIL_PATH = "M461 50L465 22H497L501 50M452 34H466M496 34H510";
/** Raised missile deck aft of the sail, over the Missile Compartment. */
export const DECK_PATH = "M457 50L461 45H244L236 50";
/** Missile tube hatches along the deck: 12 pairs seen in profile. */
export const HATCHES = Array.from({ length: 12 }, (_, i) => 432 - i * 16);
/** Rudder and stern planes at the tail of the cone. */
export const FIN_PATH = "M62 72L44 56H36L42 74M62 88L44 104H36L42 86M66 80H30";
/** Where compartment labels sit under the hull. */
export const LABEL_Y = 132;

/** Each compartment's full x span, bow cap and stern cone included. */
export const compartmentBands: Record<CompartmentId, [number, number]> = {
  forward: [429, HULL_X[1]],
  missile: [225, 429],
  engine: [HULL_X[0], 225],
};
/** Bulkhead x positions, bow to stern. */
export const BULKHEADS = [
  compartmentBands.forward[0],
  compartmentBands.engine[1],
];
/**
 * Where contacts and labels may sit in each compartment: inside the bands
 * but clear of the rounded bow and the stern cone, where the hull is short.
 */
export const compartmentInterior: Record<CompartmentId, [number, number]> = {
  forward: [compartmentBands.forward[0] + 5, 590],
  missile: [compartmentBands.missile[0] + 5, compartmentBands.missile[1] - 5],
  engine: [128, compartmentBands.engine[1] - 5],
};
export const compartmentCenter = (id: CompartmentId): number =>
  (compartmentInterior[id][0] + compartmentInterior[id][1]) / 2;

/**
 * x for a frame number. Frames count from the bow aft, and each compartment's
 * frame range spans its interior, so a frame always lands inside its
 * compartment. Frames outside every range clamp to the nearest end.
 */
export function frameX(frame: number): number {
  const first = compartments[0].frames[0];
  const last = compartments.at(-1)!.frames[1];
  const f = Math.min(last, Math.max(first, frame));
  const c =
    compartments.find((k) => f <= k.frames[1] + 0.5) ?? compartments.at(-1)!;
  const [left, right] = compartmentInterior[c.id];
  const span = Math.max(c.frames[1] - c.frames[0], 1);
  const t = Math.min(1, Math.max(0, (f - c.frames[0]) / span));
  return right - t * (right - left);
}

/** A level's y span: the hull height split evenly, upper level on top. */
export function levelBand(id: CompartmentId, level: Level): [number, number] {
  const levels = levelsOf(id);
  const index = Math.max(0, levels.indexOf(level));
  const h = HULL_HEIGHT / levels.length;
  return [HULL_TOP + index * h, HULL_TOP + (index + 1) * h];
}
/** Deck lines between levels inside a compartment. */
export function deckLines(id: CompartmentId): number[] {
  const levels = levelsOf(id);
  const h = HULL_HEIGHT / levels.length;
  return levels.slice(1).map((_, i) => HULL_TOP + (i + 1) * h);
}
export function cellCenter(
  id: CompartmentId,
  level: Level | null,
): { x: number; y: number } {
  const [top, bottom] = level ? levelBand(id, level) : [HULL_TOP, HULL_BOTTOM];
  return { x: compartmentCenter(id), y: (top + bottom) / 2 };
}
/** The strip under the hull where a dive shows contacts with no recorded level. */
export const UNKNOWN_LEVEL_BAND: [number, number] = [116, 130];

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const FULL_VIEW: ViewBox = { x: 0, y: 0, w: 640, h: 150 };
const DIVE_PAD = 26;
/**
 * The zoomed view for a compartment dive, with room for level labels, and for
 * the strip under the hull only when some contacts have no recorded level.
 */
export function diveViewBox(id: CompartmentId, unknownLevel = false): ViewBox {
  const [start, end] = compartmentBands[id];
  const w = end - start + DIVE_PAD * 2;
  const top = HULL_TOP - 8;
  const bottom = unknownLevel ? UNKNOWN_LEVEL_BAND[1] + 6 : HULL_BOTTOM + 8;
  const h = Math.max(0.42 * w, bottom - top);
  const centered = top - (h - (bottom - top)) / 2;
  return { x: start - DIVE_PAD, y: Math.min(top, centered), w, h };
}

/** Most contacts a dive draws before collapsing the rest into one overflow marker. */
export const contactCap = (): number => 24;
export interface Contact {
  id: string;
  x: number;
  y: number;
  r: number;
}
export interface ContactInput {
  id: string;
  level: Level | null;
  frame: number | null;
}
/**
 * Deterministic, non-overlapping contact positions for a dive. Each contact
 * sits on its level row at its frame; contacts in a row are pushed apart in
 * frame order, and a crowded row shrinks its markers so they still fit.
 * Contacts without a frame queue after the others in their row; contacts
 * without a level go in the strip under the hull.
 */
export function contactLayout(
  items: ContactInput[],
  id: CompartmentId,
): Contact[] {
  const [left, right] = compartmentInterior[id];
  const width = right - left;
  const rows = new Map<string, ContactInput[]>();
  for (const item of items) {
    const key = item.level ?? "unknown";
    rows.set(key, [...(rows.get(key) ?? []), item]);
  }
  const placed = new Map<string, Contact>();
  for (const [key, row] of rows) {
    const [top, bottom] =
      key === "unknown" ? UNKNOWN_LEVEL_BAND : levelBand(id, key as Level);
    const y = (top + bottom) / 2;
    // Fitting the row wins over marker size, so a crowded row never spills.
    const r = Math.min(9, (bottom - top) / 2 - 1.5, width / (2 * row.length));
    const desired = (item: ContactInput) =>
      item.frame === null
        ? Infinity
        : Math.min(right - r, Math.max(left + r, frameX(item.frame)));
    const ordered = [...row].sort(
      (a, b) => desired(a) - desired(b) || a.id.localeCompare(b.id),
    );
    const xs: number[] = [];
    ordered.forEach((item, i) => {
      const want = desired(item);
      const after = i ? xs[i - 1] + 2 * r : left + r;
      xs.push(Number.isFinite(want) ? Math.max(want, after) : after);
    });
    // Pull back from the far wall, keeping the 2r spacing.
    for (let i = xs.length - 1; i >= 0; i--) {
      const limit = i === xs.length - 1 ? right - r : xs[i + 1] - 2 * r;
      xs[i] = Math.min(xs[i], limit);
    }
    ordered.forEach((item, i) =>
      placed.set(item.id, { id: item.id, x: xs[i], y, r }),
    );
  }
  return items.map((item) => placed.get(item.id)!);
}
