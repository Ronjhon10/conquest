// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fixtures } from "@conquest/contracts";
import { createApi, type Transport } from "../lib/api";
import { BossActions } from "./boss-actions";
import { LIVE_REFRESH_MS, LiveLeaderboard, OrganizerSetup } from "./organizer";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const xpStatus = () => within(screen.getByRole("region", { name: "Earn XP" })).getByRole("status");
const attendee = { ...fixtures.attendee, xp: 90, level: 1, coins: 3 };
const xpEvent = (kind: "checkin" | "photo", base: number, multiplier: number) => ({
  id: "evt-1",
  conference_id: fixtures.conference.id,
  attendee_id: attendee.id,
  kind,
  talk_id: "talk-1",
  other_attendee_id: null,
  quest_id: null,
  party_id: null,
  base_xp: base,
  multiplier,
  xp: Math.round(base * multiplier),
  at: "2026-11-10T16:00:00.000Z",
});

it("WEB-6 check-in shows the XP gained, the party multiplier and a level-up in an aria-live region", async () => {
  const user = userEvent.setup();
  const calls: string[] = [];
  const transport: Transport = async (path, init) => {
    calls.push(`${init?.method ?? "GET"} ${path} ${init?.body ?? ""}`);
    return { event: xpEvent("checkin", 100, 1.25), attendee: { ...attendee, xp: 315, level: 2 } };
  };
  const api = createApi(transport);
  render(<BossActions attendee={attendee} talkId="talk-1" api={() => api} />);

  await user.click(screen.getByRole("button", { name: "Check in" }));
  const live = xpStatus();
  expect(live.getAttribute("aria-live")).toBe("polite");
  expect(await screen.findByText(/\+125 XP/)).toBeTruthy();
  expect(live.textContent).toContain("Party bonus x1.25");
  expect(live.textContent).toContain("Level up! You are now level 2.");
  expect(live.textContent).toContain("Quest complete: +100 XP.");
  expect(calls[0]).toContain('"kind":"checkin"');
  expect(calls[0]).toContain('"talk_id":"talk-1"');
});

it("WEB-6 taking a photo awards photo XP without uploading the photo", async () => {
  const user = userEvent.setup();
  const bodies: string[] = [];
  const api = createApi(async (_path, init) => {
    bodies.push(String(init?.body ?? ""));
    return { event: xpEvent("photo", 25, 1), attendee: { ...attendee, xp: 115 } };
  });
  render(<BossActions attendee={attendee} talkId="talk-1" api={() => api} />);

  await user.upload(screen.getByLabelText("Take photo"), new File(["jpeg"], "talk.jpg", { type: "image/jpeg" }));
  expect(await screen.findByText(/Photo taken: \+25 XP/)).toBeTruthy();
  expect(xpStatus().textContent).not.toContain("Party bonus");
  expect(bodies).toEqual([JSON.stringify({ attendee_id: attendee.id, kind: "photo", talk_id: "talk-1" })]);
});

it("WEB-7 the live leaderboard shows the top 10 with name, class, level and XP and refreshes every 5 s", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  let leaderboardCalls = 0;
  const rows = Array.from({ length: 12 }, (_, i) => ({
    ...fixtures.leaderboard[0],
    attendee_id: `att-${i}`,
    name: `Player ${i}`,
    xp: 1000 - i,
  }));
  const api = createApi(async (path) => {
    if (path.endsWith("/leaderboard")) {
      leaderboardCalls += 1;
      return { rows };
    }
    if (path.endsWith("/report")) throw new Error("no report");
    return { conference: fixtures.conference };
  });
  const stableApi = () => api;
  render(<LiveLeaderboard conf={fixtures.conference.id} api={stableApi} />);

  expect(await screen.findByText("Player 0")).toBeTruthy();
  expect(screen.getAllByRole("row")).toHaveLength(11); // header + top 10
  expect(screen.queryByText("Player 10")).toBeNull();
  for (const header of ["Adventurer", "Class", "Level", "XP"]) expect(screen.getByRole("columnheader", { name: header })).toBeTruthy();
  expect(leaderboardCalls).toBe(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LIVE_REFRESH_MS);
  });
  expect(leaderboardCalls).toBe(2);
});

it("WEB-13 the organizer page links to the Dash0 dashboard, and hides the link when the URL is unset", async () => {
  const api = createApi(async () => ({ conference: fixtures.conference }));
  const stableApi = () => api;
  const url = "https://app.dash0.com/dashboards/example";
  const { unmount } = render(<OrganizerSetup conf={fixtures.conference.id} dashboardUrl={url} api={stableApi} />);
  const link = await screen.findByRole("link", { name: /Conquest live dashboard in Dash0/ });
  expect(link.getAttribute("href")).toBe(url);
  expect(screen.getByRole("link", { name: "Attendee signup link" }).getAttribute("href")).toBe(
    `/c/${fixtures.conference.id}/join`,
  );
  unmount();
  render(<OrganizerSetup conf={fixtures.conference.id} api={stableApi} />);
  expect(await screen.findByRole("link", { name: "Attendee signup link" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Dash0/ })).toBeNull();
});

it("WEB-1 theme nouns read as English plurals on the organizer page", async () => {
  const { plural } = await import("./organizer");
  expect(plural("boss")).toBe("bosses");
  expect(plural("chamber")).toBe("chambers");
});
