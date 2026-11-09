// Made-up sample data for fakes and tests (WEB-1, lane fakes). Not real KubeCon sessions;
// the real schedule comes from data/kubecon-na-2026.ndjson (SR-1).
import type { Ally, Attendee, Conference, LeaderboardRow, Speaker, Talk } from "./schemas";

const day = "2026-11-10";
const t = (hhmm: string) => `${day}T${hhmm}:00.000-07:00`;

export const speakers: Speaker[] = [
  { id: "spk-ada", name: "Ada Fixture", company: "Example Co", bio: "Runs platform teams.", photo_url: null },
  { id: "spk-lin", name: "Lin Sample", company: null, bio: "eBPF tinkerer.", photo_url: null },
  { id: "spk-omar", name: "Omar Demo", company: "Demo Labs", bio: "Security engineer.", photo_url: null },
];

export const talks: Talk[] = [
  { id: "talk-1", title: "Platform Engineering Without Tears", abstract: "Golden paths for internal developer platforms.", speaker_ids: ["spk-ada"], room: "Hall A", starts_at: t("09:00"), ends_at: t("09:30"), track: "Platform Engineering", level: "Beginner", tags: ["platform", "idp"] },
  { id: "talk-2", title: "eBPF for Mere Mortals", abstract: "Observability and networking with eBPF.", speaker_ids: ["spk-lin"], room: "Room 151", starts_at: t("10:00"), ends_at: t("10:30"), track: "Observability", level: "Intermediate", tags: ["ebpf", "observability"] },
  { id: "talk-3", title: "Locking Down Your Cluster", abstract: "Kubernetes security from RBAC to supply chain.", speaker_ids: ["spk-omar"], room: "Room 255", starts_at: t("11:00"), ends_at: t("11:30"), track: "Security", level: "Intermediate", tags: ["security", "rbac", "supply-chain"] },
  { id: "talk-4", title: "OpenTelemetry in Practice", abstract: "Traces, metrics and logs that answer questions.", speaker_ids: ["spk-lin", "spk-ada"], room: "Hall A", starts_at: t("13:00"), ends_at: t("13:30"), track: "Observability", level: "Beginner", tags: ["opentelemetry", "observability"] },
  { id: "talk-5", title: "Serving LLMs on Kubernetes", abstract: "GPU scheduling and inference autoscaling.", speaker_ids: ["spk-ada"], room: "Room 151", starts_at: t("14:00"), ends_at: t("14:30"), track: "AI + ML", level: "Advanced", tags: ["ai", "gpu", "inference"] },
  { id: "talk-6", title: "Clashing Talk at Ten", abstract: "Overlaps talk-2, for clash tests.", speaker_ids: ["spk-omar"], room: "Room 255", starts_at: t("10:00"), ends_at: t("10:45"), track: "Security", level: null, tags: ["security"] },
];

export const conference: Conference = {
  id: "conf-demo",
  name: "Demo Con",
  theme: {
    name: "Kube Caverns",
    prompt: "a dungeon under the convention center",
    palette: { bg: "#14111f", fg: "#f4efe6", accent: "#f2a541" },
    boss_noun: "boss",
    room_noun: "chamber",
    intro: "Beneath the convention center lie the Kube Caverns. Each chamber holds a boss of knowledge.",
  },
  quests: [
    { id: "q-meet5", title: "Meet five adventurers", description: "Network with five people.", xp: 150, kind: "organizer", sponsor: null, target: { type: "network", count: 5, talk_ids: null } },
    { id: "q-boss3", title: "Defeat three bosses", description: "Check into three talks on your map.", xp: 200, kind: "organizer", sponsor: null, target: { type: "boss", count: 3, talk_ids: null } },
    { id: "q-photo3", title: "Capture the moment", description: "Take three photos.", xp: 75, kind: "organizer", sponsor: null, target: { type: "photo", count: 3, talk_ids: null } },
  ],
  rooms: [
    { name: "Hall A", step_free: true, step_free_note: null },
    { name: "Room 151", step_free: true, step_free_note: null },
    { name: "Room 255", step_free: false, step_free_note: "Stairs only from the east lobby; use the west elevator." },
  ],
  created_at: "2026-11-09T18:00:00.000Z",
};

export const attendee: Attendee = {
  id: "att-jane",
  conference_id: "conf-demo",
  name: "Jane Example",
  headline: "Staff SRE at Example Co",
  linkedin_url: "https://www.linkedin.com/in/jane-example/",
  photo: null,
  class: "knight",
  avatar_seed: "a1b2c3d4",
  goals: ["Platform engineering", "Observability"],
  code: "K7QX2M",
  party_id: null,
  xp: 250,
  level: 2,
  coins: 4,
  map: [
    { talk_id: "talk-1", score: 0.031, reason: 'Matches your goal "Platform engineering"' },
    { talk_id: "talk-2", score: 0.029, reason: 'Matches your goal "Observability"' },
    { talk_id: "talk-4", score: 0.027, reason: 'Matches your goal "Observability"' },
  ],
  quests: [...conference.quests],
  created_at: "2026-11-09T18:05:00.000Z",
};

export const allies: Ally[] = [
  { attendee_id: "att-sam", name: "Sam Sample", headline: "Developer advocate", linkedin_url: "https://www.linkedin.com/in/sam-sample/", photo: null },
];

export const leaderboard: LeaderboardRow[] = [
  { attendee_id: "att-sam", name: "Sam Sample", class: "bard", xp: 420, level: 3, photo: null, avatar_seed: "s9s8s7s6" },
  { attendee_id: "att-jane", name: "Jane Example", class: "knight", xp: 250, level: 2, photo: null, avatar_seed: "a1b2c3d4" },
];
