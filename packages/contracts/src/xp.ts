/** XP threshold at which the given level begins (030 Behavior 12). */
export function xpForLevel(level: number): number {
  return (level - 1) ** 2 * 100;
}
