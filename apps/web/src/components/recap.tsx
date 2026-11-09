"use client";
// Attendee recap (040 /c/[conf]/recap, WEB-8): stats, the generated post, Copy, and a LinkedIn
// share link that only opens LinkedIn with the text (nothing is posted for the attendee).
import { useEffect, useState } from "react";
import type { Recap } from "@conquest/contracts";
import { type Api, getApi, readableError } from "../lib/api";
import { currentAttendee } from "../lib/identity";
import { ActionLink, ErrorNotice, LoadingNotice, PageHeading, Panel } from "./ui";

export const linkedInShareUrl = (text: string) =>
  `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;

const STATS: { key: keyof Recap["stats"]; label: string }[] = [
  { key: "bosses", label: "Bosses defeated" },
  { key: "allies", label: "Allies made" },
  { key: "xp", label: "XP earned" },
  { key: "level", label: "Level reached" },
  { key: "coins_given", label: "Coins given to speakers" },
];

const statsGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.75rem" } as const;

export function RecapView({
  conf,
  attendeeId,
  api = getApi,
}: {
  conf: string;
  /** Defaults to the attendee remembered for this conference on this device. */
  attendeeId?: string | null;
  api?: () => Api;
}) {
  const [who, setWho] = useState<string | null | undefined>(attendeeId);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setWho(attendeeId ?? currentAttendee(conf));
  }, [attendeeId, conf]);

  useEffect(() => {
    if (!who) return;
    let active = true;
    setError("");
    api()
      .recap(who)
      .then((r) => active && setRecap(r.recap))
      .catch((e: unknown) => active && setError(readableError(e)));
    return () => {
      active = false;
    };
  }, [who, api, attempt]);

  async function copy() {
    if (!recap) return;
    try {
      await navigator.clipboard.writeText(recap.post_text);
      setCopied("Copied to your clipboard.");
    } catch {
      setCopied("Couldn't copy. Select the text and copy it yourself.");
    }
  }

  if (who === null)
    return (
      <div className="recap-view">
        <PageHeading eyebrow="Your recap" title="Join the adventure first" />
        <ActionLink href={`/c/${conf}/join`}>Create your character</ActionLink>
      </div>
    );
  if (error) return <ErrorNotice message={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!recap) return <LoadingNotice />;

  return (
    <div className="recap-view">
      <PageHeading eyebrow="Your recap" title="Bring the best moments home">
        What you got out of the conference, ready to share.
      </PageHeading>
      <Panel title="Your conference in numbers">
        <dl className="recap-stats" style={statsGrid}>
          {STATS.map(({ key, label }) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{recap.stats[key]}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title="Your post">
        <p className="recap-post" id="recap-post" style={{ whiteSpace: "pre-wrap" }}>
          {recap.post_text}
        </p>
        <div className="actions">
          <button type="button" className="cq-btn" onClick={copy} aria-describedby="recap-post">
            Copy post
          </button>
          <a
            className="cq-btn cq-btn--secondary"
            href={linkedInShareUrl(recap.post_text)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Share on LinkedIn (opens in a new tab)"
          >
            Share on LinkedIn ↗
          </a>
        </div>
        <p role="status" aria-live="polite" className="recap-copied">
          {copied}
        </p>
      </Panel>
    </div>
  );
}
