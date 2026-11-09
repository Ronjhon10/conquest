# search-api

Search lane (spec [020](../../specs/020-search.md)). Owns `conquest-talks` and `conquest-speakers` and the `/api/search/*` routes.

## Commands

| Command | What it does | Writes? |
| --- | --- | --- |
| `npm run dev -w services/search-api` | Run locally. With `ELASTICSEARCH_URL` unset it serves the committed schedule from memory, so the other lanes can use real talks without a cluster. | no |
| `npm run seed -w services/search-api` | Create the indexes if missing and bulk-index `data/kubecon-na-2026.ndjson` (same ids overwrite). With `OPENAI_API_KEY` set, also creates the `conquest-embeddings` endpoint and embeds talks. Add `-- --recreate` once to drop `conquest-talks` first (needed to add the semantic field or the tags normalizer to an older index). | yes |
| `npm run verify -w services/search-api` | Read-only checks of the cluster in `.env` against 020 (seeded, SR-3/4/5/6/7/10/12/13). Safe on the shared Serverless project. Exit 1 on a failure. | no |
| `npm run demo -w services/search-api` | Markdown snapshot of four made-up personas' suggested goals and boss maps. Redirect into `DEMO-SNAPSHOT.md`. | no |
| `npm run scrape -w scripts/seed` | Re-fetch the schedule (one GET of the LF schedule page) and rewrite the NDJSON. | data file |

The `ES_INTEGRATION=1` tests drop and reseed `conquest-talks`: run them only against a local container (OV-6), never the shared project. Use `verify` there instead.

## For the Elasticsearch slide

What "Find the Right Talk" does, in order (`src/rank.ts`, `src/queries.ts`, `src/suggest.ts`):

1. **Real data.** 480 sessions and 703 speakers from the official KubeCon NA 2026 schedule (Sessionize export embedded in the LF page), one bulk index.
2. **Hybrid search.** Each query is an `rrf` retriever over two rankings: BM25 `multi_match` (title x3, speakers x2, tags x2, abstract, typo-tolerant with `fuzziness: AUTO`) and a `semantic` query on a `semantic_text` field embedded with OpenAI `text-embedding-3-small` through Elastic's inference API. If RRF is refused, it falls back to one `bool.should` with semantic boosted 2x.
3. **Goals from aggregations, no LLM.** `/suggest-goals` runs a `sampler` (top 50 BM25 hits for the attendee's about text) with `terms` on tags and tracks, plus a `global` agg to drop tags on more than 60% of talks.
4. **Your map.** `/rank` runs one hybrid search per goal plus the about text at half weight (in parallel), fuses them with reciprocal rank fusion (`1/(60+rank)`), gives every goal at least one boss, skips talks that clash in time, and returns the path in time order with a reason per boss ("Matches your goal ...").
5. **All game state is Elasticsearch too** (030): leaderboard and reports are aggregations.

Telemetry: every `/rank` is a `search.rank` span with a child per search and a `conquest.search.rank.duration` histogram, counts only, never goal or about text.
