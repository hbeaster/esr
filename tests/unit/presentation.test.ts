import { describe, expect, it } from "vitest";
import { equipmentClass, equipmentClassLabel } from "../../src/presentation";

const blank = { component: "", title: "", workStatement: "", condition: "" };

describe("equipmentClass", () => {
  it("reads the CRACN component codes", () => {
    expect(
      equipmentClass({ ...blank, component: "ASW-P-02 / TSN-10482" }),
    ).toBe("pump");
    expect(equipmentClass({ ...blank, component: "VLV-214 / TSN-20871" })).toBe(
      "valve",
    );
  });

  it("falls back to the title, work statement, then condition", () => {
    expect(
      equipmentClass({ ...blank, title: "Shore power breaker — seal weep" }),
    ).toBe("electrical");
    expect(
      equipmentClass({ ...blank, workStatement: "Verify damper travel" }),
    ).toBe("ventilation");
    expect(
      equipmentClass({
        ...blank,
        condition: "<p>Lube oil <b>cooler</b> leak</p>",
      }),
    ).toBe("heat-exchanger");
  });

  it("lets the component outrank a conflicting title", () => {
    expect(
      equipmentClass({
        ...blank,
        component: "ASW-P-02 / TSN-10482",
        title: "Hydraulic accumulator — corrosion",
      }),
    ).toBe("pump");
  });

  it("matches whole words and defaults to generic", () => {
    expect(equipmentClass({ ...blank, title: "Fanout bracket crack" })).toBe(
      "generic",
    );
    expect(equipmentClass(blank)).toBe("generic");
    expect(equipmentClassLabel("generic")).toBe("Equipment");
  });
});
