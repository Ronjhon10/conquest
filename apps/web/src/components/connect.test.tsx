// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as C from "@conquest/contracts";
import { ApiError, createApi, type Transport } from "../lib/api";
import { createFakeTransport } from "../lib/fake-api";
import { ConnectView } from "./connect";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(xp?: (body: unknown) => unknown) {
  const base = createFakeTransport(sessionStorage);
  const calls: unknown[] = [];
  const transport: Transport = async (path, init) => {
    if (path === "/api/game/xp") {
      const body = JSON.parse(String(init?.body));
      calls.push(body);
      return (xp ?? (() => ({})))(body);
    }
    return base(path, init);
  };
  const api = createApi(transport);
  render(<ConnectView conf="conf-demo" attendeeId="att-jane" api={() => api} />);
  return { calls, user: userEvent.setup() };
}
const xpResult = (xp: number, multiplier: number) => () => ({
  event: {
    id: "xp-1",
    conference_id: "conf-demo",
    attendee_id: "att-jane",
    kind: "network",
    talk_id: null,
    other_attendee_id: "att-sam",
    quest_id: null,
    party_id: null,
    base_xp: 20,
    multiplier,
    xp,
    at: "2026-11-09T18:05:00.000Z",
  },
  attendee: C.fixtures.attendee,
});

it("WEB-11 shows the code as text beside the QR", async () => {
  setup();
  const code = C.fixtures.attendee.code;
  expect(await screen.findByText(code)).toBeTruthy();
  const qr = await screen.findByRole("img", { name: new RegExp(code) });
  expect(qr.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
});

it("WEB-11 always offers a labelled typed-code field", async () => {
  setup();
  const input = await screen.findByLabelText(/Friend's code/);
  expect(input.tagName).toBe("INPUT");
});

it("WEB-6 submits a network award and announces XP and multiplier in an aria-live region", async () => {
  const { calls, user } = setup(xpResult(25, 1.25));
  await user.type(await screen.findByLabelText(/Friend's code/), "a7qx2m");
  await user.click(screen.getByRole("button", { name: /Connect/ }));
  expect(calls).toEqual([
    { attendee_id: "att-jane", kind: "network", other_code: "A7QX2M" },
  ]);
  await waitFor(() => {
    const live = document.querySelector("[aria-live]");
    expect(live?.textContent).toMatch(/25 XP/);
    expect(live?.textContent).toMatch(/1\.25/);
  });
});

it("WEB-6 shows a readable error when the code is rejected", async () => {
  const { user } = setup(() => {
    throw new ApiError("not_found", "We couldn't find that code.", 404);
  });
  await user.type(await screen.findByLabelText(/Friend's code/), "ZZZZZZ");
  await user.click(screen.getByRole("button", { name: /Connect/ }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "We couldn't find that code.",
  );
});

it("WEB-6 asks for a code before calling the API", async () => {
  const { calls, user } = setup();
  await user.click(await screen.findByRole("button", { name: /Connect/ }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/code/);
  expect(calls).toHaveLength(0);
});

it("WEB-11 lists allies from the attendee record", async () => {
  setup();
  const ally = C.fixtures.allies[0]!;
  expect(await screen.findByText(ally.name)).toBeTruthy();
});
