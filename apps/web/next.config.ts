import path from "node:path";
import type { NextConfig } from "next";

// The browser only talks to this app (on the cluster, Service `app` is the only public entry).
// /api/search/* and /api/game/* are proxied to the services. Destinations are fixed at build time:
// local dev defaults to the dev ports, the Docker build sets the in-cluster Service names.
const searchApi = process.env.SEARCH_API_URL ?? "http://localhost:4001";
const gameApi = process.env.GAME_API_URL ?? "http://localhost:4002";

const config: NextConfig = {
  transpilePackages: ["@conquest/contracts"],
  output: "standalone",
  // OAuth callback query strings contain authorization codes and state.
  logging: { incomingRequests: { ignore: [/\/api\/auth\/linkedin(?:\/|\?)/] } },
  images: {
    qualities: [75, 100],
    imageSizes: [32, 48, 64, 96, 128, 224, 256, 384, 448, 576],
  },
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  async rewrites() {
    return [
      {
        source: "/api/search/:path*",
        destination: `${searchApi}/api/search/:path*`,
      },
      { source: "/api/game/:path*", destination: `${gameApi}/api/game/:path*` },
    ];
  },
};

export default config;
