// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type Api } from "../lib/api";
import { CoinButton } from "./coin";

afterEach(cleanup);

const gift = {
  id: "g1",
  conference_id: "c1",
  from_attendee_id: "a1",
  speaker_id: "s1",
  talk_id: "t1",
  note: "Great talk",
  at: "2026-11-09T12:00:00Z",
};
function fakeApi(giveCoin: ReturnType<typeof vi.fn>) {
  return (() => ({ giveCoin }) as unknown as Api) as () => Api;
}
const response = (coins: number) => ({ gift, attendee: { coins } });

it("GM-13 sends the talk, attendee and note and shows the coins left", async () => {
  const giveCoin = vi.fn().mockResolvedValue(response(2));
  const onGiven = vi.fn();
  render(
    <CoinButton
      attendeeId="a1"
      talkId="t1"
      speakerName="Ada"
      coins={3}
      onGiven={onGiven}
      api={fakeApi(giveCoin)}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Thank-you note/), "Great talk");
  await user.click(screen.getByRole("button", { name: /Give a coin/ }));
  await waitFor(() => expect(onGiven).toHaveBeenCalled());
  expect(giveCoin).toHaveBeenCalledWith({
    from_attendee_id: "a1",
    talk_id: "t1",
    note: "Great talk",
  });
  expect(screen.getByRole("status").textContent).toContain(
    "Coin given to Ada. You have 2 coins left.",
  );
});

it("WEB-6 announces the result in an aria-live region", () => {
  render(
    <CoinButton attendeeId="a1" talkId="t1" coins={1} api={fakeApi(vi.fn())} />,
  );
  expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
});

it("GM-13 disables the button when the attendee has 0 coins", async () => {
  const giveCoin = vi.fn();
  render(
    <CoinButton
      attendeeId="a1"
      talkId="t1"
      coins={0}
      api={fakeApi(giveCoin)}
    />,
  );
  const button = screen.getByRole("button", { name: /No coins left/ });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  await userEvent.setup().click(button);
  expect(giveCoin).not.toHaveBeenCalled();
});

it("WEB-6 disables while pending and prevents double gifts", async () => {
  let resolve!: (v: unknown) => void;
  const giveCoin = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
  render(
    <CoinButton
      attendeeId="a1"
      talkId="t1"
      coins={3}
      api={fakeApi(giveCoin)}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Give a coin/ }));
  const busy = screen.getByRole("button", { name: /Giving coin/ });
  expect((busy as HTMLButtonElement).disabled).toBe(true);
  await user.click(busy);
  expect(giveCoin).toHaveBeenCalledTimes(1);
  resolve(response(2));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("2 coins left"),
  );
});

it("GM-13 shows a readable error and keeps the coin when giving fails", async () => {
  const giveCoin = vi
    .fn()
    .mockRejectedValue(
      new ApiError(
        "no_checkin",
        "Check in to this talk before giving a coin.",
        409,
      ),
    );
  const onGiven = vi.fn();
  render(
    <CoinButton
      attendeeId="a1"
      talkId="t1"
      coins={3}
      onGiven={onGiven}
      api={fakeApi(giveCoin)}
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: /Give a coin/ }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Check in to this talk before giving a coin.",
  );
  expect(onGiven).not.toHaveBeenCalled();
  expect(screen.getByText(/You have 3 coins/)).toBeTruthy();
});
