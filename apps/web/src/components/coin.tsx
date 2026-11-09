"use client";

import { useId, useState } from "react";
import type { GiveCoinResponse } from "@conquest/contracts";
import { getApi, readableError, type Api } from "../lib/api";
import { Icon } from "./icon";

export interface CoinButtonProps {
  /** The attendee giving the coin (from_attendee_id). */
  attendeeId: string;
  /** The talk being recognised (talk_id). */
  talkId: string;
  /** Speaker's name, used in the labels. */
  speakerName?: string;
  /** The attendee's current coin count; 0 disables the button. */
  coins: number;
  /** Called with the API response after a coin is given, so the page can refresh. */
  onGiven?: (result: GiveCoinResponse) => void;
  /** Injectable API for tests; defaults to the shared client. */
  api?: () => Api;
}

const NOTE_MAX = 280;

export function CoinButton({
  attendeeId,
  talkId,
  speakerName,
  coins,
  onGiven,
  api = getApi,
}: CoinButtonProps) {
  const noteId = useId();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  const remaining = left ?? coins;
  const outOfCoins = remaining <= 0;
  const who = speakerName ?? "the speaker";

  async function give() {
    if (pending || outOfCoins) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await api().giveCoin({
        from_attendee_id: attendeeId,
        talk_id: talkId,
        note: note.trim(),
      });
      setLeft(result.attendee.coins);
      setNote("");
      setMessage(
        `Coin given to ${who}. You have ${result.attendee.coins} ${
          result.attendee.coins === 1 ? "coin" : "coins"
        } left.`,
      );
      onGiven?.(result);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel cq-card" aria-label="Give a coin">
      <h2>Give {who} a coin</h2>
      <p>
        You have {remaining} {remaining === 1 ? "coin" : "coins"}. A coin
        recognises a talk you checked in to.
      </p>
      <label htmlFor={noteId}>Thank-you note (optional)</label>
      <textarea
        id={noteId}
        value={note}
        maxLength={NOTE_MAX}
        rows={2}
        disabled={pending || outOfCoins}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        type="button"
        className="cq-btn"
        disabled={pending || outOfCoins}
        onClick={give}
      >
        {pending
          ? "Giving coin…"
          : outOfCoins
            ? "No coins left"
            : "Give a coin"}
        <Icon name="check" />
      </button>
      <div aria-live="polite" role="status">
        {message}
      </div>
      {error && (
        <p role="alert" className="error-notice">
          {error}
        </p>
      )}
    </section>
  );
}
