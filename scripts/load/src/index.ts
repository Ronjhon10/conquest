// Load test for the deployed app (spec 010 Behavior 6, P.8): virtual attendees check into the bosses on
// their map and read the leaderboard, the hot path the demo shows.
//   npm run load -w scripts/load                                   # 50 users, 120 s, the team URL
//   BASE_URL=http://localhost:3000 USERS=5 DURATION_S=20 npm run load -w scripts/load
// Never inject faults: this only sends normal player traffic. Bots have made-up names and no LinkedIn link.
import { type Sample, summarize } from "./stats";

const BASE_URL = (process.env.BASE_URL ?? "https://conquest.cnh.radarhq.io").replace(/\/$/, "");
const USERS = Number(process.env.USERS ?? 50);
const DURATION_S = Number(process.env.DURATION_S ?? 120);
const SIGNUP_CONCURRENCY = Number(process.env.SIGNUP_CONCURRENCY ?? 10);
const TIMEOUT_MS = 10_000;
const CLASSES = ["knight", "wizard", "rogue", "bard"] as const;
const GOALS = [
  ["kubernetes security", "platform engineering"],
  ["observability", "opentelemetry"],
  ["ebpf", "networking"],
  ["ai on kubernetes", "gpu scheduling"],
];

const samples: Sample[] = [];

async function call<T>(route: string, method: string, path: string, body?: unknown): Promise<{ status: number; json: T | null }> {
  const started = performance.now();
  try {
    const res = await fetch(BASE_URL + path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as T | null;
    samples.push({ route, status: res.status, ms: performance.now() - started });
    return { status: res.status, json };
  } catch {
    samples.push({ route, status: 0, ms: performance.now() - started });
    return { status: 0, json: null };
  }
}

type Attendee = { id: string; map: { talk_id: string }[] };

async function signup(conferenceId: string, i: number): Promise<Attendee | null> {
  const { json } = await call<{ attendee: Attendee }>("POST /api/game/attendees", "POST", "/api/game/attendees", {
    conference_id: conferenceId,
    name: `Load Bot ${String(i + 1).padStart(2, "0")}`,
    headline: "Load test bot",
    about: "",
    class: CLASSES[i % CLASSES.length],
    avatar_seed: `load-${i}`,
    goals: GOALS[i % GOALS.length],
  });
  return json?.attendee ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function player(a: Attendee, conferenceId: string, deadline: number) {
  const talks = a.map.map((b) => b.talk_id);
  let next = 0;
  while (Date.now() < deadline) {
    if (next < talks.length) {
      await call("POST /api/game/xp checkin", "POST", "/api/game/xp", { attendee_id: a.id, kind: "checkin", talk_id: talks[next++] });
    } else {
      await call("POST /api/game/xp photo", "POST", "/api/game/xp", { attendee_id: a.id, kind: "photo", talk_id: talks[next++ % talks.length] });
    }
    await call("GET /api/game/leaderboard", "GET", `/api/game/conferences/${conferenceId}/leaderboard?limit=10`);
    await sleep(500 + Math.random() * 1000); // think time between taps
  }
}

async function main() {
  console.log(`Load test: ${USERS} virtual attendees for ${DURATION_S}s against ${BASE_URL}`);
  const conf = await call<{ conference: { id: string } }>("POST /api/game/conferences", "POST", "/api/game/conferences", {
    name: `Load test ${new Date().toISOString().slice(0, 16)}`,
    theme_prompt: "load test dungeon",
  });
  const conferenceId = conf.json?.conference.id;
  if (!conferenceId) throw new Error(`could not create a conference (HTTP ${conf.status})`);

  const attendees: Attendee[] = [];
  for (let i = 0; i < USERS; i += SIGNUP_CONCURRENCY) {
    const batch = await Promise.all(Array.from({ length: Math.min(SIGNUP_CONCURRENCY, USERS - i) }, (_, j) => signup(conferenceId, i + j)));
    attendees.push(...batch.filter((a): a is Attendee => a !== null));
  }
  console.log(`Signed up ${attendees.length}/${USERS} attendees in conference ${conferenceId}`);
  if (attendees.length === 0) throw new Error("no attendees signed up; see the signup row below");

  const deadline = Date.now() + DURATION_S * 1000;
  await Promise.all(attendees.map((a) => player(a, conferenceId, deadline)));

  console.table(summarize(samples));
  const total = samples.length;
  const failed = samples.filter((s) => s.status === 0 || s.status >= 500).length;
  console.log(`${total} requests, ${failed} failed (5xx or no response), ${((failed / Math.max(total, 1)) * 100).toFixed(1)}%`);
}

main().catch((err: unknown) => {
  console.table(summarize(samples));
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
