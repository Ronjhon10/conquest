// Telemetry handles for game-api (GM-18). Only the @opentelemetry/api package is used here: with no SDK
// registered everything is a no-op; packages/telemetry's startTelemetry registers the real providers.
// Never put names, headlines, LinkedIn URLs, notes or other personal text in any attribute.
import { type Counter, type Histogram, metrics, trace } from "@opentelemetry/api";

export const SERVICE_NAME = "conquest-game-api";

export const tracer = () => trace.getTracer(SERVICE_NAME);
const meter = () => metrics.getMeter(SERVICE_NAME);

// Created lazily so a provider registered after import is always picked up.
let xpAwarded: Counter | undefined;
let checkinsCounter: Counter | undefined;
let leaderboardHist: Histogram | undefined;

export const xpAwardedCounter = (): Counter =>
  (xpAwarded ??= meter().createCounter("conquest.xp.awarded", { description: "XP awarded, by kind" }));
export const checkinsCount = (): Counter =>
  (checkinsCounter ??= meter().createCounter("conquest.checkins", { description: "Talk check-ins" }));
export const leaderboardDuration = (): Histogram =>
  (leaderboardHist ??= meter().createHistogram("conquest.leaderboard.duration", {
    unit: "ms",
    description: "Leaderboard request duration",
  }));

/** Drop cached instruments (tests that swap the global MeterProvider). */
export function resetInstruments(): void {
  xpAwarded = checkinsCounter = leaderboardHist = undefined;
}
