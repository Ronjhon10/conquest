// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, createApi, getApi } from "../lib/api";
import { createFakeTransport } from "../lib/fake-api";
import { currentAttendee, rememberAttendee } from "../lib/identity";
import * as photos from "../lib/photo";
import { RoutePreview } from "./route-preview";
import { SignupForm } from "./signup";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function setup() {
  const api = createApi(createFakeTransport(sessionStorage));
  const navigate = vi.fn();
  const user = userEvent.setup();
  render(<SignupForm conf="conf-demo" api={() => api} navigate={navigate} />);
  return { api, navigate, user };
}
async function fillProfile(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByLabelText(/LinkedIn profile link/),
    "linkedin.com/in/danny-nef?trk=profile",
  );
  await user.type(screen.getByLabelText(/^Name/), "Danny Nef");
  await user.type(screen.getByLabelText(/Headline/), "Security engineer");
  await user.type(
    screen.getByLabelText(/About you/),
    "I want to learn security and meet other builders.",
  );
}
it("WEB-2 prefills class/goals and reaches a personal map in two taps after profile entry", async () => {
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("Network forbidden"));
  const { api, user, navigate } = setup();
  await fillProfile(user);
  await user.click(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  const suggestion = await screen.findByRole("button", { name: /rogue/i });
  expect(suggestion.getAttribute("aria-pressed")).toBe("true");
  expect(
    screen
      .getByRole("button", { name: /Platform engineering/ })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  await user.click(screen.getByRole("button", { name: /Enter the dungeon/ }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/c/conf-demo/map"),
  );
  const id = currentAttendee("conf-demo");
  expect(id).toBeTruthy();
  const { attendee } = await api.attendee(id!);
  expect(attendee.name).toBe("Danny Nef");
  expect(attendee.class).toBe("rogue");
  expect(attendee.linkedin_url).toBe("https://www.linkedin.com/in/danny-nef/");
  expect(attendee.photo).toBeNull();
  expect(attendee.goals).toHaveLength(3);
  expect(attendee.map.length).toBeGreaterThan(0);
  expect(localStorage.getItem("conquest:conf-demo:attendee")).toBe(id);
  const reloaded = createApi(createFakeTransport(sessionStorage));
  expect((await reloaded.attendee(id!)).attendee.name).toBe("Danny Nef");
  expect(network).not.toHaveBeenCalled();
});
it("WEB-2 lets attendees change class, add a goal with Enter, and go back without losing their profile", async () => {
  const { api, user, navigate } = setup();
  await fillProfile(user);
  await user.click(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  await user.click(await screen.findByRole("button", { name: /wizard/i }));
  await user.type(
    screen.getByLabelText("Add a goal"),
    "Meet other designers{Enter}",
  );
  expect(navigate).not.toHaveBeenCalled();
  expect(
    screen
      .getByRole("button", { name: /Meet other designers/ })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  await user.click(screen.getByRole("button", { name: /Enter the dungeon/ }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  const { attendee } = await api.attendee(currentAttendee("conf-demo")!);
  expect(attendee.class).toBe("wizard");
  expect(attendee.goals).toContain("Meet other designers");
});
it("WEB-15 validates the profile link before drafting and keeps profile fields when going back", async () => {
  const { api, user } = setup();
  const draft = vi.spyOn(api, "draft");
  await user.type(
    await screen.findByLabelText(/LinkedIn profile link/),
    "https://linkedin.com/company/example",
  );
  await user.type(screen.getByLabelText(/^Name/), "Danny");
  await user.click(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText(/Enter a LinkedIn profile link/)).toBeTruthy();
  expect(draft).not.toHaveBeenCalled();
  const link = screen.getByLabelText(/LinkedIn profile link/);
  await user.clear(link);
  await user.type(link, "www.linkedin.com/in/danny/");
  await user.click(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  await user.click(await screen.findByRole("button", { name: "Back" }));
  expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
    "Danny",
  );
});
it("WEB-2 preserves choices on a failed save and prevents duplicate attendee submissions", async () => {
  const { api, user, navigate } = setup();
  await fillProfile(user);
  await user.click(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  await screen.findByRole("button", { name: /Enter the dungeon/ });
  const original = api.createAttendee;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const save = vi
    .spyOn(api, "createAttendee")
    .mockRejectedValueOnce(
      new ApiError("unavailable", "Please try again shortly.", 503),
    )
    .mockImplementationOnce(async (body) => {
      await gate;
      return original(body);
    });
  await user.click(screen.getByRole("button", { name: /Enter the dungeon/ }));
  expect(await screen.findByText("Please try again shortly.")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /rogue/i }).getAttribute("aria-pressed"),
  ).toBe("true");
  await user.dblClick(
    screen.getByRole("button", { name: /Enter the dungeon/ }),
  );
  expect(save).toHaveBeenCalledTimes(2);
  expect(
    (
      screen.getByRole("button", {
        name: /Building your map/,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  release!();
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
});
it("WEB-2 refuses empty goals and offers a readable draft retry", async () => {
  const { api, user } = setup();
  vi.spyOn(api, "draft").mockRejectedValueOnce(
    new ApiError("offline", "Try your connection again."),
  );
  await fillProfile(user);
  await user.click(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  expect(await screen.findByText("Try your connection again.")).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  for (const goal of ["Platform engineering", "Observability", "Security"]) {
    await user.click(
      await screen.findByRole("button", { name: new RegExp(`^✓ ${goal}$`) }),
    );
  }
  await user.click(screen.getByRole("button", { name: /Enter the dungeon/ }));
  expect(
    await screen.findByText("Choose at least one goal for your conference."),
  ).toBeTruthy();
});

it("WEB-15 uploads an optional prepared photo and includes it in the created character", async () => {
  const photo = "data:image/jpeg;base64,AAAA";
  vi.spyOn(photos, "prepareProfilePhoto").mockResolvedValue(photo);
  const { api, user, navigate } = setup();
  const save = vi.spyOn(api, "createAttendee");
  await fillProfile(user);
  await user.upload(
    screen.getByLabelText(/Profile photo/),
    new File(["image"], "profile.png", { type: "image/png" }),
  );
  expect(await screen.findByText("Photo ready.")).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  expect(await screen.findByAltText("Danny Nef's profile photo")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Enter the dungeon/ }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(save.mock.calls[0]?.[0].photo).toBe(photo);
});
it("WEB-2 completes the default character signup using only the keyboard after typing", async () => {
  const { user, navigate } = setup();
  await fillProfile(user);
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  await user.keyboard("{Enter}");
  const enter = await screen.findByRole("button", {
    name: /Enter the dungeon/,
  });
  for (let tabs = 0; document.activeElement !== enter && tabs < 24; tabs++)
    await user.tab();
  expect(document.activeElement).toBe(enter);
  await user.keyboard("{Enter}");
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/c/conf-demo/map"),
  );
});

it("WEB-2 loads the signed-up character on the map instead of the seeded sample attendee", async () => {
  vi.stubEnv("NEXT_PUBLIC_FAKE_API", "1");
  const api = getApi();
  const { attendee } = await api.createAttendee({
    conference_id: "conf-demo",
    name: "My new wizard",
    headline: "Designer",
    about: "Accessibility",
    linkedin_url: "https://www.linkedin.com/in/new-wizard/",
    class: "wizard",
    avatar_seed: "personal",
    goals: ["Accessibility"],
  });
  rememberAttendee("conf-demo", attendee.id);
  render(<RoutePreview view="map" conf="conf-demo" />);
  expect(await screen.findByText("My new wizard")).toBeTruthy();
  expect(screen.queryByText("Jane Example")).toBeNull();
  expect(
    screen.getAllByText('Matches your goal "Accessibility"').length,
  ).toBeGreaterThan(0);
});

it("WEB-2 recovers a stale demo identity from a closed tab instead of trapping the map in an error", async () => {
  vi.stubEnv("NEXT_PUBLIC_FAKE_API", "1");
  rememberAttendee("conf-demo", "att-from-a-closed-tab");
  render(<RoutePreview view="map" conf="conf-demo" />);
  expect(await screen.findByText("Jane Example")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(currentAttendee("conf-demo")).toBeNull();
  expect(localStorage.getItem("conquest:conf-demo:attendee")).toBeNull();
});
