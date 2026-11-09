import sharp from "sharp";
import { JPEG_PREFIX, SHEET_MARKER } from "./character-sheet";

export async function prepareCharacterSheet(
  input: Uint8Array,
): Promise<string> {
  const base = await sharp(input, { limitInputPixels: 16_000_000 })
    .rotate()
    .resize(256, 256, { fit: "fill", kernel: "nearest" })
    .flatten({ background: "#eee9dd" })
    .png()
    .toBuffer();
  // Reuse the exact same head/hair pixels; generation cannot drift between classes.
  const head = await sharp(base)
    .extract({ left: 0, top: 0, width: 128, height: 48 })
    .png()
    .toBuffer();
  const locked = sharp(base).composite([
    { input: head, left: 128, top: 0 },
    { input: head, left: 0, top: 128 },
    { input: head, left: 128, top: 128 },
  ]);
  for (const quality of [95, 85, 75, 60, 45]) {
    const jpeg = await locked
      .clone()
      .jpeg({ quality, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const comment = Buffer.from(SHEET_MARKER, "ascii");
    const header = Buffer.alloc(4);
    header[0] = 0xff;
    header[1] = 0xfe;
    header.writeUInt16BE(comment.length + 2, 2);
    const marked = Buffer.concat([
      jpeg.subarray(0, 2),
      header,
      comment,
      jpeg.subarray(2),
    ]);
    const photo = JPEG_PREFIX + marked.toString("base64");
    if (photo.length <= 40 * 1024) return photo;
  }
  throw new Error("Character art could not fit the profile image limit.");
}
