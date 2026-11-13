export const MAX_TRIP_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_TRIP_IMAGE_REQUEST_BYTES =
  MAX_TRIP_IMAGE_BYTES + 64 * 1024;
export const MAX_TRIP_IMAGES = 10;

export const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type TripImageMimeType = keyof typeof IMAGE_EXTENSIONS;

export function isTripImageMimeType(
  mimeType: string,
): mimeType is TripImageMimeType {
  return Object.hasOwn(IMAGE_EXTENSIONS, mimeType);
}

export async function getImageValidationError(
  file: Blob,
): Promise<string | null> {
  if (!isTripImageMimeType(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }

  if (file.size === 0) {
    return "The selected image is empty.";
  }

  if (file.size > MAX_TRIP_IMAGE_BYTES) {
    return "Images must be 50 MiB or smaller.";
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng =
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a;
  const isWebp =
    header.length >= 12 &&
    String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...header.slice(8, 12)) === "WEBP";

  const validSignature =
    (file.type === "image/jpeg" && isJpeg) ||
    (file.type === "image/png" && isPng) ||
    (file.type === "image/webp" && isWebp);

  return validSignature
    ? null
    : "The file contents do not match a supported image format.";
}
