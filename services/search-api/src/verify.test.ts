import { describe, expect, it } from "vitest";
import { loadSchedule } from "./data";
import { MemoryTalkStore } from "./testing/memory-store";
import { verify } from "./verify";

describe("npm run verify checks", () => {
  it("SR-13 every read-only check passes on the committed schedule (in memory); SR-5 skips without semantic", async () => {
    const data = await loadSchedule();
    const checks = await verify(new MemoryTalkStore(data), data, { semantic: false });
    expect(checks.filter((c) => c.result === "fail")).toEqual([]);
    expect(checks.find((c) => c.id === "SR-5")!.result).toBe("skip");
    expect(checks.map((c) => c.id)).toEqual(["OV-3", "SR-1", "SR-3", "SR-4", "SR-5", "SR-6/7/13", "SR-10", "SR-12"]);
  });
});
