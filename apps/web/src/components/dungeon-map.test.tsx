// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { fixtures, type Attendee, type Talk } from "@conquest/contracts";
import { DungeonMap, pickDay } from "./dungeon-map";
import { bossLook, bossName } from "./dungeon-world";

afterEach(cleanup);

// Two conference days (venue time is America/Denver, UTC-7 in November).
const talk = (id: string, title: string, room: string, startsAt: string): Talk => ({
  ...fixtures.talks[0]!,
  id,
  title,
  room,
  starts_at: startsAt,
  ends_at: startsAt,
});
const talks = [
  talk("t-late", "Observability at Dusk", "Hall A", "2026-11-10T16:00:00.000-07:00"),
  talk("t-early", "Platform Engineering at Dawn", "Room 255", "2026-11-10T09:00:00.000-07:00"),
  talk("t-day2", "Security on Day Two", "Room 151", "2026-11-11T10:00:00.000-07:00"),
];
const attendee: Attendee = {
  ...structuredClone(fixtures.attendee),
  map: talks.map((t) => ({ talk_id: t.id, score: 1, reason: `Matches ${t.title}` })),
};
const conference = structuredClone(fixtures.conference);
conference.rooms = [
  { name: "Hall A", step_free: true, step_free_note: null },
  { name: "Room 255", step_free: false, step_free_note: "Stairs only from the east lobby" },
];
const show = (now: string) =>
  render(<DungeonMap conference={conference} attendee={attendee} talks={talks} conf="conf-demo" now={new Date(now)} />);
const pathTitles = () =>
  within(screen.getByRole("list", { name: "Dungeon path" }))
    .getAllByRole("button")
    .map((b) => b.getAttribute("aria-label"));

it("WEB-3 shows today's bosses in time order, and every talk with time, room, reason and link in the list", () => {
  show("2026-11-10T08:00:00.000-07:00");
  const path = pathTitles();
  expect(path).toHaveLength(2);
  expect(path[0]).toContain("Platform Engineering at Dawn");
  expect(path[1]).toContain("Observability at Dusk");
  const all = within(screen.getByRole("list", { name: "All your talks" })).getAllByRole("listitem");
  expect(all.map((li) => li.textContent)).toEqual([
    expect.stringContaining("Platform Engineering at Dawn"),
    expect.stringContaining("Observability at Dusk"),
    expect.stringContaining("Security on Day Two"),
  ]);
  expect(all[0]!.textContent).toContain("Room 255");
  expect(all[0]!.textContent).toContain("Matches Platform Engineering at Dawn");
  expect(within(all[2]!).getByRole("link").getAttribute("href")).toBe("/c/conf-demo/boss/t-day2");
});

it("WEB-3 picks the day by itself: today during the event, the first day before it, the last after", () => {
  const days = ["2026-11-10", "2026-11-11"];
  expect(pickDay(days, new Date("2026-11-11T12:00:00.000-07:00"))).toBe("2026-11-11");
  expect(pickDay(days, new Date("2026-11-01T12:00:00.000-07:00"))).toBe("2026-11-10");
  expect(pickDay(days, new Date("2026-12-01T12:00:00.000-07:00"))).toBe("2026-11-11");
  show("2026-11-11T08:00:00.000-07:00");
  expect(pathTitles()).toEqual([expect.stringContaining("Security on Day Two")]);
  expect(screen.queryByRole("button", { name: /Day 1|List view|Step-free/ })).toBeNull();
});

it("WEB-3 choosing a room by keyboard updates the encounter card and its fight link", async () => {
  show("2026-11-10T08:00:00.000-07:00");
  const user = userEvent.setup();
  const encounter = () => within(screen.getByRole("region", { name: "Selected boss" }));
  expect(encounter().getByRole("heading").textContent).toBe("Platform Engineering at Dawn");
  const second = within(screen.getByRole("list", { name: "Dungeon path" })).getAllByRole("button")[1]!;
  second.focus();
  await user.keyboard("{Enter}");
  expect(second.getAttribute("aria-pressed")).toBe("true");
  expect(encounter().getByRole("heading").textContent).toBe("Observability at Dusk");
  expect(encounter().getByRole("link", { name: /Fight this boss/ }).getAttribute("href")).toBe("/c/conf-demo/boss/t-late");
});

it("WEB-5 the list marks step-free access in text, with the organizer's note and unconfirmed rooms", () => {
  show("2026-11-10T08:00:00.000-07:00");
  const all = within(screen.getByRole("list", { name: "All your talks" })).getAllByRole("listitem");
  expect(all[0]!.textContent).toContain("Not step-free: Stairs only from the east lobby");
  expect(all[1]!.textContent).toContain("Step-free access");
  expect(all[2]!.textContent).toContain("Step-free access unconfirmed");
});

it("WEB-12 bosses take the theme's noun and each talk gets its own stable look", () => {
  const theme = { ...conference.theme, boss_noun: "kraken" };
  expect(bossName(talks[0]!, theme)).toMatch(/^The \w+ Kraken$/);
  expect(bossLook("t-early")).toEqual(bossLook("t-early"));
  const looks = new Set(["a", "b", "c", "d", "e", "f"].map((id) => JSON.stringify(bossLook(`talk-${id}`))));
  expect(looks.size).toBeGreaterThan(1);
});
