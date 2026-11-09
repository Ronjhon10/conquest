import type {
  CreateAttendeeRequest,
  DraftAttendeeRequest,
  DraftAttendeeResponse,
} from "@conquest/contracts";

export type ProfileFields = {
  linkedin_url: string;
  name: string;
  headline: string;
  about: string;
};
export type ProfileErrors = Partial<Record<keyof ProfileFields, string>>;

/** Format validation only. No LinkedIn request, scraping or OAuth. */
export function normalizeLinkedIn(value: string): string | null {
  try {
    const input = value.trim();
    const url = new URL(
      /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`,
    );
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    if (!/^(?:(?:www|[a-z]{2})\.)?linkedin\.com$/i.test(url.hostname))
      return null;
    const match = /^\/in\/([^/]+)\/?$/.exec(url.pathname);
    if (!match?.[1]) return null;
    const slug = decodeURIComponent(match[1]);
    if (!/^[\p{L}\p{N}_.~-]+$/u.test(slug)) return null;
    return `https://www.linkedin.com/in/${encodeURIComponent(slug)}/`;
  } catch {
    return null;
  }
}
export function validateProfile(fields: ProfileFields): ProfileErrors {
  return {
    ...(!normalizeLinkedIn(fields.linkedin_url)
      ? {
          linkedin_url:
            "Enter a LinkedIn profile link, such as linkedin.com/in/your-name.",
        }
      : {}),
    ...(!fields.name.trim() ? { name: "Enter your name." } : {}),
  };
}
export function draftRequest(
  conference_id: string,
  fields: ProfileFields,
): DraftAttendeeRequest {
  const linkedin_url = normalizeLinkedIn(fields.linkedin_url);
  if (!linkedin_url || !fields.name.trim())
    throw new Error("Check your profile details.");
  return {
    conference_id,
    linkedin_url,
    name: fields.name.trim(),
    headline: fields.headline.trim(),
    about: fields.about.trim(),
  };
}
export function initialGoals(draft: DraftAttendeeResponse): string[] {
  return [
    ...new Set(draft.suggested_goals.map((g) => g.trim()).filter(Boolean)),
  ].slice(0, 6);
}
export function attendeeRequest(
  profile: DraftAttendeeRequest,
  draft: DraftAttendeeResponse,
  characterClass: CreateAttendeeRequest["class"],
  goals: string[],
  photo: string | null,
): CreateAttendeeRequest {
  return {
    ...profile,
    class: characterClass,
    avatar_seed: draft.avatar_seed,
    goals,
    ...(photo ? { photo } : {}),
  };
}
