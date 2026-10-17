// Browser-side photo preparation (plan §6): decode (HEIC included), longest
// side ≤ 1600 px, JPEG re-encode until ≤ 2 MB. Drawing to a canvas and
// re-encoding drops all metadata, so EXIF and GPS never leave the phone.

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 1600;
const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

const isHeic = (file: File) => /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // Safari decodes HEIC natively; every browser handles JPEG/PNG/WebP.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (error) {
    if (!isHeic(file)) throw error;
    const heic2any = (await import("heic2any")).default; // loaded only when needed
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    return createImageBitmap(Array.isArray(converted) ? converted[0] : converted, { imageOrientation: "from-image" });
  }
}

function encode(bitmap: ImageBitmap, scale: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Returns a metadata-free JPEG ≤ 2 MB, or throws with a Turkish message. */
export async function prepareImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    throw new Error("Bu fotoğraf açılamadı. JPEG, PNG, WebP veya HEIC seç.");
  }
  try {
    let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 4; attempt++) {
      for (const quality of QUALITIES) {
        const blob = await encode(bitmap, scale, quality);
        if (blob && blob.size <= MAX_IMAGE_BYTES) return blob;
      }
      scale *= 0.75; // still too big at the lowest quality: shrink and retry
    }
    throw new Error("Fotoğraf 2 MB'a küçültülemedi.");
  } finally {
    bitmap.close();
  }
}
