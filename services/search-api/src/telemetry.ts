// search-api's custom telemetry (020 Behavior 6, 000 conventions). The SDK is started by
// @conquest/telemetry in index.ts; with it off these are no-ops. Never put goal text, about text
// or search queries in attributes: counts, kinds and IDs only.
import { metrics, trace, type Histogram, type Tracer } from "@opentelemetry/api";

export type Instruments = { tracer: Tracer; rankDuration: Histogram };

let cached: Instruments | null = null;

/** Lazily from the global API, so the SDK started in index.ts is the one used. */
export function instruments(): Instruments {
  cached ??= {
    tracer: trace.getTracer("conquest-search-api"),
    rankDuration: metrics.getMeter("conquest-search-api").createHistogram("conquest.search.rank.duration", {
      unit: "ms",
      description: "POST /rank time, from first query to picked bosses",
    }),
  };
  return cached;
}
