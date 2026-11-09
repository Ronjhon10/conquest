// Recap (030 Behavior 19): stats from the attendee's events, then a LinkedIn post written by OpenAI
// with a fixed-template fallback. The prompt carries numbers, class and talk titles only.
import type { Attendee, Recap } from "@conquest/contracts";
import type { Deps } from "../deps";

export const RECAP_TAGS = "#KubeCon #Conquest";
export const RECAP_MAX_CHARS = 1000;
const MAX_TEMPLATE_TITLES = 3;

export type RecapStats = Recap["stats"];
export type RecapFacts = { stats: RecapStats; class: Attendee["class"]; bossTitles: string[] };

/** Stats and boss titles from the attendee's own docs and events. */
export async function gatherRecapFacts(deps: Deps, attendee: Attendee): Promise<RecapFacts> {
  const { repos, search } = deps;
  const [events, coinsGiven] = await Promise.all([
    repos.xpEvents.find({ attendee_id: attendee.id }),
    repos.coins.count({ from_attendee_id: attendee.id }),
  ]);

  const checkedIn = new Set(events.filter((e) => e.kind === "checkin" && e.talk_id).map((e) => e.talk_id as string));
  // Keep the order of the attendee's map so titles read in plan order.
  const bossIds = attendee.map.map((s) => s.talk_id).filter((id, i, all) => checkedIn.has(id) && all.indexOf(id) === i);
  const allies = new Set(events.filter((e) => e.kind === "network" && e.other_attendee_id).map((e) => e.other_attendee_id));

  const found = await Promise.all(bossIds.map((id) => search.getTalk(id).catch(() => null)));
  const bossTitles = found.flatMap((f) => (f ? [f.talk.title] : []));

  return {
    stats: { bosses: bossIds.length, allies: allies.size, xp: attendee.xp, level: attendee.level, coins_given: coinsGiven },
    class: attendee.class,
    bossTitles,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Fixed first-person template; always under the limit and ends with the hashtags. */
export function templatePost(facts: RecapFacts): string {
  const { stats, bossTitles } = facts;
  const shown = bossTitles.slice(0, MAX_TEMPLATE_TITLES).map((t) => (t.length > 120 ? `${t.slice(0, 117)}...` : t));
  const lines = [
    `I just finished KubeCon playing Conquest as a ${facts.class}. I reached level ${stats.level} with ${stats.xp} XP.`,
    stats.bosses > 0
      ? `I defeated ${plural(stats.bosses, "boss", "bosses")} (talks I checked into)${shown.length ? `, including ${shown.map((t) => `"${t}"`).join(", ")}` : ""}.`
      : "I'm still hunting for my first boss, but the hallway track was a good start.",
    `I made ${plural(stats.allies, "new ally", "new allies")} along the way and gave ${plural(stats.coins_given, "coin", "coins")} to speakers whose talks stuck with me.`,
    RECAP_TAGS,
  ];
  return lines.join("\n\n");
}

export function acceptablePost(text: string | null): string | null {
  const t = text?.trim();
  if (!t || t.length >= RECAP_MAX_CHARS || !t.endsWith(RECAP_TAGS)) return null;
  return t;
}

const SYSTEM =
  `You write short, upbeat LinkedIn posts for conference attendees. Write in the first person, under ${RECAP_MAX_CHARS} characters, ` +
  `plain text, using only the facts given. Do not invent names, companies or numbers. End the post with exactly: ${RECAP_TAGS}`;

export function recapPrompt(facts: RecapFacts): string {
  const { stats } = facts;
  return [
    "Facts about my KubeCon, played as a game called Conquest:",
    `- Character class: ${facts.class}`,
    `- Level: ${stats.level}`,
    `- XP: ${stats.xp}`,
    `- Bosses defeated (talks attended): ${stats.bosses}`,
    `- Allies made (people met): ${stats.allies}`,
    `- Coins given to speakers: ${stats.coins_given}`,
    `- Boss talk titles: ${facts.bossTitles.length ? facts.bossTitles.join("; ") : "none"}`,
  ].join("\n");
}

export async function buildRecap(deps: Deps, attendee: Attendee): Promise<Recap> {
  const facts = await gatherRecapFacts(deps, attendee);
  let post: string | null = null;
  if (deps.llm) {
    try {
      post = acceptablePost(await deps.llm.text({ purpose: "recap", system: SYSTEM, user: recapPrompt(facts) }));
    } catch {
      post = null;
    }
  }
  return { post_text: post ?? templatePost(facts), stats: facts.stats };
}
