// Elasticsearch request bodies for talk search (020 Behavior 3). Pure, so tests can check
// the exact shape without a cluster.

export const KEYWORD_FIELDS = ["title^3", "abstract", "speaker_names^2", "tags^2"];
export const HIGHLIGHT_CHARS = 160;

/** Semantic's weight against BM25, in RRF and in the bool.should fallback (020 Behavior 3). */
export const SEMANTIC_WEIGHT = 2;

export type SearchOptions = { semantic: boolean; rrf: boolean };

export function keywordQuery(q: string) {
  return { multi_match: { query: q, fields: KEYWORD_FIELDS, fuzziness: "AUTO" } };
}

export function semanticQuery(q: string) {
  return { semantic: { field: "semantic", query: q } };
}

/** One abstract fragment; when the abstract itself didn't match, its opening instead (SR-3). */
export const highlight = {
  fields: { abstract: { fragment_size: HIGHLIGHT_CHARS, number_of_fragments: 1, no_match_size: HIGHLIGHT_CHARS } },
};

export function searchTalksBody(q: string, size: number, opts: SearchOptions): Record<string, unknown> {
  const text = q.trim();
  if (!text) return { size, query: { match_all: {} }, sort: [{ starts_at: "asc" }, { id: "asc" }], highlight };
  if (!opts.semantic) return { size, query: keywordQuery(text), highlight };
  if (opts.rrf) {
    return {
      size,
      retriever: {
        rrf: {
          // Semantic counts 2x, as in the bool.should fallback: on the real schedule an equal-weight
          // fusion let shared keywords ("cluster") push every meaning-match out of the top 5 (SR-5).
          retrievers: [
            { retriever: { standard: { query: keywordQuery(text) } }, weight: 1 },
            { retriever: { standard: { query: semanticQuery(text) } }, weight: SEMANTIC_WEIGHT },
          ],
          rank_window_size: Math.max(50, size),
        },
      },
      highlight,
    };
  }
  // RRF refused: one bool.should with the semantic clause boosted 2x (020 Behavior 3).
  return {
    size,
    query: { bool: { should: [keywordQuery(text), { semantic: { ...semanticQuery(text).semantic, boost: SEMANTIC_WEIGHT } }] } },
    highlight,
  };
}

export function talksBySpeakerBody(speakerId: string) {
  return { size: 100, query: { term: { speaker_ids: speakerId } }, sort: [{ starts_at: "asc" }, { id: "asc" }] };
}
