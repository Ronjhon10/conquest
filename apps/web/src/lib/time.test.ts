import { describe, expect, it } from "vitest";
import { formatTalkTime } from "./time";

describe("formatTalkTime", () => {
  it("shows a morning talk on its venue day", () => {
    expect(formatTalkTime("2026-11-10T09:00:00.000-07:00")).toBe("Tue 9:00 AM");
  });

  it("keeps an evening talk on its venue day, not the UTC day", () => {
    // 7 PM in Salt Lake City is already Wednesday in UTC.
    expect(formatTalkTime("2026-11-10T19:00:00.000-07:00")).toBe("Tue 7:00 PM");
  });
});
