import { afterEach, expect, it, vi } from "vitest";
import { JPEG_PREFIX, SHEET_MARKER } from "./character-sheet";
import { createCharacter } from "./character";
afterEach(() => vi.unstubAllGlobals());
const sheet = JPEG_PREFIX + btoa(`\xff\xd8${SHEET_MARKER}`);
const photo = JPEG_PREFIX + "AAAA";
it("WEB-24 starts a job and checks it until the character is ready, staying under the 15 s gateway limit per request", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ photo: null, reason: null, job: "resp_1.2.sig" }),
    )
    .mockResolvedValueOnce(
      Response.json({ photo: null, reason: null, pending: true }),
    )
    .mockResolvedValueOnce(
      new Response("upstream request timeout", { status: 504 }),
    )
    .mockResolvedValueOnce(Response.json({ photo: sheet, reason: null }));
  vi.stubGlobal("fetch", fetcher);
  const result = await createCharacter(photo, new AbortController().signal, 1);
  expect(result).toEqual({ photo: sheet, reason: null });
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(fetcher.mock.calls[0]![1]!.method).toBe("POST");
  expect(fetcher.mock.calls[1]![0]).toBe("/api/characters?job=resp_1.2.sig");
});
it("WEB-24 returns fallback reasons from the start or the check without throwing", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ photo: null, reason: "unconfigured" }),
      )
      .mockResolvedValueOnce(
        Response.json({ photo: null, reason: null, job: "j" }),
      )
      .mockResolvedValueOnce(
        Response.json({ photo: null, reason: "unavailable" }),
      ),
  );
  const signal = new AbortController().signal;
  expect(await createCharacter(photo, signal, 1)).toEqual({
    photo: null,
    reason: "unconfigured",
  });
  expect(await createCharacter(photo, signal, 1)).toEqual({
    photo: null,
    reason: "unavailable",
  });
});
it("WEB-24 gives up after repeated failed checks and stops when cancelled", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ photo: null, reason: null, job: "j" }),
      )
      .mockResolvedValue(new Response("", { status: 502 })),
  );
  await expect(
    createCharacter(photo, new AbortController().signal, 1),
  ).rejects.toThrow("Character creation isn't available right now");
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ photo: null, reason: null, job: "j" }));
  vi.stubGlobal("fetch", fetcher);
  const controller = new AbortController();
  const pending = createCharacter(photo, controller.signal, 60_000);
  await new Promise((resolve) => setTimeout(resolve, 10));
  controller.abort();
  await expect(pending).rejects.toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
