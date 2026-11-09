// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createApi } from "../lib/api";
import { rememberAttendee } from "../lib/identity";
import { ConferencePicker } from "./conference-picker";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const conferences = [
  { id: "conf-a", name: "KubeCon NA 2026", theme_name: "Kube Caverns", created_at: "2026-11-09T20:00:00.000Z" },
  { id: "conf-b", name: "Ocean Con", theme_name: "Abyssal Depths", created_at: "2026-11-09T19:00:00.000Z" },
];
const api = createApi(async () => ({ conferences }));
const stableApi = () => api;

it("WEB-1 Play lists conferences: Continue where this device has a character, Join elsewhere", async () => {
  rememberAttendee("conf-a", "att-1");
  render(<ConferencePicker mode="play" api={stableApi} />);
  expect((await screen.findByRole("link", { name: "Continue KubeCon NA 2026" })).getAttribute("href")).toBe("/c/conf-a/map");
  expect(screen.getByRole("link", { name: "Join Ocean Con" }).getAttribute("href")).toBe("/c/conf-b/join");
});

it("WEB-13 Organize opens each conference's organizer view and offers Create", async () => {
  render(<ConferencePicker mode="organize" api={stableApi} />);
  expect((await screen.findByRole("link", { name: "Open Ocean Con" })).getAttribute("href")).toBe("/organizer/conf-b");
  expect(screen.getByRole("link", { name: "Create a conference" }).getAttribute("href")).toBe("/organizer/new");
});
