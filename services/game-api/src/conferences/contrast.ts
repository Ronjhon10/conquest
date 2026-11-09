// WCAG 2.x contrast ratio between two #rrggbb colors (030 Behavior 1: fg on bg must be >= 4.5).
export const MIN_CONTRAST = 4.5;

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Ratio from 1 (identical) to 21 (black on white). Order of arguments does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
const toRgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * fg unchanged if it already reads on bg; otherwise fg mixed toward white or black (whichever
 * contrasts more with bg) in 5% steps until it passes MIN_CONTRAST. One of the two always
 * passes, so this always returns a readable color.
 */
export function readableFg(fg: string, bg: string): string {
  if (contrastRatio(fg, bg) >= MIN_CONTRAST) return fg;
  const target = contrastRatio("#ffffff", bg) >= contrastRatio("#000000", bg) ? [255, 255, 255] : [0, 0, 0];
  const from = toRgb(fg);
  for (let t = 0.05; t < 1; t += 0.05) {
    const mixed = toHex(from.map((c, i) => c + (target[i]! - c) * t));
    if (contrastRatio(mixed, bg) >= MIN_CONTRAST) return mixed;
  }
  return toHex(target);
}
