import { ErrorBody } from "@conquest/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "./app";
import { body } from "./http";

describe("game-api skeleton", () => {
  const app = createApp();

  it("OV-3 GET /healthz answers 200 {ok:true}, also under /api/game", async () => {
    for (const path of ["/healthz", "/api/game/healthz"]) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    }
  });

  it("OV-4 unknown routes answer 404 with the error shape", async () => {
    const res = await app.request("/api/game/nope");
    expect(res.status).toBe(404);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("not_found");
  });

  it("OV-4 bad JSON bodies answer 400 bad_request with the error shape", async () => {
    const { Hono } = await import("hono");
    const { installErrorHandling } = await import("./http");
    const t = new Hono();
    installErrorHandling(t);
    t.post("/x", async (c) => c.json(await body(c, z.object({ n: z.number() }))));
    for (const payload of ["not json", JSON.stringify({ n: "1" })]) {
      const res = await t.request("/x", { method: "POST", body: payload, headers: { "content-type": "application/json" } });
      expect(res.status).toBe(400);
      expect(ErrorBody.parse(await res.json()).error.code).toBe("bad_request");
    }
  });

  it("OV-4 thrown errors answer 500 internal with the error shape", async () => {
    const { Hono } = await import("hono");
    const { installErrorHandling } = await import("./http");
    const t = new Hono();
    installErrorHandling(t);
    t.get("/boom", () => {
      throw new Error("kaboom");
    });
    const res = await t.request("/boom");
    expect(res.status).toBe(500);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("internal");
  });
});
