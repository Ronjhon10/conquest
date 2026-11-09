import { serve } from "@hono/node-server";
import { createApp } from "./app";

// startTelemetry("conquest-game-api") goes here first once packages/telemetry exists (BUILD P.3).
const port = Number(process.env.PORT ?? process.env.GAME_API_PORT ?? 4002);
serve({ fetch: createApp().fetch, port }, () => {
  console.log(JSON.stringify({ level: "info", msg: "conquest-game-api listening", port }));
});
