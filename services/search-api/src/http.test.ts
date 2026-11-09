import { Hono } from "hono";
import { expect, it, vi } from "vitest";
import { installErrorHandling } from "./http";

it("OV-4 unhandled errors do not log personal backend text", async () => {
  const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  try {
    const app = new Hono(); installErrorHandling(app);
    app.get("/test", () => { throw new Error("Private attendee name, notes, and about text"); });
    const response = await app.request("/test");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "internal", message: "Something went wrong" } });
    expect(spy).toHaveBeenCalledOnce();
    expect(JSON.parse(String(spy.mock.calls[0]![0]))).toMatchObject({ level: "error", msg: "Unhandled request failure", "error.type": "Error" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("Private attendee");
  } finally { spy.mockRestore(); }
});
