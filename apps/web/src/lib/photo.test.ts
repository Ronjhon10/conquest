// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { prepareProfilePhoto, PHOTO_MAX_BYTES, squareCrop } from "./photo";
afterEach(() => vi.restoreAllMocks());
it("WEB-15 crops landscape and portrait images to their centered square", () => {
  expect(squareCrop(1200, 800)).toEqual({ x: 200, y: 0, side: 800 });
  expect(squareCrop(600, 1000)).toEqual({ x: 0, y: 200, side: 600 });
});
it("WEB-15 prepares a 256-square JPEG and lowers quality until the full data URL fits 40 KB", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:photo");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue();
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    1200,
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(
    800,
  );
  const draw = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect: vi.fn(),
    drawImage: draw,
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D);
  const encode = vi
    .spyOn(HTMLCanvasElement.prototype, "toDataURL")
    .mockImplementation(function (this: HTMLCanvasElement, _type, quality) {
      expect(this.width).toBe(256);
      expect(this.height).toBe(256);
      return `data:image/jpeg;base64,${Number(quality) > 0.6 ? "A".repeat(PHOTO_MAX_BYTES) : "AAAA"}`;
    });
  const photo = await prepareProfilePhoto(
    new File(["image"], "profile.png", { type: "image/png" }),
  );
  expect(photo.length).toBeLessThanOrEqual(PHOTO_MAX_BYTES);
  expect(photo.startsWith("data:image/jpeg;base64,")).toBe(true);
  expect(draw.mock.calls[0]?.slice(1)).toEqual([
    200, 0, 800, 800, 0, 0, 256, 256,
  ]);
  expect(encode.mock.calls.length).toBeGreaterThan(1);
  expect(revoke).toHaveBeenCalledWith("blob:photo");
});
it("WEB-15 rejects unreadable files without leaking an object URL", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:bad-photo");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLImageElement.prototype, "decode").mockRejectedValue(
    new Error("bad image"),
  );
  await expect(
    prepareProfilePhoto(new File(["bad"], "bad.jpg", { type: "image/jpeg" })),
  ).rejects.toThrow("couldn't be opened");
  expect(revoke).toHaveBeenCalledWith("blob:bad-photo");
  await expect(
    prepareProfilePhoto(new File(["text"], "text.txt", { type: "text/plain" })),
  ).rejects.toThrow("Choose an image");
});
