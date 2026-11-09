"use client";
// Dash0 browser RUM (040 Behavior 7, P.W1 / was W.7): page views, navigation timing, fetch and
// errors. Skipped when NEXT_PUBLIC_DASH0_RUM_* is unset (tests, laptops, fake mode). Our API calls
// are same-origin (/api/*), so the SDK adds W3C traceparent to them and browser spans join the
// game-api and search-api traces. No custom attributes: never send names or typed text.
import { useEffect } from "react";

type RumEnv = { endpoint?: string; authToken?: string; environment?: string; version?: string };

let started = false;

/** Starts RUM once per page load. Returns false (and loads nothing) when not configured. */
export async function startRum(env: RumEnv): Promise<boolean> {
  if (started || !env.endpoint || !env.authToken) return false;
  started = true;
  const { init } = await import("@dash0/sdk-web");
  init({
    serviceName: "conquest-web",
    serviceVersion: env.version || "dev",
    environment: env.environment || "dev",
    endpoint: { url: env.endpoint, authToken: env.authToken },
  });
  return true;
}

export function _resetRumForTests() {
  started = false;
}

export function Rum() {
  useEffect(() => {
    void startRum({
      // NEXT_PUBLIC_* are inlined at build time (apps/web/Dockerfile build args).
      endpoint: process.env.NEXT_PUBLIC_DASH0_RUM_ENDPOINT,
      authToken: process.env.NEXT_PUBLIC_DASH0_RUM_AUTH_TOKEN,
      environment: process.env.NEXT_PUBLIC_DEPLOY_ENV,
      version: process.env.NEXT_PUBLIC_APP_VERSION,
    }).catch(() => undefined); // telemetry must never break the page
  }, []);
  return null;
}
