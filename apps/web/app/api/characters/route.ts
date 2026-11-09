import { generateCharacter } from "../../../src/lib/character-server";
export const runtime = "nodejs";
export const maxDuration = 200;
export function POST(request: Request) {
  return generateCharacter(request);
}
