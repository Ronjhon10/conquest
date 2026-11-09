// In-memory TalkStore: a rough stand-in for BM25 + fuzziness over the same fields and boosts
// as queries.ts. Used by unit tests (OV-6) and by search-api when ELASTICSEARCH_URL is unset,
// so the other lanes can run against the real schedule without a cluster.
import type { Speaker, Talk } from "@conquest/contracts";
import { HIGHLIGHT_CHARS } from "../queries";
import type { TalkHit, TalkStore } from "../store";
import { countTerms as count, SAMPLE_SIZE, type Facets } from "../suggest";

const STOP = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "into", "is", "it", "of", "on", "or", "that", "the", "this", "to", "with", "you", "your", "my", "we", "our", "i"]);

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOP.has(t)).map(stem);
}

/** Tiny stand-in for the english analyzer's stemming. */
function stem(t: string): string {
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

/** Elasticsearch fuzziness AUTO: 0 edits up to 2 chars, 1 up to 5, else 2. */
export function autoFuzziness(term: string): number {
  return term.length <= 2 ? 0 : term.length <= 5 ? 1 : 2;
}

export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

type Indexed = { talk: Talk; fields: { weight: number; terms: Set<string> }[] };

export class MemoryTalkStore implements TalkStore {
  private readonly speakers: Map<string, Speaker>;
  private readonly talks: Map<string, Talk>;
  private readonly indexed: Indexed[];

  constructor(data: { talks: Talk[]; speakers: Speaker[] }) {
    this.speakers = new Map(data.speakers.map((s) => [s.id, s]));
    this.talks = new Map(data.talks.map((t) => [t.id, t]));
    this.indexed = data.talks.map((talk) => {
      const names = talk.speaker_ids.map((id) => this.speakers.get(id)?.name ?? "").join(" ");
      return {
        talk,
        fields: [
          { weight: 3, terms: new Set(tokens(talk.title)) },
          { weight: 1, terms: new Set(tokens(talk.abstract)) },
          { weight: 2, terms: new Set(tokens(names)) },
          { weight: 2, terms: new Set(talk.tags.flatMap(tokens)) },
        ],
      };
    });
  }

  async searchTalks(q: string, limit: number, offset = 0): Promise<TalkHit[]> {
    const qTerms = [...new Set(tokens(q))];
    if (qTerms.length === 0) {
      return [...this.talks.values()]
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id))
        .slice(offset, offset + limit)
        .map((talk) => ({ talk, score: 1, highlight: snippet(talk.abstract, []) }));
    }
    const hits: TalkHit[] = [];
    for (const { talk, fields } of this.indexed) {
      let score = 0;
      const matched: string[] = [];
      for (const qt of qTerms) {
        // multi_match best_fields: the best field per term counts.
        let best = 0;
        for (const f of fields) {
          if (f.terms.has(qt)) best = Math.max(best, f.weight);
          else {
            const max = autoFuzziness(qt);
            if (max > 0) for (const t of f.terms) if (editDistance(qt, t, max) <= max) { best = Math.max(best, f.weight * 0.5); matched.push(t); break; }
          }
        }
        if (best > 0) matched.push(qt);
        score += best;
      }
      if (score > 0) hits.push({ talk, score, highlight: snippet(talk.abstract, matched) });
    }
    return hits.sort((a, b) => b.score - a.score || a.talk.id.localeCompare(b.talk.id)).slice(offset, offset + limit);
  }

  async rooms() {
    return [...new Set([...this.talks.values()].map((t) => t.room))].sort();
  }

  async getTalk(id: string) {
    return this.talks.get(id) ?? null;
  }
  async getSpeakers(ids: string[]) {
    return ids.flatMap((id) => (this.speakers.has(id) ? [this.speakers.get(id)!] : []));
  }
  async getSpeaker(id: string) {
    return this.speakers.get(id) ?? null;
  }
  async talksBySpeaker(id: string) {
    return [...this.talks.values()]
      .filter((t) => t.speaker_ids.includes(id))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));
  }
  async facets(about: string): Promise<Facets> {
    const sample = about.trim() ? (await this.searchTalks(about, SAMPLE_SIZE)).map((h) => h.talk) : [];
    return {
      sample: { tags: count(sample.flatMap((t) => [...new Set(t.tags)])), tracks: count(sample.flatMap((t) => (t.track ? [t.track] : []))) },
      all: { docs: this.talks.size, tags: count([...this.talks.values()].flatMap((t) => t.tags)) },
    };
  }
  async ready() {
    return true;
  }
  allTalks(): Talk[] {
    return [...this.talks.values()];
  }
}

/** ~160 chars of the abstract around the first matched term, matches wrapped in <em> like ES. */
function snippet(abstract: string, terms: string[]): string | null {
  if (!abstract) return null;
  const lower = abstract.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.search(new RegExp(`\\b${t}`));
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = at < 0 ? 0 : Math.max(0, at - 40);
  let text = abstract.slice(start, start + HIGHLIGHT_CHARS);
  for (const t of new Set(terms)) text = text.replace(new RegExp(`\\b(${t}[a-z0-9]*)`, "gi"), "<em>$1</em>");
  return text;
}
