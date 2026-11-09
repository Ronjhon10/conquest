// Theme generation (030 Behavior 1): OpenAI JSON, validated; fallback on any failure or low contrast.
import { Theme } from "@conquest/contracts";
import type { Llm } from "../llm";
import { MIN_CONTRAST, contrastRatio } from "./contrast";

export function fallbackTheme(prompt: string): Theme {
  return {
    name: "Kube Caverns",
    prompt,
    palette: { bg: "#14111f", fg: "#f4efe6", accent: "#f2a541" },
    boss_noun: "boss",
    room_noun: "chamber",
    intro: "Torches flicker as you descend into the Kube Caverns. Seek out the bosses, gather allies, and claim your glory.",
  };
}

const GeneratedTheme = Theme.omit({ prompt: true });

export async function generateTheme(llm: Llm | null, themePrompt: string): Promise<Theme> {
  if (!llm) return fallbackTheme(themePrompt);
  let generated: Omit<Theme, "prompt"> | null;
  try {
    generated = await llm.json(
      {
        purpose: "theme",
        system:
          "You design the visual theme of a conference game. Reply with JSON only: " +
          '{"name": string, "palette": {"bg": "#rrggbb", "fg": "#rrggbb", "accent": "#rrggbb"}, ' +
          '"boss_noun": string, "room_noun": string, "intro": string (one or two sentences)}. ' +
          "Text color fg must have strong contrast on bg.",
        user: themePrompt,
      },
      GeneratedTheme,
    );
  } catch {
    generated = null;
  }
  if (!generated) return fallbackTheme(themePrompt);
  const theme: Theme = { ...generated, prompt: themePrompt };
  if (contrastRatio(theme.palette.fg, theme.palette.bg) < MIN_CONTRAST) return fallbackTheme(themePrompt);
  return theme;
}
