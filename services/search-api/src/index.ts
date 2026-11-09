// Entry point. Telemetry starts before the app loads so node:http and the rest get instrumented
// (packages/telemetry/README.md). The app itself is in main.ts.
import { startTelemetry } from "@conquest/telemetry";

startTelemetry("conquest-search-api");
await import("./main");
