export const PHOTO_SIZE = 256;
export const PHOTO_MAX_BYTES = 40 * 1024;
export function squareCrop(width: number, height: number) {
  if (width <= 0 || height <= 0)
    throw new Error("That image has no usable dimensions.");
  const side = Math.min(width, height);
  return { x: (width - side) / 2, y: (height - side) / 2, side };
}
/** ASCII data URLs use one byte per character. The entire URL must fit the API limit. */
export function encodePhoto(canvas: HTMLCanvasElement): string {
  for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]) {
    const data = canvas.toDataURL("image/jpeg", quality);
    if (
      data.startsWith("data:image/jpeg;base64,") &&
      data.length <= PHOTO_MAX_BYTES
    )
      return data;
  }
  throw new Error(
    "That photo couldn't be compressed enough. Try a simpler image.",
  );
}
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("Choose an image file for your profile photo.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose an image smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error(
        "That photo couldn't be opened. Try a JPEG, PNG, or WebP image.",
      );
    }
    const crop = squareCrop(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Your browser couldn't prepare this photo. You can continue without one.",
      );
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.side,
      crop.side,
      0,
      0,
      PHOTO_SIZE,
      PHOTO_SIZE,
    );
    return encodePhoto(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
