"use client";
// Pick a conference first (Play and Organize). An attendee's character belongs to one conference:
// this device remembers one character per conference, so each card says Join or Continue.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ConferenceSummary } from "@conquest/contracts";
import { getApi, readableError, type Api } from "../lib/api";
import { currentAttendee } from "../lib/identity";
import { ErrorNotice, LoadingNotice, PageHeading } from "./ui";

export function ConferencePicker({
  mode,
  api = getApi,
}: {
  mode: "play" | "organize";
  api?: () => Api;
}) {
  const [list, setList] = useState<ConferenceSummary[] | null>(null);
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    api()
      .conferences()
      .then((r) => {
        if (!active) return;
        setList(r.conferences);
        setJoined(Object.fromEntries(r.conferences.map((c) => [c.id, Boolean(currentAttendee(c.id))])));
      })
      .catch((e: unknown) => active && setError(readableError(e)));
    return () => {
      active = false;
    };
  }, [api, attempt]);

  const play = mode === "play";
  return (
    <div className="page-container">
      <PageHeading eyebrow={play ? "Play" : "Organize"} title={play ? "Which conference are you at?" : "Your conferences"}>
        {play
          ? "Your character belongs to one conference. Pick yours to join or to continue."
          : "Open a conference to see its setup, live leaderboard and report."}
      </PageHeading>
      {!play && (
        <p>
          <Link className="cq-btn" href="/organizer/new">
            Create a conference
          </Link>
        </p>
      )}
      {error ? (
        <ErrorNotice message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !list ? (
        <LoadingNotice />
      ) : list.length === 0 ? (
        <p>No conferences yet.</p>
      ) : (
        <ul className="conference-list" style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
          {list.map((c) => {
            const conf = encodeURIComponent(c.id);
            const mine = joined[c.id];
            const href = play ? `/c/${conf}/${mine ? "map" : "join"}` : `/organizer/${conf}`;
            return (
              <li key={c.id} className="panel cq-card" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <h2 style={{ margin: 0 }}>{c.name}</h2>
                  <p className="cq-label" style={{ margin: 0 }}>{c.theme_name}</p>
                </div>
                <Link className="cq-btn" href={href} aria-label={`${play ? (mine ? "Continue" : "Join") : "Open"} ${c.name}`}>
                  {play ? (mine ? "Continue" : "Join") : "Open"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
