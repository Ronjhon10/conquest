// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createApi, type Transport } from "../lib/api";
import { linkedInShareUrl, RecapView } from "./recap";
import { SpeakerView } from "./speaker";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const recap = {
  post_text: "Defeated 4 bosses and made 3 allies at KubeCon. #Conquest",
  stats: { bosses: 4, allies: 3, xp: 820, level: 5, coins_given: 2 },
};
const fixed = (routes: Record<string, unknown>): Transport => async (path) => {
  const hit = Object.entries(routes).find(([p]) => path.startsWith(p));
  if (!hit) throw new Error(`unexpected ${path}`);
  return hit[1];
};

it("WEB-8 the recap page shows the stats and post, and Copy puts the post on the clipboard", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const api = createApi(fixed({ "/api/game/attendees/att-1/recap": { recap } }));
  render(<RecapView conf="conf-1" attendeeId="att-1" api={() => api} />);

  expect(await screen.findByText(recap.post_text)).toBeTruthy();
  expect(screen.getByText("Bosses defeated").nextElementSibling?.textContent).toBe("4");
  expect(screen.getByText("XP earned").nextElementSibling?.textContent).toBe("820");
  await user.click(screen.getByRole("button", { name: "Copy post" }));
  expect(writeText).toHaveBeenCalledWith(recap.post_text);
  expect(await screen.findByText("Copied to your clipboard.")).toBeTruthy();
  const share = screen.getByRole("link", { name: /Share on LinkedIn/ });
  expect(share.getAttribute("href")).toBe(linkedInShareUrl(recap.post_text));
});

it("WEB-8 the recap page asks to join first when this device has no attendee", async () => {
  render(<RecapView conf="conf-1" attendeeId={null} api={() => createApi(fixed({}))} />);
  expect((await screen.findByRole("link", { name: "Create your character" })).getAttribute("href")).toBe("/c/conf-1/join");
});

it("WEB-8 the speaker page shows coins received and thank-you notes with talk titles", async () => {
  const api = createApi(
    fixed({
      "/api/game/speakers/spk-ada/recognition": {
        recognition: {
          speaker_id: "spk-ada",
          coins: 2,
          notes: [{ from_name: "Jane", note: "Loved the golden paths!", talk_id: "talk-1", at: "2026-11-10T19:00:00Z" }],
        },
      },
      "/api/search/speakers/spk-ada": {
        speaker: { id: "spk-ada", name: "Ada Fixture", company: null, bio: "", photo_url: null },
        talks: [
          {
            id: "talk-1", title: "Platform Engineering Without Tears", abstract: "", speaker_ids: ["spk-ada"], room: "Hall A",
            starts_at: "2026-11-10T16:00:00Z", ends_at: "2026-11-10T16:30:00Z", track: null, level: null, tags: [],
          },
        ],
      },
    }),
  );
  render(<SpeakerView speakerId="spk-ada" api={() => api} />);
  expect(await screen.findByText("Thank you, Ada Fixture")).toBeTruthy();
  expect(screen.getByText("2").closest("p")?.textContent).toContain("2 coins from attendees");
  expect(screen.getByText("Loved the golden paths!")).toBeTruthy();
  expect(screen.getByText(/Jane · Platform Engineering Without Tears/)).toBeTruthy();
});
