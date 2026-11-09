// Pure helpers for the load script: latency percentiles and a per-route summary.

export type Sample = { route: string; status: number; ms: number };

/** Nearest-rank percentile of `values` (0-100). Returns 0 for an empty list. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]!;
}

export type RouteSummary = {
  route: string;
  requests: number;
  ok: number;
  client_errors: number;
  server_errors: number;
  network_errors: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

/** Groups samples by route. status 0 means the request never got a response (timeout, reset). */
export function summarize(samples: Sample[]): RouteSummary[] {
  const byRoute = new Map<string, Sample[]>();
  for (const s of samples) byRoute.set(s.route, [...(byRoute.get(s.route) ?? []), s]);
  return [...byRoute.entries()]
    .map(([route, list]) => {
      const ms = list.map((s) => s.ms);
      return {
        route,
        requests: list.length,
        ok: list.filter((s) => s.status >= 200 && s.status < 400).length,
        client_errors: list.filter((s) => s.status >= 400 && s.status < 500).length,
        server_errors: list.filter((s) => s.status >= 500).length,
        network_errors: list.filter((s) => s.status === 0).length,
        p50: Math.round(percentile(ms, 50)),
        p95: Math.round(percentile(ms, 95)),
        p99: Math.round(percentile(ms, 99)),
        max: Math.round(Math.max(...ms)),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}
