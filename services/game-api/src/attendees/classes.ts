// 030 Behavior 4: keyword fallback for the character class (used when OpenAI is off or answers badly).
import type { CharacterClass } from "@conquest/contracts";

// The class with the most whole-word hits wins; this order only breaks ties. "devops"/"secops" count as ops.
const RULES: [CharacterClass, RegExp][] = [
  ["rogue", /\b(?:security|compliance|secops|devsecops)\b/gi],
  ["knight", /\b(?:platform|infra|infrastructure|sre|(?:dev|sec)?ops)\b/gi],
  ["wizard", /\b(?:data|ml|ai|research\w*)\b/gi],
];

export function classFromKeywords(headline: string, about: string): CharacterClass {
  const text = `${headline} ${about}`;
  let best: CharacterClass = "bard";
  let bestHits = 0;
  for (const [cls, re] of RULES) {
    const hits = text.match(re)?.length ?? 0;
    if (hits > bestHits) [best, bestHits] = [cls, hits];
  }
  return best;
}
