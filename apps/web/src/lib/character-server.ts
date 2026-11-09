import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { errorBody } from "@conquest/contracts";
import { prepareCharacterSheet } from "./character-sheet-server";
import { JPEG_PREFIX, isCharacterSheet } from "./character-sheet";

export const CHARACTER_PROMPT = `Use image 1 as the identity reference and image 2 only as the pixel-art style and layout reference. Redraw the person from image 1 as ONE recognizable detailed pixel-art conference adventurer: preserve their face shape, skin tone, hairstyle and hair colour, glasses, facial hair and apparent age. Do not copy the face from image 2. Make a square 2x2 outfit sheet, four equal cells without gutters or text, with uniform pale warm grey #eee9dd background. In each cell: the SAME person at the SAME scale and front-facing full-body standing pose. The entire head and hair must fit in the top 37.5% of each cell; neck and outfit start below that line. No hats, helmets or hoods. Outfit order: top-left knight in slate armour with gold trim and compact shield; top-right wizard in indigo robes with book and a wand held low; bottom-left rogue in dark green leather with utility pouches; bottom-right bard in moss green jacket and cream scarf with a small lute held low. Gold conference badge lanyard and boots in every outfit. All hands covered by gloves matching the outfit. Equipment stays below the head. Outfit and equipment are the only differences. Clean chunky shaded pixels matching image 2, no photographic texture, scenery, labels, borders or UI. Centre each person and keep all feet visible. The head region of the first cell will be reused unchanged in all four cells.`;

let active = 0;
let windowStart = 0;
let attempts = 0;
const privateHeaders = { "Cache-Control": "no-store" };
function fallback(reason: string) {
  return Response.json({ photo: null, reason }, { headers: privateHeaders });
}
export async function generateCharacter(
  request: Request,
  options: {
    key?: string;
    model?: string;
    fetcher?: typeof fetch;
    reference?: () => Promise<Uint8Array>;
  } = {},
) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return Response.json(
      errorBody("invalid_origin", "Start character creation from Conquest."),
      { status: 403, headers: privateHeaders },
    );
  if (active >= 2) return fallback("busy");
  if (!request.body) return fallback("invalid_photo");
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
      return fallback("invalid_photo");
    }
    body += decoder.decode(result.value, { stream: true });
  }
  let photo: unknown;
  try {
    photo = JSON.parse(body).photo;
  } catch {
    return fallback("invalid_photo");
  }
  if (
    typeof photo !== "string" ||
    !photo.startsWith(JPEG_PREFIX) ||
    photo.length > 40 * 1024 ||
    isCharacterSheet(photo)
  )
    return fallback("invalid_photo");
  const key = options.key ?? process.env.OPENAI_API_KEY;
  if (!key?.trim()) return fallback("unconfigured");
  if (Date.now() - windowStart >= 60_000) {
    windowStart = Date.now();
    attempts = 0;
  }
  if (attempts >= 12) return fallback("busy");
  if (active >= 2) return fallback("busy");
  active++;
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
    const form = new FormData();
    form.set(
      "model",
      options.model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
    );
    form.set("prompt", CHARACTER_PROMPT);
    form.set("size", "1024x1024");
    form.set("quality", "medium");
    form.set("output_format", "jpeg");
    form.append(
      "image[]",
      new Blob([new Uint8Array(input)], { type: "image/jpeg" }),
      "person.jpg",
    );
    form.append(
      "image[]",
      new Blob([new Uint8Array(reference)], { type: "image/png" }),
      "style.png",
    );
    const response = await (options.fetcher ?? fetch)(
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(180_000)]),
        redirect: "error",
        cache: "no-store",
      },
    );
    if (!response.ok) return fallback("unavailable");
    const output = await response.json();
    const encoded = output?.data?.[0]?.b64_json;
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
  } finally {
    active--;
  }
}
