// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { fixtures } from "@conquest/contracts";
import { DungeonMap } from "./dungeon-map";
import { RoutePreview } from "./route-preview";
import * as apiModule from "../lib/api";
import { createFakeTransport } from "../lib/fake-api";
import { rememberAttendee } from "../lib/identity";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function motion(reduce = false) {
  const media = new EventTarget();
  const query = Object.assign(media, { matches: reduce });
  vi.stubGlobal("matchMedia", vi.fn(() => query));
  return (matches: boolean) => act(() => {
    query.matches = matches;
    query.dispatchEvent(new Event("change"));
  });
}
function setup(roomName = "Room 255") {
  const attendee = structuredClone(fixtures.attendee);
  attendee.map = [
    { talk_id: "talk-3", score: 1, reason: "Security goal" },
    ...attendee.map.slice(0, 2),
  ];
  const talks = structuredClone(fixtures.talks);
  talks.find((t) => t.id === "talk-3")!.room = roomName;
  render(<DungeonMap conference={fixtures.conference} attendee={attendee} talks={talks} conf="conf-demo" />);
  return userEvent.setup();
}
function titles(name: string) {
  const list = within(screen.getByRole("list", { name }));
  return name === "Dungeon path"
    ? list.getAllByRole("button").map((button) => button.getAttribute("aria-label")!.split(". ")[0])
    : list.getAllByRole("link").map((link) => link.textContent);
}
it("WEB-3 orders the same selected talks by time in the path and list with metadata and boss links", async () => {
  motion();
  const user = setup();
  const expected = fixtures.talks.slice(0, 3).map((talk) => talk.title);
  expect(titles("Dungeon path")).toEqual(expected);
  expect(screen.getAllByText("Tue 9:00 AM").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Room 255/).length).toBeGreaterThan(0);
  await user.click(screen.getByRole("button", { name: /^Locking Down Your Cluster/ }));
  expect(within(screen.getByRole("region", { name: "Selected boss" })).getByText("Security goal")).toBeTruthy();
  expect(screen.getByRole("link", { name: "View encounter" }).getAttribute("href")).toBe("/c/conf-demo/boss/talk-3");
  await user.click(screen.getByRole("checkbox", { name: "List view" }));
  expect(titles("Talk list")).toEqual(expected);
  expect(screen.getByText("Security goal")).toBeTruthy();
});
it("WEB-4 defaults to the list with reduced motion, follows preference changes, and allows keyboard override", async () => {
  const changeMotion = motion(true);
  const user = setup();
  expect(screen.getByRole("list", { name: "Talk list" })).toBeTruthy();
  changeMotion(false);
  expect(screen.getByRole("list", { name: "Dungeon path" })).toBeTruthy();
  changeMotion(true);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "List view" }));
  await user.keyboard(" ");
  expect(screen.getByRole("list", { name: "Dungeon path" })).toBeTruthy();
  changeMotion(false);
  changeMotion(true);
  expect(screen.getByRole("list", { name: "Dungeon path" })).toBeTruthy();
});
it("WEB-5 filters non-step-free rooms only from the path, retaining marked talks and organizer notes in the list", async () => {
  motion();
  const user = setup();
  await user.click(screen.getByRole("checkbox", { name: "Step-free only" }));
  expect(titles("Dungeon path")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: /^Locking Down Your Cluster/ })).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("2 of 3");
  await user.click(screen.getByRole("checkbox", { name: "List view" }));
  expect(titles("Talk list")).toHaveLength(3);
  expect(screen.getByText(/Not step-free — Stairs only/)).toBeTruthy();
  await user.click(screen.getByRole("checkbox", { name: "Step-free only" }));
  await user.click(screen.getByRole("checkbox", { name: "List view" }));
  expect(titles("Dungeon path")).toHaveLength(3);
});
it("WEB-5 marks missing room information as unconfirmed and excludes it from the step-free path", async () => {
  motion();
  const user = setup("Unknown room");
  expect(screen.getByRole("button", { name: /Locking Down Your Cluster.*Step-free access unconfirmed/ })).toBeTruthy();
  await user.click(screen.getByRole("checkbox", { name: "Step-free only" }));
  expect(titles("Dungeon path")).toHaveLength(2);
});
it("WEB-5 explains an empty step-free path and keeps every talk available in list view", async () => {
  motion();
  const attendee = { ...fixtures.attendee, map: [{ talk_id: "talk-3", score: 1, reason: "Security" }] };
  render(<DungeonMap conference={fixtures.conference} attendee={attendee} talks={fixtures.talks} conf="conf-demo" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("checkbox", { name: "Step-free only" }));
  expect(screen.getByText(/No confirmed step-free rooms/)).toBeTruthy();
  await user.click(screen.getByRole("checkbox", { name: "List view" }));
  expect(titles("Talk list")).toEqual([fixtures.talks[2]!.title]);
});
it("WEB-3 loads personal boss details directly even when absent from the search result page", async () => {
  motion(true);
  const api = apiModule.createApi(createFakeTransport());
  const search = vi.spyOn(api, "talks").mockResolvedValue({ results: [] });
  const details = vi.spyOn(api, "talk");
  vi.spyOn(apiModule, "getApi").mockReturnValue(api);
  rememberAttendee("conf-demo", fixtures.attendee.id);
  render(<RoutePreview view="map" conf="conf-demo" />);
  expect(await screen.findByRole("link", { name: fixtures.talks[0]!.title })).toBeTruthy();
  expect(details.mock.calls.map(([id]) => id).sort()).toEqual(fixtures.attendee.map.map((boss) => boss.talk_id).sort());
  expect(search).not.toHaveBeenCalled();
});
it("WEB-3 offers signup without a personal identity and explains an empty personal map", () => {
  motion(true);
  const props = { conference: fixtures.conference, talks: fixtures.talks, conf: "conf-demo" };
  const { rerender } = render(<DungeonMap {...props} attendee={null} />);
  expect(screen.getByRole("link", { name: "Create your adventurer" }).getAttribute("href")).toBe("/c/conf-demo/join");
  rerender(<DungeonMap {...props} attendee={{ ...fixtures.attendee, map: [] }} />);
  expect(screen.getByText("No talks on your map yet.")).toBeTruthy();
});

it("WEB-3 keeps available boss rooms and their speakers when another selected talk fails to load", async () => {
  motion(true);
  const api = apiModule.createApi(createFakeTransport());
  const originalTalk = api.talk;
  vi.spyOn(api, "talk").mockImplementation((id) => id === "talk-2"
    ? Promise.reject(new apiModule.ApiError("not_found", "Talk removed", 404))
    : originalTalk(id));
  vi.spyOn(apiModule, "getApi").mockReturnValue(api);
  rememberAttendee("conf-demo", fixtures.attendee.id);
  render(<RoutePreview view="map" conf="conf-demo" />);
  expect(await screen.findByRole("link", { name: fixtures.talks[0]!.title })).toBeTruthy();
  expect(screen.getAllByText("Speaker: Ada Fixture").length).toBeGreaterThan(0);
  expect(screen.getByRole("alert").textContent).toContain("1 talk could not be loaded");
  await userEvent.setup().click(screen.getByRole("button", { name: "Quests" }));
  expect(screen.getByRole("heading", { name: "Your quests" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: fixtures.talks[1]!.title })).toBeNull();
});

it("WEB-3 selects a chamber with the keyboard and updates one floating encounter panel", async () => {
  motion();
  const user = setup();
  const room = screen.getByRole("button", { name: /^Locking Down Your Cluster/ });
  room.focus();
  await user.keyboard("{Enter}");
  expect(room.getAttribute("aria-pressed")).toBe("true");
  const panel = screen.getByRole("region", { name: "Selected boss" });
  expect(within(panel).getByRole("heading", { name: "Locking Down Your Cluster" })).toBeTruthy();
  expect(screen.getAllByRole("region", { name: "Selected boss" })).toHaveLength(1);
  await user.click(screen.getByRole("checkbox", { name: "Step-free only" }));
  expect(screen.queryByRole("heading", { name: "Locking Down Your Cluster" })).toBeNull();
  expect(within(screen.getByRole("region", { name: "Selected boss" })).getByRole("heading", { name: fixtures.talks[0]!.title })).toBeTruthy();
});

it("WEB-3 switches actual conference days in venue time and keeps all days in the list", async () => {
  motion();
  const talks = structuredClone(fixtures.talks.slice(0, 2));
  talks[0]!.starts_at = "2026-11-11T06:30:00Z"; // Nov 10 at 11:30 PM in Salt Lake City.
  talks[1]!.starts_at = "2026-11-11T15:00:00Z";
  const attendee = { ...fixtures.attendee, map: fixtures.attendee.map.slice(0, 2) };
  render(<DungeonMap conference={fixtures.conference} attendee={attendee} talks={talks} conf="conf-demo" />);
  const user = userEvent.setup();
  expect(titles("Dungeon path")).toEqual([talks[0]!.title]);
  await user.click(screen.getByRole("button", { name: /Day 2/ }));
  expect(titles("Dungeon path")).toEqual([talks[1]!.title]);
  expect(screen.getByRole("link", { name: "View encounter" }).getAttribute("href")).toBe("/c/conf-demo/boss/talk-2");
  expect(screen.queryByRole("button", { name: /Day 3/ })).toBeNull();
  await user.click(screen.getByRole("checkbox", { name: "List view" }));
  expect(titles("Talk list")).toEqual(talks.map((talk) => talk.title));
});
