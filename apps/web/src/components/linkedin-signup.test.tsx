// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupForm } from "./signup";
import { createApi } from "../lib/api";
import { createFakeTransport } from "../lib/fake-api";
import { isCharacterSheet } from "../lib/character-sheet";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});
function setup(enabled = true) {
  const api = createApi(createFakeTransport(sessionStorage));
  const navigate = vi.fn();
  render(
    <SignupForm
      conf="conf-demo"
      api={() => api}
      navigate={navigate}
      linkedinEnabled={enabled}
    />,
  );
  return { api, navigate, user: userEvent.setup() };
}
it("WEB-21 keeps manual signup available without configured LinkedIn credentials or remote calls", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("No network"));
  setup(false);
  const button = await screen.findByRole("button", {
    name: /Continue with LinkedIn/,
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByLabelText(/^Name/)).toBeTruthy();
  expect(screen.getByLabelText(/Profile photo/)).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
});
it("WEB-23 restores the signup draft, imports name/photo, and saves the photo with the attendee", async () => {
  window.history.replaceState(null, "", "/c/conf-demo/join?linkedin=connected");
  sessionStorage.setItem(
    "conquest:conf-demo:linkedin-draft",
    JSON.stringify({
      at: Date.now(),
      fields: {
        linkedin_url: "linkedin.com/in/danny-nef",
        name: "",
        headline: "Engineer",
        about: "Accessibility",
      },
    }),
  );
  const photo = "data:image/jpeg;base64,AAAA";
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ name: "Danny Nef", photo }),
  );
  const { api, navigate, user } = setup();
  const save = vi.spyOn(api, "createAttendee");
  await screen.findByText(/Your name and photo are ready/);
  expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
    "Danny Nef",
  );
  expect((screen.getByLabelText(/Headline/) as HTMLInputElement).value).toBe(
    "Engineer",
  );
  expect(
    sessionStorage.getItem("conquest:conf-demo:linkedin-draft"),
  ).toBeNull();
  expect(window.location.search).toBe("");
  await user.click(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  expect(await screen.findByAltText("Danny Nef's profile photo")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Enter the dungeon/ }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/c/conf-demo/map"),
  );
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    name: "Danny Nef",
    headline: "Engineer",
  });
  expect(isCharacterSheet(save.mock.calls[0]?.[0].photo)).toBe(true);
});
it("WEB-23 lets a LinkedIn-authenticated attendee continue without manually pasting a profile link", async () => {
  window.history.replaceState(null, "", "/c/conf-demo/join?linkedin=connected");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ name: "New attendee", photo: null }),
  );
  const { api, navigate, user } = setup();
  const save = vi.spyOn(api, "createAttendee");
  await screen.findByText(/Your name is ready/);
  await user.click(
    screen.getByRole("button", { name: /Choose your character/ }),
  );
  await user.click(
    await screen.findByRole("button", { name: /Enter the dungeon/ }),
  );
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/c/conf-demo/map"),
  );
  expect(save.mock.calls[0]?.[0]).not.toHaveProperty("linkedin_url");
});
it("WEB-23 lets users upload a photo when LinkedIn has no usable photo and preserves their edited name", async () => {
  window.history.replaceState(null, "", "/c/conf-demo/join?linkedin=connected");
  sessionStorage.setItem(
    "conquest:conf-demo:linkedin-draft",
    JSON.stringify({ at: Date.now(), fields: { name: "My edited name" } }),
  );
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ name: "LinkedIn name", photo: null }),
  );
  setup();
  await screen.findByText(/Choose a photo below or use your class character/);
  expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
    "My edited name",
  );
  expect(
    (screen.getByLabelText(/Profile photo/) as HTMLInputElement).disabled,
  ).toBe(false);
});
it("WEB-22 recovers from cancelled and expired imports with the user's existing draft intact", async () => {
  for (const status of ["cancelled", "connected"]) {
    window.history.replaceState(
      null,
      "",
      `/c/conf-demo/join?linkedin=${status}`,
    );
    sessionStorage.setItem(
      "conquest:conf-demo:linkedin-draft",
      JSON.stringify({ at: Date.now(), fields: { name: "Saved name" } }),
    );
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ error: "Expired" }, { status: 401 }));
    setup();
    await screen.findByText(
      status === "cancelled" ? /sign-in was cancelled/ : /couldn't be imported/,
    );
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
      "Saved name",
    );
    expect(
      (
        screen.getByRole("button", {
          name: /Choose your character/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    if (status === "cancelled") expect(fetcher).not.toHaveBeenCalled();
    cleanup();
    vi.restoreAllMocks();
  }
});
