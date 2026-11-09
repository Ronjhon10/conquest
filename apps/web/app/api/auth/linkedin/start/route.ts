import { startLinkedin } from "../../../../../src/lib/linkedin-server";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export function GET(request: NextRequest) {
  return startLinkedin(request);
}
