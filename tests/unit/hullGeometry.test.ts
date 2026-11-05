import { describe, expect, it } from "vitest";
import {
  HULL_HEIGHT,
  HULL_TOP,
  contactLayout,
  diveViewBox,
  zoneBands,
  zoneInterior,
} from "../../src/hullGeometry";
import { hullZones } from "../../src/presentation";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `sim-${i + 1}`);

describe("contactLayout", () => {
  for (const { id: zone } of hullZones)
    for (const n of [1, 6, 18, 40])
      it(`places ${n} contacts in ${zone} inside the band without overlap`, () => {
        const box = zoneInterior(zone);
        const layout = contactLayout(ids(n), zone);
        expect(layout).toHaveLength(n);
        expect(contactLayout(ids(n), zone)).toEqual(layout);
        for (const c of layout) {
          expect(c.x - c.r).toBeGreaterThanOrEqual(box.x - 0.01);
          expect(c.x + c.r).toBeLessThanOrEqual(box.x + box.w + 0.01);
          expect(c.y - c.r).toBeGreaterThanOrEqual(box.y - 0.01);
          expect(c.y + c.r).toBeLessThanOrEqual(box.y + box.h + 0.01);
        }
        for (let a = 0; a < n; a++)
          for (let b = a + 1; b < n; b++) {
            const [p, q] = [layout[a], layout[b]];
            expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(
              p.r + q.r - 0.01,
            );
          }
      });
});

describe("diveViewBox", () => {
  it("frames the whole band and the full hull height", () => {
    for (const { id: zone } of hullZones) {
      const view = diveViewBox(zone);
      const [start, end] = zoneBands[zone];
      expect(view.x).toBeLessThanOrEqual(start);
      expect(view.x + view.w).toBeGreaterThanOrEqual(end);
      expect(view.y).toBeLessThanOrEqual(HULL_TOP);
      expect(view.y + view.h).toBeGreaterThanOrEqual(HULL_TOP + HULL_HEIGHT);
    }
  });
});
