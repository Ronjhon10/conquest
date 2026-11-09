import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  it("GM-1 black on white is 21:1 and identical colors are 1:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });

  it("GM-1 is symmetric and the fallback palette passes 4.5", () => {
    expect(contrastRatio("#14111f", "#f4efe6")).toBeCloseTo(contrastRatio("#f4efe6", "#14111f"), 10);
    expect(contrastRatio("#f4efe6", "#14111f")).toBeGreaterThan(4.5);
  });

  it("GM-1 mid grey on white is below 4.5 (known value ~3.95)", () => {
    expect(contrastRatio("#808080", "#ffffff")).toBeCloseTo(3.95, 1);
  });
});
