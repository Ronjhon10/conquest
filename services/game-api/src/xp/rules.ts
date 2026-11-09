// The ONLY place the XP table, limits and level formula live (030 Behavior 6, 11, 12).
export const XP = {
  bossCheckin: 150,
  checkin: 100,
  photo: 25,
  network: 50,
} as const;

export const PHOTO_LIMIT = 6;
/** 030 Behavior 7: bonus when a party member already checked into the same talk. */
export const PARTY_MULTIPLIER = 1.25;
/** 030 Behavior 14: max party members. */
export const MAX_PARTY_SIZE = 4;
export const BOSS_COIN_REWARD = 1;

export function checkinBaseXp(isBoss: boolean): number {
  return isBoss ? XP.bossCheckin : XP.checkin;
}

/** 030 Behavior 7: xp = round(base_xp * multiplier). */
export function applyMultiplier(baseXp: number, multiplier: number): number {
  return Math.round(baseXp * multiplier);
}

/** 030 Behavior 12. */
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}
