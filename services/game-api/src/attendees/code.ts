// Join codes: 6 uppercase chars without 0 O 1 I (matches the Attendee.code schema).
import { randomInt } from "node:crypto";

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export function randomAvatarSeed(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += "0123456789abcdef"[randomInt(16)];
  return out;
}

/** A code no other attendee in the conference has; retries on collision. */
export async function uniqueCode(isTaken: (code: string) => Promise<boolean>, gen = randomCode): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const code = gen();
    if (!(await isTaken(code))) return code;
  }
  throw new Error("could not find a free attendee code");
}
