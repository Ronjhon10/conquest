import { expect, it, vi } from "vitest";
import sharp from "sharp";
import { prepareCharacterSheet } from "./character-sheet-server";
import {
  isCharacterSheet,
  JPEG_PREFIX,
  outfitPosition,
} from "./character-sheet";
import { generateCharacter } from "./character-server";
const image = () =>
  sharp({
    create: { width: 256, height: 256, channels: 3, background: "#775588" },
  })
    .png()
    .toBuffer();
function request(photo: string, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/characters", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ photo }),
  });
}
it("WEB-24 generates and returns a marked 256-square JPEG below the existing photo limit", async () => {
  const source = await image();
  const photo =
    JPEG_PREFIX + (await sharp(source).jpeg().toBuffer()).toString("base64");
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ data: [{ b64_json: source.toString("base64") }] }),
    );
  const response = await generateCharacter(request(photo), {
    key: "test-key",
    reference: async () => source,
    fetcher,
  });
  const output = await response.json();
  expect(isCharacterSheet(output.photo)).toBe(true);
  expect(output.photo.length).toBeLessThanOrEqual(40 * 1024);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const metadata = await sharp(
    Buffer.from(output.photo.slice(JPEG_PREFIX.length), "base64"),
  ).metadata();
  expect(metadata).toMatchObject({ format: "jpeg", width: 256, height: 256 });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const init = fetcher.mock.calls[0]![1]!;
  const form = init.body as FormData;
  expect(form.get("model")).toBe("gpt-image-2");
  expect(form.getAll("image[]")).toHaveLength(2);
  expect(JSON.stringify(output)).not.toContain("test-key");
});
it("WEB-25 locks exactly the same head pixels into all four outfit cells", async () => {
  const input = await sharp({
    create: { width: 256, height: 256, channels: 3, background: "#bbaa77" },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 128,
            height: 48,
            channels: 3,
            background: "#334466",
          },
        })
          .png()
          .toBuffer(),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
  const photo = await prepareCharacterSheet(input);
  const jpeg = Buffer.from(photo.slice(JPEG_PREFIX.length), "base64");
  const first = await sharp(jpeg)
    .extract({ left: 0, top: 0, width: 128, height: 48 })
    .raw()
    .toBuffer();
  for (const characterClass of ["wizard", "rogue", "bard"] as const) {
    const { x, y } = outfitPosition(characterClass);
    const head = await sharp(jpeg)
      .extract({ left: x * 128, top: y * 128, width: 128, height: 48 })
      .raw()
      .toBuffer();
    expect(head.equals(first)).toBe(true);
  }
});
it("WEB-24 preserves the fallback without contacting OpenAI when settings or photos are missing", async () => {
  const fetcher = vi.fn<typeof fetch>();
  const photo =
    JPEG_PREFIX +
    (
      await sharp(await image())
        .jpeg()
        .toBuffer()
    ).toString("base64");
  expect(
    await (
      await generateCharacter(request(photo), { key: "", fetcher })
    ).json(),
  ).toEqual({ photo: null, reason: "unconfigured" });
  for (const invalid of [
    "https://external.example/photo.jpg",
    "data:image/png;base64,AAAA",
    JPEG_PREFIX + "A".repeat(42_000),
  ])
    expect(
      (
        await (
          await generateCharacter(request(invalid), { key: "test", fetcher })
        ).json()
      ).photo,
    ).toBeNull();
  expect(
    (
      await generateCharacter(request(photo, "https://external.example"), {
        key: "test",
        fetcher,
      })
    ).status,
  ).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
it("WEB-24 recovers from provider failures without exposing provider text or credentials", async () => {
  const source = await image();
  const photo =
    JPEG_PREFIX + (await sharp(source).jpeg().toBuffer()).toString("base64");
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new Error("private provider text"))
    .mockResolvedValueOnce(
      Response.json({ error: "private provider text" }, { status: 403 }),
    );
  for (let i = 0; i < 2; i++) {
    const data = await (
      await generateCharacter(request(photo), {
        key: "private-key",
        fetcher,
        reference: async () => source,
      })
    ).json();
    expect(data).toEqual({ photo: null, reason: "unavailable" });
  }
});
