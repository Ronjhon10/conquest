import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@conquest/contracts"],
  output: "standalone",
};

export default config;
