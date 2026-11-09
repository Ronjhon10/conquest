// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { fixtures } from "@conquest/contracts";
import { AppShell } from "./app-shell";
import { RouteContent } from "./route-preview";

const route = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
afterEach(() => { cleanup(); route.path = "/"; });

it("WEB-3 gives the map one integrated phone shell with player stats and attendee navigation", async () => {
  route.path = "/c/conf-demo/map";
  render(<AppShell><RouteContent view="map" conf="conf-demo" data={{ conference: fixtures.conference, attendee: fixtures.attendee, talks: fixtures.talks, rows: [], speakers: fixtures.speakers }} /></AppShell>);
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
  expect(screen.queryByRole("contentinfo")).toBeNull();
  expect(screen.getByRole("link", { name: "Conquest home" }).getAttribute("href")).toBe("/");
  expect(screen.getByRole("link", { name: "Conquest home" }).querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(screen.queryByText("Conference preview")).toBeNull();
  expect(screen.getByText(fixtures.attendee.name)).toBeTruthy();
  expect(screen.getByText(`${fixtures.attendee.xp} XP`)).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "Progress to next level" })).toBeTruthy();
  const nav = within(screen.getByRole("navigation", { name: "Attendee pages" }));
  expect(nav.getAllByRole("link")).toHaveLength(5);
  expect(nav.getByRole("link", { name: "Map" }).getAttribute("aria-current")).toBe("page");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Quests" }));
  expect(screen.getByRole("region", { name: "Your quests" })).toBeTruthy();
  expect(screen.getByText(fixtures.attendee.quests[0]!.title)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Close quests" }));
  expect(screen.queryByRole("region", { name: "Your quests" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Quests" }));
});

it("WEB-1 keeps the normal website shell on non-map routes", () => {
  route.path = "/organizer/new";
  render(<AppShell><p>Organizer page</p></AppShell>);
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
  expect(screen.getByRole("contentinfo")).toBeTruthy();
  expect(screen.getByText("Organizer page")).toBeTruthy();
  const home = screen.getByRole("link", { name: "Conquest home" });
  expect(home.getAttribute("href")).toBe("/");
  expect(within(home).getByText("ConQuest")).toBeTruthy();
  expect(home.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(within(screen.getByRole("contentinfo")).getByText("ConQuest")).toBeTruthy();
});

it("WEB-10 keeps the branded home link reachable by keyboard", async () => {
  render(<AppShell><p>Page</p></AppShell>);
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Skip to content" }));
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Conquest home" }));
});
