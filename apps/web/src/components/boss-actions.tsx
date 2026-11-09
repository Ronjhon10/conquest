"use client";
// Boss page actions (040 /c/[conf]/boss/[talk], WEB-6): Check in, Take photo, Give coin.
// The XP result of every action is announced in one aria-live region (040 Behavior 1).
// The photo taken for XP stays on the device: it is never read or uploaded (000 Non-goals).
import { useId, useState, type ChangeEvent } from "react";
import type { Attendee, XpKind, XpResponse } from "@conquest/contracts";
import { getApi, readableError, type Api } from "../lib/api";
import { CoinButton } from "./coin";

/** The sentence the live region reads after an XP award. */
export function xpMessage(result: XpResponse, before: Attendee): string {
  const { event, attendee } = result;
  const what = event.kind === "checkin" ? "Checked in" : event.kind === "photo" ? "Photo taken" : "Done";
  const parts = [`${what}: +${event.xp} XP.`];
  if (event.multiplier > 1) parts.push(`Party bonus x${event.multiplier}.`);
  if (attendee.level > before.level) parts.push(`Level up! You are now level ${attendee.level}.`);
  parts.push(`Total ${attendee.xp} XP.`);
  return parts.join(" ");
}

export function BossActions({
  attendee: initial,
  talkId,
  speakerName,
  api = getApi,
}: {
  attendee: Attendee;
  talkId: string;
  speakerName?: string;
  api?: () => Api;
}) {
  const photoId = useId();
  const [attendee, setAttendee] = useState(initial);
  const [pending, setPending] = useState<XpKind | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function award(kind: XpKind) {
    if (pending) return;
    setPending(kind);
    setError("");
    setMessage("");
    try {
      const result = await api().awardXp({ attendee_id: attendee.id, kind, talk_id: talkId });
      setMessage(xpMessage(result, attendee));
      setAttendee(result.attendee);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setPending(null);
    }
  }

  function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    // Taking the photo is what earns XP; the file itself is dropped right away.
    const taken = Boolean(e.target.files?.length);
    e.target.value = "";
    if (taken) void award("photo");
  }

  return (
    <div className="boss-actions">
      <section className="panel cq-card" aria-label="Earn XP">
        <h2>Earn XP</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <button type="button" className="cq-btn" disabled={pending !== null} onClick={() => void award("checkin")}>
            {pending === "checkin" ? "Checking in…" : "Check in"}
          </button>
          <label htmlFor={photoId} className="cq-btn cq-btn--secondary" aria-disabled={pending !== null}>
            {pending === "photo" ? "Saving…" : "Take photo"}
          </label>
          <input
            id={photoId}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={pending !== null}
            onChange={onPhoto}
          />
        </div>
        <p className="cq-label">Your photo stays on your phone. Only the XP is saved.</p>
        <div aria-live="polite" role="status">
          {message && <p><strong>{message}</strong></p>}
        </div>
        {error && <p role="alert">{error}</p>}
      </section>
      <CoinButton
        attendeeId={attendee.id}
        talkId={talkId}
        speakerName={speakerName}
        coins={attendee.coins}
        onGiven={(r) => setAttendee(r.attendee)}
        api={api}
      />
    </div>
  );
}
