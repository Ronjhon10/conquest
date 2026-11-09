// Shared HTTP plumbing (000: errors are { error: { code, message } }, every service serves /healthz).
import { errorBody } from "@conquest/contracts";
import { log } from "@conquest/telemetry";
import type { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

/** Throw from a handler to answer with the 000 error shape. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function fail(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json(errorBody(code, message), status);
}

/** Parse a JSON body with a contracts schema; bad input becomes 400 bad_request. */
export async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, "bad_request", "Body must be JSON");
  }
  return parse(schema, raw);
}

export function parse<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new ApiError(400, "bad_request", z.prettifyError(r.error));
  return r.data;
}

export function installErrorHandling(app: Hono) {
  app.notFound((c) => fail(c, 404, "not_found", `No route for ${c.req.method} ${c.req.path}`));
  app.onError((err, c) => {
    if (err instanceof ApiError) return fail(c, err.status, err.code, err.message);
    if (err instanceof HTTPException) return fail(c, err.status as ContentfulStatusCode, "http_error", err.message);
    // Backend messages and stack headers can contain a user's query, profile, or note.
    log("error", "Unhandled request failure", { "error.type": err.constructor.name });
    return fail(c, 500, "internal", "Something went wrong");
  });
}

export const notImplemented = (step: string) => (c: Context) =>
  fail(c, 501, "not_implemented", `Not built yet (product/BUILD.md ${step})`);
