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
