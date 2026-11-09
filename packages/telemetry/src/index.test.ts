import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ctor = vi.fn();
const start = vi.fn();
vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: class {
    constructor(config: unknown) {
      ctor(config);
    }
    start = start;
    shutdown = vi.fn().mockResolvedValue(undefined);
  },
}));
const exporterCtor = vi.fn();
vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: class {
    constructor(config: unknown) {
      exporterCtor(config);
    }
  },
}));
vi.mock("node:module", async (orig) => ({ ...(await orig<typeof import("node:module")>()), register: vi.fn() }));

const { startTelemetry, telemetryResource, otlpHeaders, log, _resetForTests } = await import("./index");

const endpointEnv = { OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318" };

describe("startTelemetry", () => {
  beforeEach(() => {
    ctor.mockClear();
    start.mockClear();
    exporterCtor.mockClear();
    _resetForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it("PL-1 is a no-op when OTEL_EXPORTER_OTLP_ENDPOINT is unset", () => {
    expect(() => startTelemetry("x", {})).not.toThrow();
    expect(startTelemetry("x", {})).toBeNull();
    expect(startTelemetry("x", { OTEL_EXPORTER_OTLP_ENDPOINT: "" })).toBeNull();
    expect(ctor).not.toHaveBeenCalled();
    expect(exporterCtor).not.toHaveBeenCalled();
  });

  it("PL-2 sets service.name and deployment.environment from DEPLOY_ENV", () => {
    vi.spyOn(process, "once").mockReturnValue(process);
    const t = startTelemetry("x", { ...endpointEnv, DEPLOY_ENV: "demo" });
    expect(t).not.toBeNull();
    expect(start).toHaveBeenCalledOnce();
    const { resource } = ctor.mock.calls[0]![0] as { resource: ReturnType<typeof telemetryResource> };
    expect(resource.attributes["service.name"]).toBe("x");
    expect(resource.attributes["deployment.environment"]).toBe("demo");
  });

  it("PL-2 deployment.environment defaults to dev", () => {
    const attrs = telemetryResource("conquest-game-api", {}).attributes;
    expect(attrs["service.name"]).toBe("conquest-game-api");
    expect(attrs["deployment.environment"]).toBe("dev");
  });

  it("PL-2 starts once even when called twice", () => {
    vi.spyOn(process, "once").mockReturnValue(process);
    const a = startTelemetry("x", endpointEnv);
    const b = startTelemetry("x", endpointEnv);
    expect(a).toBe(b);
    expect(ctor).toHaveBeenCalledOnce();
  });
});

describe("otlpHeaders", () => {
  it("leaves headers to the exporter when OTEL_EXPORTER_OTLP_HEADERS is set", () => {
    expect(otlpHeaders({ OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer a", DASH0_AUTH_TOKEN: "b" })).toBeUndefined();
  });
  it("builds the Dash0 bearer header from DASH0_AUTH_TOKEN", () => {
    expect(otlpHeaders({ DASH0_AUTH_TOKEN: "tok" })).toEqual({ Authorization: "Bearer tok" });
  });
  it("returns undefined with no token", () => {
    expect(otlpHeaders({})).toBeUndefined();
  });
});

describe("log", () => {
  it("writes one JSON line with level and msg", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    log("info", "listening", { port: 8080 });
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({ level: "info", msg: "listening", port: 8080 });
    spy.mockRestore();
  });
});
