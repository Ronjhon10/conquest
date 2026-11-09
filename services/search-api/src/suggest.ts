// POST /suggest-goals (020 Behavior 5): goal phrases from aggregations over the talks that match
// the about text. No OpenAI.
import { keywordQuery } from "./queries";

export const SAMPLE_SIZE = 50;
export const MIN_GOALS = 3;
export const MAX_GOALS = 6;
/** Tags on more than this share of all talks say nothing about a person. */
export const COMMON_SHARE = 0.6;

export type Bucket = { term: string; count: number };
/** Tag/track counts in the top-50 sample, and tag counts across the whole index. */
export type Facets = { sample: { tags: Bucket[]; tracks: Bucket[] }; all: { docs: number; tags: Bucket[] } };

/** Session formats and venues: real tracks, but not something to want from a conference. */
export const NOT_GOALS = new Set(
  [
    "keynote sessions", "maintainer track", "lightning talks", "project lightning talks", "tutorials", "contribfest",
    "poster sessions", "experiences", "solutions showcase", "sponsor demo theater", "cloud native theater",
    "project pavilion stage", "project pavilion tours", "project opportunities", "learning lounge", "end user talk",
    "bof", "network nook", "sponsor-hosted co-located events", "cncf-hosted co-located events", "sponsored",
  ],
);

const WORDS: Record<string, string> = {
  ai: "AI", ml: "ML", gpu: "GPU", gpus: "GPUs", api: "API", apis: "APIs", cli: "CLI", ebpf: "eBPF", dns: "DNS",
  llm: "LLM", llms: "LLMs", "llm-d": "llm-d", idp: "IDP", cncf: "CNCF", sig: "SIG", wasm: "Wasm", otel: "OTel",
  opentelemetry: "OpenTelemetry", kubevirt: "KubeVirt", kubeflow: "Kubeflow", kyvernocon: "KyvernoCon",
  envoycon: "EnvoyCon", coredns: "CoreDNS", "cri-o": "CRI-O", grpc: "gRPC", k8s: "K8s", tuf: "TUF", spiffe: "SPIFFE",
  spire: "SPIRE", oci: "OCI", kserve: "KServe", argo: "Argo", keda: "KEDA", opa: "OPA", "in-toto": "in-toto", etcd: "etcd", gitops: "GitOps", finops: "FinOps", devops: "DevOps",
  "+": "+", and: "and", of: "of", the: "the", for: "for",
};

export function titleCase(phrase: string): string {
  return phrase
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const known = WORDS[w.toLowerCase()];
      if (known && !(i === 0 && /^(and|of|the|for)$/.test(known))) return known;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Turn the facets into 3-6 distinct goal phrases: sample tags and tracks by count, minus formats
 * and tags on more than 60% of talks; topped up from the most common tags if the sample is thin.
 * Track names keep their own casing ("AI Inference + Agentic").
 */
export function pickGoals(f: Facets): string[] {
  const tooCommon = new Set(f.all.tags.filter((b) => f.all.docs > 0 && b.count / f.all.docs > COMMON_SHARE).map((b) => b.term.toLowerCase()));
  const display = new Map<string, string>();
  for (const b of f.sample.tracks) display.set(b.term.toLowerCase(), b.term);

  const counts = new Map<string, number>();
  for (const b of [...f.sample.tags, ...f.sample.tracks]) {
    const key = b.term.toLowerCase();
    counts.set(key, Math.max(counts.get(key) ?? 0, b.count));
  }
  const usable = (key: string) => !NOT_GOALS.has(key) && !tooCommon.has(key);
  const ranked = [...counts.entries()].filter(([k]) => usable(k)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const out: string[] = ranked.slice(0, MAX_GOALS).map(([k]) => k);
  for (const b of [...f.all.tags].sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))) {
    if (out.length >= MIN_GOALS) break;
    const key = b.term.toLowerCase();
    if (usable(key) && !out.includes(key)) out.push(key);
  }
  return out.map((k) => display.get(k) ?? titleCase(k));
}

/**
 * One request: exactly the top 50 BM25 hits (tags and track only) plus a global tag count. Not a
 * `sampler` aggregation: its shard_size is per shard, and on Elastic Serverless (several shards)
 * "50" sampled ~300 of 480 talks, so every attendee got the conference's biggest tracks.
 */
export function suggestBody(about: string) {
  const text = about.trim();
  return {
    size: text ? SAMPLE_SIZE : 0,
    _source: ["tags", "track"],
    query: text ? keywordQuery(text) : { match_none: {} },
    aggs: { all: { global: {}, aggs: { tags: { terms: { field: "tags", size: 500 } } } } },
  };
}

type TermsAgg = { buckets?: { key: string; doc_count: number }[] };
const buckets = (a: TermsAgg | undefined): Bucket[] => (a?.buckets ?? []).map((b) => ({ term: String(b.key), count: b.doc_count }));

export function countTerms(terms: string[]): Bucket[] {
  const m = new Map<string, number>();
  for (const t of terms) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

/** Sample counts from the hits themselves (one count per talk), background from the global agg. */
export function facetsFromResult(hits: { tags?: string[]; track?: string | null }[], aggs: Record<string, unknown> | null): Facets {
  const a = (aggs ?? {}) as { all?: { doc_count?: number; tags?: TermsAgg } };
  return {
    sample: {
      tags: countTerms(hits.flatMap((h) => [...new Set(h.tags ?? [])])),
      tracks: countTerms(hits.flatMap((h) => (h.track ? [h.track] : []))),
    },
    all: { docs: a.all?.doc_count ?? 0, tags: buckets(a.all?.tags) },
  };
}
