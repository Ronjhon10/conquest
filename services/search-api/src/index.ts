import { serve } from "@hono/node-server";
import { createApp } from "./app";

// startTelemetry("conquest-search-api") goes here first once packages/telemetry exists (BUILD P.3).
const port = Number(process.env.PORT ?? process.env.SEARCH_API_PORT ?? 4001);
serve({ fetch: createApp().fetch, port }, () => {
  console.log(JSON.stringify({ level: "info", msg: "conquest-search-api listening", port }));
});
