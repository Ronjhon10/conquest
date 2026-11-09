"use client";
// Speaker recognition (040 /s/[speaker], WEB-8): the coins attendees gave and their thank-you notes.
// Coins are respect, not a ranking: no comparison with other speakers.
import { useEffect, useState } from "react";
import type { Speaker, SpeakerRecognition, Talk } from "@conquest/contracts";
import { type Api, getApi, readableError } from "../lib/api";
import { ErrorNotice, LoadingNotice, PageHeading, Panel } from "./ui";

type Loaded = { recognition: SpeakerRecognition; speaker: Speaker | null; talks: Talk[] };

export function SpeakerView({ speakerId, api = getApi }: { speakerId: string; api?: () => Api }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    const client = api();
    Promise.all([
      client.recognition(speakerId),
      // The profile only adds a name and talk titles; recognition still shows without it.
      client.speaker(speakerId).catch(() => null),
    ])
      .then(([r, s]) => {
        if (active) setData({ recognition: r.recognition, speaker: s?.speaker ?? null, talks: s?.talks ?? [] });
      })
      .catch((e: unknown) => active && setError(readableError(e)));
    return () => {
      active = false;
    };
  }, [speakerId, api, attempt]);

  if (error) return <ErrorNotice message={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!data) return <LoadingNotice />;

  const { recognition, speaker, talks } = data;
  const titles = new Map(talks.map((t) => [t.id, t.title]));
  const coins = recognition.coins;

  return (
    <div className="speaker-view">
      <PageHeading eyebrow="For speakers" title={speaker ? `Thank you, ${speaker.name}` : "Your knowledge made a difference"}>
        Attendees gave you coins and notes after your talks.
      </PageHeading>
      <Panel title="Coins received">
        <p className="speaker-coins">
          <span className="speaker-coins__count cq-slab" style={{ fontSize: "2.5rem" }}>{coins}</span> {coins === 1 ? "coin" : "coins"} from attendees
        </p>
      </Panel>
      <Panel title="Thank-you notes">
        {recognition.notes.length === 0 ? (
          <p className="empty-state">No notes yet. They appear here as attendees give coins.</p>
        ) : (
          <ul className="speaker-notes" style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
            {recognition.notes.map((n, i) => (
              <li key={`${n.talk_id}-${n.at}-${i}`} className="cq-card">
                <blockquote>{n.note || "(a coin, no note)"}</blockquote>
                <p className="speaker-notes__from">
                  {n.from_name}
                  {titles.get(n.talk_id) ? ` · ${titles.get(n.talk_id)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
