# @conquest/telemetry

OpenTelemetry for the Node services (spec 010, 000 Telemetry conventions). Traces, metrics and logs go over OTLP/HTTP straight to Dash0. There is no collector.

## Use it

Make the service's entry file this. Your current `index.ts` body moves to `main.ts`:

```ts
import { startTelemetry } from "@conquest/telemetry";
startTelemetry("conquest-game-api");   // or conquest-search-api
await import("./main");
```

Why the dynamic import: in ESM, static imports load before any code runs, so `node:http` would already be loaded unpatched and you'd get no server spans. `fetch`/undici spans and the Elasticsearch client's own spans work either way.

Log with `log(level, msg, attrs)`. It writes a JSON line to stdout with `trace_id`/`span_id` and sends an OTel log record. **Never put names, LinkedIn text, notes or other personal text in `msg` or `attrs`.** IDs are fine.

Custom spans and metrics use `@opentelemetry/api` directly (`trace.getTracer("conquest")`, `metrics.getMeter("conquest")`), with the names and `conquest.*` attributes from 000.

## Env

| Var | Effect |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Unset: telemetry off, `startTelemetry` returns `null` (PL-1). Dash0: `https://ingress.<region>.dash0.com` |
| `OTEL_EXPORTER_OTLP_HEADERS` | `Authorization=Bearer <token>`. Takes precedence |
| `DASH0_AUTH_TOKEN` | Used to build the bearer header when `OTEL_EXPORTER_OTLP_HEADERS` is unset |
| `DASH0_DATASET` | Optional `Dash0-Dataset` header (only with `DASH0_AUTH_TOKEN`) |
| `DEPLOY_ENV` | `deployment.environment`, default `dev` (PL-2) |
| `APP_VERSION` | `service.version`, set by the Dockerfile build arg |

Off by default: fs, dns and net instrumentation (noise), and spans for `/healthz` and `/readyz`.
