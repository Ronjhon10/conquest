// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";

const init = vi.fn();
vi.mock("@dash0/sdk-web", () => ({ init }));

const { startRum, _resetRumForTests } = await import("./rum");

afterEach(() => {
  init.mockClear();
  _resetRumForTests();
});

it("RUM is skipped when NEXT_PUBLIC_DASH0_RUM_* is unset (040 Behavior 7)", async () => {
  expect(await startRum({})).toBe(false);
  expect(await startRum({ endpoint: "https://ingress.example" })).toBe(false);
  expect(init).not.toHaveBeenCalled();
});

it("RUM starts once as conquest-web with the endpoint, environment and no custom attributes", async () => {
  const env = { endpoint: "https://ingress.example", authToken: "ingest-only", environment: "demo", version: "abc1234" };
  expect(await startRum(env)).toBe(true);
  expect(await startRum(env)).toBe(false);
  expect(init).toHaveBeenCalledOnce();
  expect(init.mock.calls[0]![0]).toEqual({
    serviceName: "conquest-web",
    serviceVersion: "abc1234",
    environment: "demo",
    endpoint: { url: "https://ingress.example", authToken: "ingest-only" },
  });
});
