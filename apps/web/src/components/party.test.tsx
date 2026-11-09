// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, createApi, type Api } from "../lib/api";
import { createFakeTransport } from "../lib/fake-api";
import { PartyView } from "./party";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

async function newAttendee(api: Api, name: string) {
  const profile = {
    conference_id: "conf-demo",
    name,
    headline: "Engineer",
    about: "I want to learn platform engineering and meet builders.",
  };
  const draft = await api.draft(profile);
  const { attendee } = await api.createAttendee({
    ...profile,
    class: draft.class,
    avatar_seed: draft.avatar_seed,
    goals: draft.suggested_goals.slice(0, 2),
  });
  return attendee;
}
async function setup() {
  const api = createApi(createFakeTransport(sessionStorage));
  const ada = await newAttendee(api, "Ada Lovelace");
  const bo = await newAttendee(api, "Bo Peep");
  const user = userEvent.setup();
  const view = (id: string, a: Api = api) =>
    render(<PartyView conf="conf-demo" api={() => a} attendeeId={() => id} />);
  return { api, ada, bo, user, view };
}

it("GM-12 creates a party, shows its code, members and the 1.25x bonus in a live region", async () => {
  const { api, ada, user, view } = await setup();
  view(ada.id);
  await user.type(await screen.findByLabelText("Party name"), "Pod Squad");
  await user.click(screen.getByRole("button", { name: "Create party" }));
  expect(await screen.findByRole("heading", { name: "Pod Squad" })).toBeTruthy();
  const { party } = await api.attendee(ada.id);
  expect(party?.name).toBe("Pod Squad");
  expect(screen.getByText(party!.id)).toBeTruthy();
  expect(screen.getByText(/Ada Lovelace/)).toBeTruthy();
  expect(screen.getAllByText(/x1\.25/).length).toBeGreaterThan(0);
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toMatch(/Pod Squad created/),
  );
});

it("GM-7 explains the party check-in bonus before you have a party", async () => {
  const { ada, view } = await setup();
  view(ada.id);
  expect(await screen.findByText(/x1\.25 XP party bonus/)).toBeTruthy();
});

it("GM-12 joins a party by code and lists both members", async () => {
  const { api, ada, bo, user, view } = await setup();
  const { party } = await api.createParty({ attendee_id: ada.id, name: "Pod" });
  view(bo.id);
  await user.type(await screen.findByLabelText("Party code"), party.id);
  await user.click(screen.getByRole("button", { name: "Join party" }));
  expect(await screen.findByRole("heading", { name: "Pod" })).toBeTruthy();
  expect(screen.getByText(/Ada Lovelace/)).toBeTruthy();
  expect(screen.getByText(/Bo Peep/)).toBeTruthy();
  expect(screen.getByRole("status").textContent).toMatch(/joined Pod/);
});

it("GM-12 shows an existing party loaded from the attendee", async () => {
  const { api, ada, view } = await setup();
  await api.createParty({ attendee_id: ada.id, name: "Returning" });
  view(ada.id);
  expect(await screen.findByRole("heading", { name: "Returning" })).toBeTruthy();
  expect(screen.queryByLabelText("Party name")).toBeNull();
});

it("GM-12 shows a readable error when the party is full", async () => {
  const { api, ada, user, view } = await setup();
  vi.spyOn(api, "joinParty").mockRejectedValue(
    new ApiError("party_full", "That party is full. Parties hold four adventurers.", 409),
  );
  view(ada.id);
  await user.type(await screen.findByLabelText("Party code"), "party-1");
  await user.click(screen.getByRole("button", { name: "Join party" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/party is full/);
});

it("WEB-9 labels inputs and asks for a name or code instead of calling the API when empty", async () => {
  const { api, ada, user, view } = await setup();
  const create = vi.spyOn(api, "createParty");
  const join = vi.spyOn(api, "joinParty");
  view(ada.id);
  await user.click(await screen.findByRole("button", { name: "Create party" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/name/);
  await user.click(screen.getByRole("button", { name: "Join party" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/code/);
  expect(create).not.toHaveBeenCalled();
  expect(join).not.toHaveBeenCalled();
});

it("WEB-1 asks someone without an adventurer to create one first", async () => {
  await setup();
  render(
    <PartyView
      conf="conf-demo"
      api={() => createApi(createFakeTransport(sessionStorage))}
      attendeeId={() => null}
    />,
  );
  expect(await screen.findByRole("link", { name: /Create your adventurer/ })).toBeTruthy();
});
