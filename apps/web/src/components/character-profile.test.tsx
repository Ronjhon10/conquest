// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getApi } from "../lib/api";
import { rememberAttendee } from "../lib/identity";
import { isCharacterSheet } from "../lib/character-sheet";
import { CharacterProfile } from "./character-profile";
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
it("WEB-26 saves the reviewed outfit and art, preserves progress, and restores them on reload", async () => {
  vi.stubEnv("NEXT_PUBLIC_FAKE_API", "1");
  const api = getApi();
  const { attendee } = await api.createAttendee({
    conference_id: "conf-demo",
    name: "Profile adventurer",
    headline: "Builder",
    about: "Cloud",
    class: "knight",
    avatar_seed: "same-person",
    goals: ["Accessibility"],
  });
  rememberAttendee("conf-demo", attendee.id);
  const user = userEvent.setup();
  render(<CharacterProfile conf="conf-demo" />);
  await screen.findByText("Profile adventurer");
  await user.click(screen.getByRole("button", { name: "wizard" }));
  await user.click(screen.getByRole("button", { name: "Save character" }));
  await screen.findByText(/Character saved/);
  const saved = (await api.attendee(attendee.id)).attendee;
  expect(saved.class).toBe("wizard");
  expect(isCharacterSheet(saved.photo)).toBe(true);
  expect(saved.map).toEqual(attendee.map);
  expect(saved.goals).toEqual(attendee.goals);
  expect(saved.xp).toBe(attendee.xp);
  cleanup();
  render(<CharacterProfile conf="conf-demo" />);
  await screen.findByText("Profile adventurer");
  expect(
    screen.getByRole("button", { name: "wizard" }).getAttribute("aria-pressed"),
  ).toBe("true");
});
