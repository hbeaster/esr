import { describe, expect, it } from "vitest";
import {
  HULL_BOTTOM,
  HULL_TOP,
  UNKNOWN_LEVEL_BAND,
  compartmentBands,
  compartmentInterior,
  contactLayout,
  diveViewBox,
  frameX,
  levelBand,
} from "../../src/hullGeometry";
import type { ContactInput } from "../../src/hullGeometry";
import { compartments } from "../../src/presentation";
import type { Level } from "../../src/presentation";

describe("hull geometry", () => {
  it("maps frames from the bow (right) aft, each inside its own compartment", () => {
    // Bow on the right: frame numbers increase toward the stern, so x falls.
    for (let f = 2; f <= 160; f++)
      expect(frameX(f)).toBeLessThan(frameX(f - 1));
    for (const c of compartments) {
      const [left, right] = compartmentInterior[c.id];
      const [start, end] = compartmentBands[c.id];
      expect(left).toBeGreaterThanOrEqual(start);
      expect(right).toBeLessThanOrEqual(end);
      for (let f = c.frames[0]; f <= c.frames[1]; f++) {
        expect(frameX(f)).toBeGreaterThanOrEqual(left);
        expect(frameX(f)).toBeLessThanOrEqual(right);
      }
    }
    // The compartments run stern to bow, left to right, without gaps.
    expect(compartmentBands.engine[1]).toBe(compartmentBands.missile[0]);
    expect(compartmentBands.missile[1]).toBe(compartmentBands.forward[0]);
  });
  it("splits each compartment's height evenly into its levels, top to bottom", () => {
    for (const c of compartments) {
      const bands = c.levels.map((l) => levelBand(c.id, l));
      expect(bands[0][0]).toBe(HULL_TOP);
      expect(bands.at(-1)![1]).toBe(HULL_BOTTOM);
      for (let i = 1; i < bands.length; i++)
        expect(bands[i][0]).toBeCloseTo(bands[i - 1][1]);
    }
  });
  it("frames the whole compartment when diving, plus the unknown-level strip when needed", () => {
    for (const c of compartments) {
      const [start, end] = compartmentBands[c.id];
      for (const unknown of [false, true]) {
        const view = diveViewBox(c.id, unknown);
        expect(view.x).toBeLessThanOrEqual(start);
        expect(view.x + view.w).toBeGreaterThanOrEqual(end);
        expect(view.y).toBeLessThanOrEqual(HULL_TOP);
        expect(view.y + view.h).toBeGreaterThanOrEqual(
          unknown ? UNKNOWN_LEVEL_BAND[1] : HULL_BOTTOM,
        );
      }
      // Without unknown levels, the view does not reserve the strip.
      expect(diveViewBox(c.id).h).toBeLessThan(
        diveViewBox(c.id, true).h + 0.01,
      );
    }
  });
});

describe("contactLayout", () => {
  const sample = (n: number, level: Level | null, frames: [number, number]) =>
    Array.from({ length: n }, (_, i): ContactInput => ({
      id: `sim-${i + 1}`,
      level,
      // Clustered frames, plus one with no frame, so pushing apart is exercised.
      frame: i === n - 1 && n > 1 ? null : frames[0] + (i % 3),
    }));
  for (const c of compartments)
    for (const n of [1, 6, 24, 40])
      it(`keeps ${n} contacts on one ${c.id} level inside the row without overlap`, () => {
        const level = c.levels[1];
        const items = sample(n, level, c.frames as unknown as [number, number]);
        const layout = contactLayout(items, c.id);
        expect(contactLayout(items, c.id)).toEqual(layout);
        const [left, right] = compartmentInterior[c.id];
        const [top, bottom] = levelBand(c.id, level);
        for (const p of layout) {
          expect(p.x - p.r).toBeGreaterThanOrEqual(left - 0.01);
          expect(p.x + p.r).toBeLessThanOrEqual(right + 0.01);
          expect(p.y - p.r).toBeGreaterThanOrEqual(top - 0.01);
          expect(p.y + p.r).toBeLessThanOrEqual(bottom + 0.01);
        }
        const sorted = [...layout].sort((a, b) => a.x - b.x);
        for (let i = 1; i < sorted.length; i++)
          expect(sorted[i].x - sorted[i - 1].x).toBeGreaterThanOrEqual(
            sorted[i].r + sorted[i - 1].r - 0.01,
          );
      });
  it("places a contact at its frame on its level, and unknown levels under the hull", () => {
    const [layout, unknown] = contactLayout(
      [
        { id: "a", level: "lower", frame: 38 },
        { id: "b", level: null, frame: 30 },
      ],
      "forward",
    );
    const [top, bottom] = levelBand("forward", "lower");
    expect(layout.x).toBeCloseTo(frameX(38));
    expect(layout.y).toBeCloseTo((top + bottom) / 2);
    expect(unknown.y).toBeCloseTo(
      (UNKNOWN_LEVEL_BAND[0] + UNKNOWN_LEVEL_BAND[1]) / 2,
    );
  });
});
