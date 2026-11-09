import {
  characterJob,
  generateCharacter,
} from "../../../src/lib/character-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export function POST(request: Request) {
  return generateCharacter(request);
}
export function GET(request: Request) {
  return characterJob(request);
}
