"use client";
// Organizer views (040 Pages): new conference, setup overview, live leaderboard, report.
// Quest and room editors and the theme studio are cut for the hackathon (BUILD.md W.5, W.5a);
// setup shows quests and rooms read-only.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import type { Conference, LeaderboardRow, Report } from "@conquest/contracts";
import { getApi, readableError, type Api } from "../lib/api";
import { Avatar } from "./avatar";
import { ErrorNotice, LoadingNotice, PageHeading, Panel, themeStyle } from "./ui";

const orgHref = (conf: string, view = "") =>
  `/organizer/${encodeURIComponent(conf)}${view ? `/${view}` : ""}`;

function OrganizerNav({ conf, view }: { conf: string; view: string }) {
  return (
    <nav className="section-nav" aria-label="Organizer pages">
      {[
        ["setup", "Overview"],
        ["live", "Leaderboard"],
        ["report", "Report"],
      ].map(([key, label]) => (
        <Link key={key} aria-current={key === view ? "page" : undefined} href={orgHref(conf, key === "setup" ? "" : key)}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

function useConference(conf: string, api: () => Api) {
  const [conference, setConference] = useState<Conference | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    api()
      .conference(conf)
      .then((r) => active && setConference(r.conference))
      .catch((e: unknown) => active && setError(readableError(e)));
    return () => {
      active = false;
    };
  }, [conf, api, attempt]);
  return { conference, error, retry: () => setAttempt((n) => n + 1) };
}

/** English plural for a theme noun ("boss" → "bosses", "chamber" → "chambers"). */
export const plural = (noun: string) => (/(s|x|z|ch|sh)$/i.test(noun) ? `${noun}es` : `${noun}s`);

export function NewConference({ api = getApi }: { api?: () => Api }) {
  const router = useRouter();
  const nameId = useId();
  const promptId = useId();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending || !name.trim()) return;
    setPending(true);
    setError("");
    try {
      const r = await api().createConference({ name: name.trim(), theme_prompt: prompt.trim() });
      router.push(orgHref(r.conference.id));
    } catch (err) {
      setError(readableError(err));
      setPending(false);
    }
  }

  return (
    <div className="page-container">
      <PageHeading eyebrow="For organizers" title="Create a conference">
        Name your conference and describe its theme. Conquest turns it into a dungeon for your attendees.
      </PageHeading>
      <Panel title="Your conference">
        <form onSubmit={submit} className="stack">
          <label htmlFor={nameId}>Conference name</label>
          <input id={nameId} value={name} required onChange={(e) => setName(e.target.value)} placeholder="KubeCon NA 2026" />
          <label htmlFor={promptId}>Theme prompt</label>
          <textarea
            id={promptId}
            value={prompt}
            rows={3}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A neon cloud-native fortress with container golems"
          />
          <button type="submit" className="cq-btn" disabled={pending || !name.trim()}>
            {pending ? "Creating your dungeon…" : "Create conference"}
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      </Panel>
    </div>
  );
}

export function OrganizerSetup({
  conf,
  dashboardUrl,
  api = getApi,
}: {
  conf: string;
  dashboardUrl?: string;
  api?: () => Api;
}) {
  const { conference, error, retry } = useConference(conf, api);
  if (error) return <ErrorNotice message={error} onRetry={retry} />;
  if (!conference) return <LoadingNotice />;
  const { theme } = conference;
  return (
    <div>
      <PageHeading eyebrow="For organizers" title={conference.name}>
        Share the signup link with attendees and put the leaderboard on a monitor.
      </PageHeading>
      <OrganizerNav conf={conf} view="setup" />
      <div className="preview-grid">
        <Panel title="Share with attendees">
          <p>
            <Link className="text-link" href={`/c/${encodeURIComponent(conf)}/join`}>
              Attendee signup link
            </Link>
          </p>
          <p>
            <Link className="text-link" href={orgHref(conf, "live")}>
              Live leaderboard for the monitor
            </Link>
          </p>
          {dashboardUrl && (
            <p>
              <a className="text-link" href={dashboardUrl} target="_blank" rel="noopener noreferrer">
                Conquest live dashboard in Dash0
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          )}
        </Panel>
        <section className="dungeon-surface" style={themeStyle(theme)}>
          <p className="cq-label">Current theme</p>
          <h2>{theme.name}</h2>
          <p>{theme.intro}</p>
          <p>
            Talks are {plural(theme.boss_noun)}, rooms are {plural(theme.room_noun)}.
          </p>
          <ul aria-label="Theme palette" style={{ display: "flex", gap: "0.5rem", listStyle: "none", padding: 0 }}>
            {(["bg", "fg", "accent"] as const).map((k) => (
              <li key={k}>
                <span
                  aria-hidden="true"
                  style={{ display: "inline-block", width: 24, height: 24, background: theme.palette[k], border: "2px solid currentColor", verticalAlign: "middle" }}
                />{" "}
                {k} {theme.palette[k]}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <Panel title="Quests">
        {conference.quests.length ? (
          <ul>
            {conference.quests.map((q) => (
              <li key={q.id}>
                <strong>{q.title}</strong> · {q.xp} XP{q.sponsor ? ` · sponsored by ${q.sponsor}` : ""}
                <br />
                {q.description}
              </li>
            ))}
          </ul>
        ) : (
          <p>No conference quests yet.</p>
        )}
      </Panel>
      <Panel title="Rooms">
        <ul>
          {conference.rooms.map((r) => (
            <li key={r.name}>
              {r.name}: {r.step_free ? "step-free" : "not step-free"}
              {r.step_free_note ? ` (${r.step_free_note})` : ""}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export const LIVE_REFRESH_MS = 5000;

export function LiveLeaderboard({ conf, api = getApi }: { conf: string; api?: () => Api }) {
  const { conference } = useConference(conf, api);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = () => {
      const client = api();
      client
        .leaderboard(conf)
        .then((r) => {
          if (!active) return;
          setRows(r.rows.slice(0, 10));
          setError("");
        })
        .catch((e: unknown) => active && setError(readableError(e)));
      // Counts are a nice-to-have: the board still shows without them.
      client
        .report(conf)
        .then((r) => active && setReport(r.report))
        .catch(() => undefined);
    };
    load();
    const timer = setInterval(load, LIVE_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [conf, api]);

  return (
    <div>
      <PageHeading eyebrow={conference?.name ?? "Live"} title="Live leaderboard">
        Updates every 5 seconds.
      </PageHeading>
      <OrganizerNav conf={conf} view="live" />
      {report && (
        <dl className="live-counts" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.75rem" }}>
          {(
            [
              ["Adventurers", report.attendees],
              ["Check-ins", report.checkins],
              ["Allies made", report.connections],
              ["Parties", report.parties],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="cq-card panel">
              <dt>{label}</dt>
              <dd className="cq-slab" style={{ fontSize: "2.5rem", margin: 0 }}>{n}</dd>
            </div>
          ))}
        </dl>
      )}
      {error && !rows ? <ErrorNotice message={error} /> : !rows ? <LoadingNotice /> : (
        <Panel title="Top 10">
          <table className="leaderboard">
            <caption>Conference adventurers, ranked by XP</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Adventurer</th>
                <th scope="col">Class</th>
                <th scope="col">Level</th>
                <th scope="col">XP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.attendee_id}>
                  <td>{i + 1}</td>
                  <th scope="row">
                    <span className="avatar-name">
                      <Avatar name={row.name} photo={row.photo} characterClass={row.class} seed={row.avatar_seed} size={44} />
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
      )}
    </div>
  );
}

export function ReportView({ conf, api = getApi }: { conf: string; api?: () => Api }) {
  const { conference } = useConference(conf, api);
  const [report, setReport] = useState<Report | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    const client = api();
    client
      .report(conf)
      .then(async (r) => {
        if (!active) return;
        setReport(r.report);
        // Talk titles are optional decoration; ids show if a lookup fails.
        const found = await Promise.allSettled(r.report.top_talks.map((t) => client.talk(t.talk_id)));
        if (active)
          setTitles(Object.fromEntries(found.flatMap((f) => (f.status === "fulfilled" ? [[f.value.talk.id, f.value.talk.title]] : []))));
      })
      .catch((e: unknown) => active && setError(readableError(e)));
    return () => {
      active = false;
    };
  }, [conf, api, attempt]);

  // Conference quests by title; each attendee's personal goal quests are summed into one line.
  const conferenceQuests = report?.quest_completion.filter((q) => conference?.quests.some((c) => c.id === q.quest_id)) ?? [];
  const goalQuestsDone = (report?.quest_completion ?? [])
    .filter((q) => !conferenceQuests.includes(q))
    .reduce((n, q) => n + q.completed, 0);
  const questTitle = (id: string) => conference?.quests.find((q) => q.id === id)?.title ?? id;

  return (
    <div>
      <PageHeading eyebrow={conference?.name ?? "Report"} title="Conference report">
        What your attendees did, from Elasticsearch aggregations.
      </PageHeading>
      <OrganizerNav conf={conf} view="report" />
      {error ? <ErrorNotice message={error} onRetry={() => setAttempt((n) => n + 1)} /> : !report ? <LoadingNotice /> : (
        <>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.75rem" }}>
            {(
              [
                ["Attendees", report.attendees],
                ["Check-ins", report.checkins],
                ["Photos", report.photos],
                ["Connections", report.connections],
                ["Parties", report.parties],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="cq-card panel">
                <dt>{label}</dt>
                <dd className="cq-slab" style={{ fontSize: "2rem", margin: 0 }}>{n}</dd>
              </div>
            ))}
          </dl>
          <Panel title="Most checked-in talks">
            {report.top_talks.length ? (
              <ol>
                {report.top_talks.map((t) => (
                  <li key={t.talk_id}>
                    {titles[t.talk_id] ?? t.talk_id}: {t.checkins} check-ins
                  </li>
                ))}
              </ol>
            ) : (
              <p>No check-ins yet.</p>
            )}
          </Panel>
          <Panel title="Quest completion">
            {report.quest_completion.length ? (
              <ul>
                {conferenceQuests.map((q) => (
                  <li key={q.quest_id}>
                    {questTitle(q.quest_id)}: {q.completed} completed
                  </li>
                ))}
                {goalQuestsDone > 0 && <li>Personal goal quests: {goalQuestsDone} completed</li>}
              </ul>
            ) : (
              <p>No quests completed yet.</p>
            )}
          </Panel>
          <Panel title="XP by hour">
            <table className="leaderboard">
              <caption>XP earned per hour</caption>
              <thead>
                <tr>
                  <th scope="col">Hour</th>
                  <th scope="col">XP</th>
                </tr>
              </thead>
              <tbody>
                {report.xp_by_hour.map((h) => (
                  <tr key={h.hour}>
                    <td>{new Date(h.hour).toLocaleString([], { weekday: "short", hour: "numeric" })}</td>
                    <td>{h.xp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}
