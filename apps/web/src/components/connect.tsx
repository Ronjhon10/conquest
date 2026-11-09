"use client";
import { useCallback, useEffect, useState } from "react";
import type { Ally, Attendee, XpEvent } from "@conquest/contracts";
import QRCode from "qrcode";
import { getApi, readableError, type Api } from "../lib/api";
import { currentAttendee } from "../lib/identity";
import { Avatar } from "./avatar";
import { Icon } from "./icon";
import { ErrorNotice, LoadingNotice, Panel } from "./ui";

/**
 * Attendee "connect" view (route /c/[conf]/connect).
 * Wire in with: <ConnectView conf={conf} />
 * `attendeeId` defaults to the signed-in attendee for `conf`; `api` defaults to getApi.
 */
export function ConnectView({
  conf,
  attendeeId,
  api = getApi,
}: {
  conf: string;
  attendeeId?: string;
  api?: () => Api;
}) {
  const [me, setMe] = useState<Attendee | null>(null);
  const [allies, setAllies] = useState<Ally[]>([]);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const id =
    attendeeId ??
    currentAttendee(conf) ??
    (process.env.NEXT_PUBLIC_FAKE_API === "1" ? "att-jane" : null);

  const load = useCallback(async () => {
    if (!id) return null;
    return api().attendee(id);
  }, [api, id]);

  useEffect(() => {
    let active = true;
    setLoadError("");
    load()
      .then((result) => {
        if (!active || !result) return;
        setMe(result.attendee);
        setAllies(result.allies);
      })
      .catch((e: unknown) => {
        if (active) setLoadError(readableError(e));
      });
    return () => {
      active = false;
    };
  }, [load, attempt]);

  if (!id)
    return (
      <Panel title="Your connection code">
        <p>Create your adventurer first, then your code will appear here.</p>
      </Panel>
    );
  if (loadError)
    return (
      <ErrorNotice
        message={loadError}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  if (!me) return <LoadingNotice />;

  return (
    <div className="preview-grid">
      <Panel title="Your code">
        <MyCode code={me.code} />
      </Panel>
      <Panel title="Meet an ally">
        <TypedCode
          attendeeId={me.id}
          api={api}
          onDone={() => setAttempt((n) => n + 1)}
          onAttendee={setMe}
        />
      </Panel>
      <Panel title="Your allies">
        {allies.length ? (
          <ul className="allies-list">
            {allies.map((ally) => (
              <li key={ally.attendee_id}>
                <Avatar
                  name={ally.name}
                  photo={ally.photo}
                  seed={ally.attendee_id}
                />
                <div>
                  <strong>{ally.name}</strong>
                  <p>{ally.headline}</p>
                  {ally.linkedin_url && (
                    <a
                      href={ally.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on LinkedIn
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>People you connect with at the conference will appear here.</p>
        )}
      </Panel>
    </div>
  );
}

function MyCode({ code }: { code: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toString(code, { type: "svg", margin: 1, width: 192 })
      .then((svg) => {
        if (active)
          setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (active) setSrc("");
      });
    return () => {
      active = false;
    };
  }, [code]);
  return (
    <div className="connect-code" style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          width={192}
          height={192}
          alt={`QR code for your connection code ${code}`}
          style={{ background: "#fff" }}
        />
      )}
      <div>
        <p className="cq-label">Your code</p>
        <p className="cq-slab" aria-label={`Your code is ${code.split("").join(" ")}`} style={{ fontSize: "2rem", letterSpacing: "0.15em" }}>
          {code}
        </p>
        <p>Show this to a friend, or read it out so they can type it in.</p>
      </div>
    </div>
  );
}

function TypedCode({
  attendeeId,
  api,
  onDone,
  onAttendee,
}: {
  attendeeId: string;
  api: () => Api;
  onDone: () => void;
  onAttendee: (a: Attendee) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [event, setEvent] = useState<XpEvent | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const other = value.trim().toUpperCase();
    setEvent(null);
    if (!other) {
      setError("Enter your friend's six-character code first.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await api().awardXp({
        attendee_id: attendeeId,
        kind: "network",
        other_code: other,
      });
      setEvent(result.event);
      onAttendee(result.attendee);
      setValue("");
      onDone();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} noValidate>
        <label htmlFor="friend-code">Friend's code</label>
        <input
          id="friend-code"
          name="friend-code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={6}
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          aria-describedby={error ? "friend-code-error" : undefined}
          aria-invalid={error ? true : undefined}
        />
        <button className="cq-btn" type="submit" disabled={busy}>
          {busy ? "Connecting…" : "Connect"} <Icon name="arrow-right" />
        </button>
      </form>
      {error && (
        <p id="friend-code-error" role="alert">
          {error}
        </p>
      )}
      <div aria-live="polite" aria-atomic="true">
        {event && (
          <p>
            New ally! You gained <strong>{event.xp} XP</strong> (multiplier ×
            {event.multiplier}).
          </p>
        )}
      </div>
    </>
  );
}
