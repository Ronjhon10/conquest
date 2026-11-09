"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  Ally,
  Attendee,
  Conference,
  LeaderboardRow,
  Talk,
} from "@conquest/contracts";
import { Avatar } from "./avatar";
import { currentAttendee, forgetAttendee } from "../lib/identity";
import { ApiError, getApi, readableError } from "../lib/api";
import { formatTalkTime } from "../lib/time";
import {
  ErrorNotice,
  LoadingNotice,
  PageHeading,
  Panel,
  themeStyle,
} from "./ui";

const labels: Record<string, string> = {
  join: "Create your adventurer",
  map: "Your dungeon map",
  boss: "Your next talk",
  connect: "Your allies",
  party: "Your party",
  recap: "Your recap",
  new: "Create a conference",
  setup: "Conference setup",
  live: "Live leaderboard",
  report: "Conference report",
  theme: "Theme studio",
  speaker: "Speaker recognition",
};
export type PreviewData = {
  conference: Conference;
  talks: Talk[];
  attendee: Attendee | null;
  rows: LeaderboardRow[];
  allies?: Ally[];
};
export function RouteContent({
  data,
  view,
  conf,
  talkId,
}: {
  data: PreviewData;
  view: string;
  conf: string;
  talkId?: string;
}) {
  const { conference, attendee, talks, rows } = data;
  const organizer = ["new", "setup", "live", "report", "theme"].includes(view);
  const selectedTalk = talks.find((t) => t.id === talkId);
  return (
    <div>
      <PageHeading
        eyebrow={
          organizer
            ? "For organizers"
            : view === "speaker"
              ? "For speakers"
              : conference.name
        }
        title={labels[view] ?? "Your adventure"}
      >
        {view === "map"
          ? "Follow your curiosity. These sessions are the next stops on your journey."
          : "Your talks, quests, and conference connections."}
      </PageHeading>
      <nav
        className="section-nav"
        aria-label={organizer ? "Organizer pages" : "Attendee pages"}
      >
        {(organizer
          ? [
              ["setup", "Overview"],
              ["theme", "Theme studio"],
              ["live", "Leaderboard"],
              ["report", "Report"],
            ]
          : [
              ["join", "Join"],
              ["map", "Map"],
              ["connect", "Allies"],
              ["party", "Party"],
              ["recap", "Recap"],
            ]
        ).map(([key, label]) => (
          <Link
            key={key}
            aria-current={key === view ? "page" : undefined}
            href={
              organizer
                ? `/organizer/${encodeURIComponent(conf)}${key === "setup" ? "" : `/${key}`}`
                : `/c/${encodeURIComponent(conf)}/${key}`
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      <p className="preview-note">Conference preview</p>
      {attendee && !organizer && view !== "join" && (
        <div className="player-strip">
          <Avatar
            name={attendee.name}
            photo={attendee.photo}
            characterClass={attendee.class}
            seed={attendee.avatar_seed}
          />
          <div>
            <strong>{attendee.name}</strong>
            <span>
              {attendee.class} · Level {attendee.level}
            </span>
          </div>
          <div>
            <strong>{attendee.xp}</strong>
            <span>experience points</span>
          </div>
          <div>
            <strong>{attendee.coins}</strong>
            <span>speaker coins</span>
          </div>
        </div>
      )}
      {view === "map" ? (
        <div className="preview-grid">
          <section
            className="dungeon-surface"
            style={themeStyle(conference.theme)}
          >
            <p className="cq-label">{conference.theme.name}</p>
            <h2>Your {conference.theme.boss_noun} trail</h2>
            <p>{conference.theme.intro}</p>
            <ol className="talk-list">
              {(attendee?.map ?? []).map((boss) => {
                const talk = talks.find((t) => t.id === boss.talk_id);
                return talk ? (
                  <li className="cq-card" key={talk.id}>
                    <div className="talk-meta">
                      {formatTalkTime(talk.starts_at)} · {talk.room}
                    </div>
                    <Link
                      href={`/c/${encodeURIComponent(conf)}/boss/${encodeURIComponent(talk.id)}`}
                    >
                      {talk.title}
                    </Link>
                    <p>{boss.reason}</p>
                  </li>
                ) : null;
              })}
            </ol>
          </section>
          <Panel title="Your quests">
            {(attendee?.quests ?? conference.quests).map((q) => (
              <p key={q.id}>
                <strong>{q.title}</strong>
                <br />
                {q.description}
              </p>
            ))}
          </Panel>
        </div>
      ) : view === "live" ? (
        <Panel title="The leaderboard">
          <table className="leaderboard">
            <caption>Conference adventurers, ranked by XP</caption>
            <thead>
              <tr>
                <th scope="col">Adventurer</th>
                <th scope="col">Class</th>
                <th scope="col">Level</th>
                <th scope="col">XP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.attendee_id}>
                  <th scope="row">
                    <span className="avatar-name">
                      <Avatar
                        name={row.name}
                        photo={row.photo}
                        characterClass={row.class}
                        seed={row.avatar_seed}
                        size={44}
                      />
                      {row.name}
                    </span>
                  </th>
                  <td>{row.class}</td>
                  <td>{row.level}</td>
                  <td>{row.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : view === "connect" ? (
        <Panel title="Your allies">
          {(data.allies ?? []).length ? (
            <ul className="allies-list">
              {data.allies?.map((ally) => (
                <li key={ally.attendee_id}>
                  <Avatar
                    name={ally.name}
                    photo={ally.photo}
                    seed={ally.attendee_id}
                  />
                  <div>
                    <strong>{ally.name}</strong>
                    <p>{ally.headline}</p>
                    <a
                      href={ally.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on LinkedIn
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>People you connect with at the conference will appear here.</p>
          )}
        </Panel>
      ) : view === "boss" ? (
        <Panel title={selectedTalk?.title ?? "Choose a talk from your map"}>
          {selectedTalk && (
            <>
              <p>{selectedTalk.abstract}</p>
              <p>
                {formatTalkTime(selectedTalk.starts_at)} · {selectedTalk.room}
              </p>
            </>
          )}
          <Link
            className="text-link"
            href={`/c/${encodeURIComponent(conf)}/map`}
          >
            Back to your map
          </Link>
        </Panel>
      ) : view === "theme" || view === "setup" || view === "new" ? (
        <div className="preview-grid">
          <Panel title="Your conference theme">
            <p>
              Describe your conference’s atmosphere, subject, and sense of
              adventure. The theme studio will bring it to your map.
            </p>
            <p className="empty-state">
              Theme editing and conference setup are coming soon.
            </p>
          </Panel>
          <section
            className="dungeon-surface"
            style={themeStyle(conference.theme)}
          >
            <p className="cq-label">Current theme</p>
            <h2>{conference.theme.name}</h2>
            <p>{conference.theme.intro}</p>
          </section>
        </div>
      ) : (
        <Panel
          title={
            view === "join"
              ? "Choose your own adventure"
              : view === "connect"
                ? "Every great quest starts with hello"
                : view === "party"
                  ? "Gather your fellow adventurers"
                  : view === "recap"
                    ? "Bring the best moments home"
                    : view === "speaker"
                      ? "Your knowledge made a difference"
                      : "The conference in perspective"
          }
        >
          <p>
            {view === "join"
              ? "Your LinkedIn profile, a character, and a few goals will become your personal path through the conference."
              : view === "connect"
                ? "Scan a code, make an ally, and keep the conversation going."
                : view === "party"
                  ? "Discover talks together and celebrate each other’s progress."
                  : view === "recap"
                    ? "Your talks, new connections, and favorite discoveries in one shareable story."
                    : view === "speaker"
                      ? "Attendee coins and thank-you notes will appear here."
                      : "Participation, discoveries, and connections will come together in your after-action report."}
          </p>
          <p className="empty-state">This feature is coming soon.</p>
        </Panel>
      )}
    </div>
  );
}
export function RoutePreview({
  view,
  conf = "conf-demo",
  talkId,
}: {
  view: string;
  conf?: string;
  talkId?: string;
}) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    const api = getApi();
    // Only fake mode uses the seeded attendee. Live mode waits for signup/local identity.
    const attendeeId =
      currentAttendee(conf) ??
      (process.env.NEXT_PUBLIC_FAKE_API === "1" ? "att-jane" : null);
    // New-conference and speaker shells have no conference to load in live mode.
    if (
      (view === "new" || view === "speaker") &&
      process.env.NEXT_PUBLIC_FAKE_API !== "1"
    )
      return () => {
        active = false;
      };
    const attendeeRequest = attendeeId
      ? api.attendee(attendeeId).catch((error: unknown) => {
          if (
            process.env.NEXT_PUBLIC_FAKE_API === "1" &&
            attendeeId !== "att-jane" &&
            error instanceof ApiError &&
            error.status === 404
          ) {
            forgetAttendee(conf);
            return api.attendee("att-jane");
          }
          throw error;
        })
      : Promise.resolve(null);
    Promise.all([
      api.conference(conf),
      api.talks(),
      attendeeRequest,
      view === "live" ? api.leaderboard(conf) : Promise.resolve({ rows: [] }),
    ])
      .then(([conference, talks, attendee, leaderboard]) => {
        if (active)
          setData({
            conference: conference.conference,
            talks: talks.results.map((r) => r.talk),
            attendee: attendee?.attendee ?? null,
            rows: leaderboard.rows,
            allies: attendee?.allies ?? [],
          });
      })
      .catch((e) => {
        if (active) setError(readableError(e));
      });
    return () => {
      active = false;
    };
  }, [conf, view, attempt]);
  const standalone =
    (view === "new" || view === "speaker") &&
    process.env.NEXT_PUBLIC_FAKE_API !== "1";
  return (
    <div className="page-container">
      {error ? (
        <ErrorNotice message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : data ? (
        <RouteContent data={data} view={view} conf={conf} talkId={talkId} />
      ) : standalone ? (
        <>
          <PageHeading
            eyebrow="Conquest"
            title={labels[view] ?? "Your adventure"}
          />
          <p>This feature is coming soon.</p>
        </>
      ) : (
        <LoadingNotice />
      )}
    </div>
  );
}
