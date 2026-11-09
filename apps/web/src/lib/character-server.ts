import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { errorBody } from "@conquest/contracts";
import { prepareCharacterSheet } from "./character-sheet-server";
import { JPEG_PREFIX, isCharacterSheet } from "./character-sheet";

export const CHARACTER_PROMPT = `Use image 1 as the identity reference and image 2 only as the pixel-art style and layout reference. Redraw the person from image 1 as ONE recognizable detailed pixel-art conference adventurer: preserve their face shape, skin tone, hairstyle and hair colour, glasses, facial hair and apparent age. Do not copy the face from image 2. Make a square 2x2 outfit sheet, four equal cells without gutters or text, with uniform pale warm grey #eee9dd background. In each cell: the SAME person at the SAME scale and front-facing full-body standing pose. The entire head and hair must fit in the top 37.5% of each cell; neck and outfit start below that line. No hats, helmets or hoods. Outfit order: top-left knight in slate armour with gold trim and compact shield; top-right wizard in indigo robes with book and a wand held low; bottom-left rogue in dark green leather with utility pouches; bottom-right bard in moss green jacket and cream scarf with a small lute held low. Gold conference badge lanyard and boots in every outfit. All hands covered by gloves matching the outfit. Equipment stays below the head. Outfit and equipment are the only differences. Clean chunky shaded pixels matching image 2, no photographic texture, scenery, labels, borders or UI. Centre each person and keep all feet visible. The head region of the first cell will be reused unchanged in all four cells.`;

// The platform gateway ends every request after 15 s and image generation
// takes about a minute, so POST starts an OpenAI background response and
// returns a signed job; GET checks it. OpenAI holds the job, so any web
// replica can answer the check.
const JOB_TTL_MS = 10 * 60_000;
const OPENAI = "https://api.openai.com/v1/responses";
let windowStart = 0;
let attempts = 0;
const privateHeaders = { "Cache-Control": "no-store" };
type Options = {
  key?: string;
  model?: string;
  imageModel?: string;
  fetcher?: typeof fetch;
  reference?: () => Promise<Uint8Array>;
  now?: () => number;
};
function fallback(reason: string) {
  return Response.json({ photo: null, reason }, { headers: privateHeaders });
}
function configuredKey(options: Options) {
  const key = options.key ?? process.env.OPENAI_API_KEY;
  return key?.trim() ? key : null;
}
function signature(key: string, payload: string) {
  const secret = createHash("sha256")
    .update(`conquest-character-job:${key}`)
    .digest();
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
export function signJob(key: string, id: string, issuedAt: number) {
  const payload = `${id}.${issuedAt}`;
  return `${payload}.${signature(key, payload)}`;
}
export function verifyJob(key: string, job: string, now: number) {
  const match =
    /^(resp_[A-Za-z0-9_-]{1,200})\.(\d{1,15})\.([A-Za-z0-9_-]{43})$/.exec(job);
  if (!match) return null;
  const [, id, issued, sig] = match;
  const expected = Buffer.from(signature(key, `${id}.${issued}`));
  const given = Buffer.from(sig!);
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return null;
  const age = now - Number(issued);
  if (age < 0 || age > JOB_TTL_MS) return null;
  return id!;
}
async function readPhoto(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  let body = "";
  let bytesRead = 0;
  const decoder = new TextDecoder();
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    bytesRead += result.value.byteLength;
    if (bytesRead > 43_000) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(result.value, { stream: true });
  }
  let photo: unknown;
  try {
    photo = JSON.parse(body).photo;
  } catch {
    return null;
  }
  if (
    typeof photo !== "string" ||
    !photo.startsWith(JPEG_PREFIX) ||
    photo.length > 40 * 1024 ||
    isCharacterSheet(photo)
  )
    return null;
  return photo;
}
export async function generateCharacter(
  request: Request,
  options: Options = {},
) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return Response.json(
      errorBody("invalid_origin", "Start character creation from Conquest."),
      { status: 403, headers: privateHeaders },
    );
  const photo = await readPhoto(request);
  if (!photo) return fallback("invalid_photo");
  const key = configuredKey(options);
  if (!key) return fallback("unconfigured");
  const now = options.now ?? Date.now;
  if (now() - windowStart >= 60_000) {
    windowStart = now();
    attempts = 0;
  }
  if (attempts >= 12) return fallback("busy");
  attempts++;
  try {
    const original = Buffer.from(photo.slice(JPEG_PREFIX.length), "base64");
    const input = await sharp(original, { limitInputPixels: 4_000_000 })
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .jpeg()
      .toBuffer();
    const reference = await (options.reference?.() ??
      readFile(
        path.join(process.cwd(), "public/characters/wardrobe-source-v1.png"),
      ));
    const response = await (options.fetcher ?? fetch)(OPENAI, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? process.env.OPENAI_CHARACTER_MODEL ?? "gpt-5",
        background: true,
        store: true,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: CHARACTER_PROMPT },
              {
                type: "input_image",
                image_url: `data:image/jpeg;base64,${input.toString("base64")}`,
              },
              {
                type: "input_image",
                image_url: `data:image/png;base64,${Buffer.from(reference).toString("base64")}`,
              },
            ],
          },
        ],
        tools: [
          {
            type: "image_generation",
            model:
              options.imageModel ??
              process.env.OPENAI_IMAGE_MODEL ??
              "gpt-image-2",
            size: "1024x1024",
            quality: "medium",
            output_format: "jpeg",
          },
        ],
        tool_choice: { type: "image_generation" },
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) return fallback("unavailable");
    const id = (await response.json())?.id;
    if (typeof id !== "string" || !id.startsWith("resp_"))
      return fallback("unavailable");
    return Response.json(
      { photo: null, reason: null, job: signJob(key, id, now()) },
      { headers: privateHeaders },
    );
  } catch {
    return fallback("unavailable");
  }
}
export async function characterJob(request: Request, options: Options = {}) {
  const key = configuredKey(options);
  if (!key) return fallback("unconfigured");
  const job = new URL(request.url).searchParams.get("job") ?? "";
  const id = verifyJob(key, job, (options.now ?? Date.now)());
  if (!id)
    return Response.json(errorBody("invalid_job", "Start a new character."), {
      status: 400,
      headers: privateHeaders,
    });
  try {
    const response = await (options.fetcher ?? fetch)(
      `${OPENAI}/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
        redirect: "error",
        cache: "no-store",
      },
    );
    if (!response.ok) return fallback("unavailable");
    const output = await response.json();
    if (output?.status === "queued" || output?.status === "in_progress")
      return Response.json(
        { photo: null, reason: null, pending: true },
        { headers: privateHeaders },
      );
    if (output?.status !== "completed") return fallback("unavailable");
    const encoded = (Array.isArray(output.output) ? output.output : []).find(
      (item: { type?: unknown }) => item?.type === "image_generation_call",
    )?.result;
    if (typeof encoded !== "string" || encoded.length > 12_000_000)
      return fallback("unavailable");
    return Response.json(
      {
        photo: await prepareCharacterSheet(Buffer.from(encoded, "base64")),
        reason: null,
      },
      { headers: privateHeaders },
    );
  } catch {
    return fallback("unavailable");
  }
}
