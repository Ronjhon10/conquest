# 020: Search

Status: Accepted
Prefix: `SR`
Lane: Search
Owner:

## Purpose

The Elasticsearch track ("Find the Right Talk"), and the heart of the attendee experience: given what an attendee says they want, find the talks at **KubeCon NA 2026** that serve it and turn them into the bosses on their dungeon map, without time clashes. Owns the `conquest-talks` and `conquest-speakers` indexes, the seed data from the real KubeCon schedule, and `search-api`. Elasticsearch is the core data layer of the whole app (030 keeps all game state in it too); this lane makes the search itself smart: hybrid keyword + semantic, goal-aware, clash-free.

## Non-goals

- Crawling anything at runtime. The schedule is scraped once into a committed NDJSON file.
- Personalization from behavior (clicks, check-ins). Ranking uses only stated goals and about text.
- Talks from more than one conference at a time (index has a `conference` keyword so it could, later).

## Interface

The search-api routes and `Talk`, `Speaker`, `BossSlot` types in [000](000-overview.md#contracts). Plus:

- `npm run seed -w services/search-api` reads `data/kubecon-na-2026.ndjson` and bulk-indexes it (idempotent: same IDs overwrite).
- `npm run scrape -w scripts/seed` regenerates the NDJSON from the public KubeCon NA 2026 schedule.

### Index mappings

`conquest-talks`:
- `id` keyword, `conference` keyword (`kubecon-na-2026`), `title` text (english analyzer) + `title.raw` keyword, `abstract` text (english), `speaker_ids` keyword, `speaker_names` text, `room` keyword, `starts_at`/`ends_at` date, `track` keyword, `level` keyword, `tags` keyword,
- `semantic` field of type `semantic_text` built from title + abstract + tags (via `copy_to`), using inference endpoint `conquest-embeddings`.

`conquest-speakers`: `id` keyword, `name` text + keyword, `company` keyword, `bio` text, `photo_url` keyword (not indexed).

## Behavior

1. **Seed data.** Scrape the public KubeCon + CloudNativeCon NA 2026 schedule (Sched; prefer its public iCal/list export over HTML scraping). Keep sessions with a speaker and an abstract (talks, panels, lightning talks); drop breaks, meals, registration. Map Sched's track/category to `track`, its type/level to `level`, and derive `tags` from the track and any listed topics. IDs are Sched's event IDs (`talk-<id>`) and speaker slugs (`spk-<slug>`). Commit the NDJSON. If the scrape fails, hand-enter at least 40 real sessions from the public schedule and note it in DECISIONS.md. Respect the site: one pass, polite delay, no logins.
2. **Embeddings.** On start, create inference endpoint `conquest-embeddings` (OpenAI `text-embedding-3-small`) with `OPENAI_API_KEY` if it doesn't exist. The self-managed cluster starts a trial license (`POST _license/start_trial`) so inference, `semantic_text` and RRF are available. With no OpenAI key, the `semantic` field is left out of the mapping and ranking is BM25 only (OV-5).
3. **Search (`GET /talks`).** Hybrid: `rrf` retriever over (a) `multi_match` on `title^3, abstract, speaker_names^2, tags^2` with `fuzziness: AUTO` and (b) a `semantic` query on `semantic`. Highlight from `abstract` (one fragment, 160 chars). If RRF is refused, use a `bool.should` of both with the semantic clause boosted 2x.
4. **Rank (`POST /rank`), the bosses.**
   1. For each goal (max 6), run the hybrid search with the goal text, plus one search with the about text at half weight. Take the top 20 of each.
   2. Fuse by reciprocal rank (score = sum of `1/(60 + rank)` across lists; the about list's contribution is halved).
   3. Walk the fused list in order and pick talks whose time does not overlap a picked talk, until `limit` (default 6, max 8) are picked. Clashing talks are skipped, not dropped from search.
   4. `reason` for each boss: `Matches your goal "<goal>"` for the goal list where it ranked best; if it came only from the about text, `Fits your background`.
   5. Return bosses ordered by start time (the map is a path through the day).
5. **Suggest goals (`POST /suggest-goals`).** BM25 search of the about text over talks, then a `terms` aggregation on `tags` and `track` over the top 50 hits (`significant_terms` against the whole index if it gives better phrases). Return 3-6 distinct phrases, title-cased, without tags that appear on more than 60% of all talks. No OpenAI.
6. **Telemetry.** `rank` is one span with child spans per Elasticsearch query; record `conquest.search.rank.duration` and `conquest.search.goals_count`. Never put goal text or about text in attributes.

## Acceptance criteria

- **SR-1** `data/kubecon-na-2026.ndjson` holds at least 40 real KubeCon NA 2026 sessions, each a valid `Talk` with at least one speaker present in the speakers data.
- **SR-2** Seeding twice leaves the same document count as seeding once.
- **SR-3** `GET /api/search/talks?q=ebpf` returns talks whose title, abstract or tags mention eBPF first, each with a `highlight`.
- **SR-4** A misspelled query (`kubernets security`) still returns security talks (fuzziness).
- **SR-5** With an OpenAI key, a query with no shared words but the same meaning (e.g. `keeping my cluster from getting hacked`) returns security talks in the top 5 (semantic). Integration test, `ES_INTEGRATION=1` only.
- **SR-6** `POST /rank` returns at most `limit` bosses, none of which overlap in time.
- **SR-7** `POST /rank` orders bosses by `starts_at`.
- **SR-8** Each boss's `reason` names the goal it best matched, or says `Fits your background`.
- **SR-9** Fusion: a talk ranked first for two goals scores above a talk ranked first for one goal (pure function test on the fusion step).
- **SR-10** `POST /suggest-goals` returns 3-6 distinct phrases and none is a tag present on more than 60% of talks.
- **SR-11** With `OPENAI_API_KEY` unset, search and rank still work (BM25 only) and the service starts.
- **SR-12** `GET /talks/:id` for an unknown id returns 404 with the 000 error shape.

## Open questions

- Is Sched's export reachable without a login? **Default:** try iCal/list export; otherwise hand-enter 40 sessions (Behavior 1).
- Does the trial license start on the event cluster? **Default:** yes; if not, BM25 + semantic `bool.should` without RRF, noted in DECISIONS.md.
