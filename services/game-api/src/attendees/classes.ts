// 030 Behavior 4: keyword fallback for the character class (used when OpenAI is off or answers badly).
import type { CharacterClass } from "@conquest/contracts";

// Checked in order; the first group with a whole-word hit wins. "devops"/"secops" count as ops.
const RULES: [CharacterClass, RegExp][] = [
  ["rogue", /\b(?:security|compliance|secops|devsecops)\b/i],
  ["knight", /\b(?:platform|infra|infrastructure|sre|(?:dev|sec)?ops)\b/i],
  ["wizard", /\b(?:data|ml|ai|research\w*)\b/i],
];

export function classFromKeywords(headline: string, about: string): CharacterClass {
  const text = `${headline} ${about}`;
  return RULES.find(([, re]) => re.test(text))?.[0] ?? "bard";
}
