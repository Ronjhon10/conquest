export type LinkedinProfileImport = { name: string; photo: string | null };

// Auth requests use a separate same-origin client; no provider tokens reach it.
export async function importLinkedinProfile(
  conference: string,
  signal: AbortSignal,
): Promise<LinkedinProfileImport> {
  const response = await fetch(
    `/api/auth/linkedin/profile?conference=${encodeURIComponent(conference)}`,
    { cache: "no-store", signal },
  );
  if (!response.ok) throw new Error("LinkedIn import unavailable");
  const data = await response.json();
  if (
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.length > 200
  )
    throw new Error("Invalid LinkedIn profile");
  const photo =
    typeof data.photo === "string" &&
    data.photo.startsWith("data:image/jpeg;base64,") &&
    data.photo.length <= 40 * 1024
      ? data.photo
      : null;
  return { name: data.name, photo };
}
