// src/utils/imageCompression.js
//
// Downscale + re-encode a POD photo before it goes into the offline queue.
// Drivers are often on spotty mobile connections when a queued POD finally
// syncs, and a raw 12MP phone capture can be several MB — far more than a
// proof-of-delivery thumbnail needs. Compressing BEFORE enqueue keeps the
// IndexedDB blob small and the eventual upload fast.
//
// Safe by construction: on any failure (or if compression somehow produces a
// larger file) it returns the ORIGINAL file, so a POD is never lost or degraded
// into an unusable state just because compression hiccupped.

const DEFAULTS = { maxDimension: 1600, quality: 0.7, mimeType: "image/jpeg" };

function loadImage(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = objectUrl;
  });
}

/**
 * Compress an image File/Blob for offline POD queuing.
 * @param {File|Blob} file
 * @param {{maxDimension?: number, quality?: number, mimeType?: string}} [opts]
 * @returns {Promise<File|Blob>} a smaller image, or the original on any failure.
 */
export async function compressImage(file, opts = {}) {
  const { maxDimension, quality, mimeType } = { ...DEFAULTS, ...opts };

  // Only attempt on real images in a browser with canvas support.
  if (!file || !file.type || !file.type.startsWith("image/")) return file;
  if (typeof document === "undefined" || typeof URL === "undefined") return file;

  let objectUrl;
  try {
    objectUrl = URL.createObjectURL(file);
    const img = await loadImage(objectUrl);

    const longest = Math.max(img.width, img.height);
    const scale = longest > maxDimension ? maxDimension / longest : 1;
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
    if (!blob) return file;
    // Never hand back something bigger than we started with.
    if (blob.size >= file.size) return file;

    const name = (file.name || "delivery-photo.jpg").replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], name, { type: mimeType });
  } catch {
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
