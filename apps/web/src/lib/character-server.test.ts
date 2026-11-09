import { expect, it, vi } from "vitest";
import sharp from "sharp";
import { prepareCharacterSheet } from "./character-sheet-server";
import {
  isCharacterSheet,
  JPEG_PREFIX,
  outfitPosition,
} from "./character-sheet";
import {
  characterJob,
  generateCharacter,
  signJob,
  verifyJob,
} from "./character-server";
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
const started = () => Response.json({ id: "resp_test123", status: "queued" });
it("WEB-24 starts a background job and returns a marked 256-square JPEG below the existing photo limit when it completes", async () => {
  const source = await image();
  const photo =
    JPEG_PREFIX + (await sharp(source).jpeg().toBuffer()).toString("base64");
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(started());
  const now = () => 1_000_000;
  const start = await generateCharacter(request(photo), {
    key: "test-key",
    reference: async () => source,
    fetcher,
    now,
  });
  const started_ = await start.json();
  expect(started_).toMatchObject({ photo: null, reason: null });
  expect(typeof started_.job).toBe("string");
  expect(start.headers.get("cache-control")).toBe("no-store");
  expect(JSON.stringify(started_)).not.toContain("test-key");
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toBe("https://api.openai.com/v1/responses");
  const body = JSON.parse(init!.body as string);
  expect(body.background).toBe(true);
  expect(body.tools[0]).toMatchObject({
    type: "image_generation",
    model: "gpt-image-2",
  });
  expect(
    body.input[0].content.filter(
      (part: { type: string }) => part.type === "input_image",
    ),
  ).toHaveLength(2);

  const check = (status: string, result?: string) =>
    vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: "resp_test123",
        status,
        output: result ? [{ type: "image_generation_call", result }] : [],
      }),
    );
  const poll = (fetcher: typeof fetch) =>
    characterJob(
      new Request(
        `http://localhost:3000/api/characters?job=${encodeURIComponent(started_.job)}`,
      ),
      { key: "test-key", fetcher, now: () => 1_030_000 },
    );
  const pendingFetcher = check("in_progress");
  expect(await (await poll(pendingFetcher)).json()).toEqual({
    photo: null,
    reason: null,
    pending: true,
  });
  expect(pendingFetcher.mock.calls[0]![0]).toBe(
    "https://api.openai.com/v1/responses/resp_test123",
  );
  const done = await poll(check("completed", source.toString("base64")));
  const output = await done.json();
  expect(isCharacterSheet(output.photo)).toBe(true);
  expect(output.photo.length).toBeLessThanOrEqual(40 * 1024);
  expect(done.headers.get("cache-control")).toBe("no-store");
  const metadata = await sharp(
    Buffer.from(output.photo.slice(JPEG_PREFIX.length), "base64"),
  ).metadata();
  expect(metadata).toMatchObject({ format: "jpeg", width: 256, height: 256 });
  expect(await (await poll(check("failed"))).json()).toEqual({
    photo: null,
    reason: "unavailable",
  });
});
it("WEB-24 rejects forged, tampered and expired jobs without contacting OpenAI", async () => {
  const fetcher = vi.fn<typeof fetch>();
  const job = signJob("test-key", "resp_abc", 1_000_000);
  const poll = (job: string, key = "test-key", at = 1_000_500) =>
    characterJob(
      new Request(
        `http://localhost:3000/api/characters?job=${encodeURIComponent(job)}`,
      ),
      { key, fetcher, now: () => at },
    );
  expect(verifyJob("test-key", job, 1_000_500)).toBe("resp_abc");
  for (const response of [
    await poll(job.replace("resp_abc", "resp_abd")),
    await poll(job, "other-key"),
    await poll(job, "test-key", 1_000_000 + 11 * 60_000),
    await poll("resp_abc.1000000.short"),
    await poll(""),
  ])
    expect(response.status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
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
  expect(
    await (
      await characterJob(
        new Request("http://localhost:3000/api/characters?job=x"),
        { key: "", fetcher },
      )
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
