// OpenTelemetry for Conquest's Node services (spec 010 Interface, 000 Telemetry conventions).
// Traces, metrics and logs go over OTLP/HTTP straight to Dash0; there is no collector in the cluster.
//
// Usage, first thing in a service's entry file (the dynamic import matters, see README.md):
//   import { startTelemetry } from "@conquest/telemetry";
//   startTelemetry("conquest-game-api");
//   await import("./main");
import { register } from "node:module";
import { context, logs, SeverityNumber, trace } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { defaultResource, resourceFromAttributes, type Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

type Env = Record<string, string | undefined>;

export type Telemetry = { sdk: NodeSDK; shutdown: () => Promise<void> };

let started: Telemetry | null = null;

/** Resource attributes every signal carries: service.name, deployment.environment (DEPLOY_ENV, default dev), service.version. */
export function telemetryResource(serviceName: string, env: Env = process.env): Resource {
  const deployEnv = env.DEPLOY_ENV || "dev";
  return defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: env.APP_VERSION || "dev",
      "deployment.environment": deployEnv,
      "deployment.environment.name": deployEnv,
    }),
  );
}

/**
 * OTLP headers. The exporters read OTEL_EXPORTER_OTLP_HEADERS themselves; when only DASH0_AUTH_TOKEN
 * is set we build the Dash0 bearer header from it. Returns undefined to let the exporters use env.
 */
export function otlpHeaders(env: Env = process.env): Record<string, string> | undefined {
  if (env.OTEL_EXPORTER_OTLP_HEADERS || !env.DASH0_AUTH_TOKEN) return undefined;
  const headers: Record<string, string> = { Authorization: `Bearer ${env.DASH0_AUTH_TOKEN}` };
  if (env.DASH0_DATASET) headers["Dash0-Dataset"] = env.DASH0_DATASET;
  return headers;
}

/**
 * Starts traces, metrics and logs for `serviceName`. A no-op returning null when
 * OTEL_EXPORTER_OTLP_ENDPOINT is unset (tests, laptops). Safe to call twice; the second call returns the first SDK.
 */
export function startTelemetry(serviceName: string, env: Env = process.env): Telemetry | null {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) return null;
  if (started) return started;

  // ESM: patch modules (node:http, ...) imported after this point. Without it only fetch/undici
  // and libraries with built-in OTel (the Elasticsearch client) produce spans.
  try {
    register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);
  } catch {
    // Older runtimes or a loader already registered: keep going with what we have.
  }

  const headers = otlpHeaders(env);
  const sdk = new NodeSDK({
    resource: telemetryResource(serviceName, env),
    traceExporter: new OTLPTraceExporter({ headers }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ headers }),
        exportIntervalMillis: Number(env.OTEL_METRIC_EXPORT_INTERVAL) || 10_000,
      }),
    ],
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ headers }) })],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Noise for our services: every file read, DNS lookup and socket would be a span.
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (req) => /\/(healthz|readyz)$/.test(req.url ?? ""),
        },
      }),
    ],
  });
  sdk.start();

  const shutdown = () => sdk.shutdown().catch(() => undefined);
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      void shutdown().finally(() => process.exit(0));
    });
  }
  started = { sdk, shutdown };
  return started;
}

export type LogLevel = "debug" | "info" | "warn" | "error";
const severity: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

/**
 * JSON log line to stdout with trace_id and span_id of the active span, also sent as an OTel log record.
 * Never pass names, LinkedIn text, notes or other personal text in `msg` or `attrs`; IDs are fine.
 */
export function log(level: LogLevel, msg: string, attrs: Record<string, string | number | boolean> = {}): void {
  const span = trace.getSpan(context.active())?.spanContext();
  const line = { time: new Date().toISOString(), level, msg, ...attrs, trace_id: span?.traceId, span_id: span?.spanId };
  console.log(JSON.stringify(line));
  logs.getLogger("conquest").emit({ severityNumber: severity[level], severityText: level.toUpperCase(), body: msg, attributes: attrs });
}

/** Test helper: forget the started SDK. */
export function _resetForTests(): void {
  started = null;
}
