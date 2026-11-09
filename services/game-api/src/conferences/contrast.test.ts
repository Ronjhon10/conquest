import { describe, expect, it } from "vitest";
import { contrastRatio, readableFg } from "./contrast";

describe("contrastRatio", () => {
  it("GM-2 black on white is 21:1 and identical colors are 1:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });

  it("GM-2 is symmetric and the fallback palette passes 4.5", () => {
    expect(contrastRatio("#14111f", "#f4efe6")).toBeCloseTo(contrastRatio("#f4efe6", "#14111f"), 10);
    expect(contrastRatio("#f4efe6", "#14111f")).toBeGreaterThan(4.5);
  });

  it("GM-2 mid grey on white is below 4.5 (known value ~3.95)", () => {
    expect(contrastRatio("#808080", "#ffffff")).toBeCloseTo(3.95, 1);
  });
});

describe("readableFg", () => {
  it("GM-2 leaves a readable fg alone", () => {
    expect(readableFg("#f4efe6", "#14111f")).toBe("#f4efe6");
  });

  it("GM-2 lightens fg on a dark bg and darkens it on a light bg until it passes 4.5", () => {
    for (const [fg, bg] of [["#3a2f5a", "#14111f"], ["#c0c0c0", "#ffffff"], ["#888888", "#777777"], ["#ff0000", "#ff3333"]]) {
      const out = readableFg(fg!, bg!);
      expect(contrastRatio(out, bg!)).toBeGreaterThanOrEqual(4.5);
    }
    expect(readableFg("#3a2f5a", "#14111f") > "#3a2f5a").toBe(true); // moved toward white
  });
});
