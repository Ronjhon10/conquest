import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { depsFromEnv } from "./deps";

const deps = depsFromEnv();
for (const msg of deps.notes) console.log(JSON.stringify({ level: "warn", msg }));
await deps.store.ensureIndexes(); // 000: each owner creates its indexes on start if missing

const port = Number(process.env.PORT ?? process.env.GAME_API_PORT ?? 4002);
serve({ fetch: createApp(deps).fetch, port }, () => {
  console.log(JSON.stringify({ level: "info", msg: "conquest-game-api listening", port }));
});
