// Converts any browser-readable image (JPG, PNG, WebP, GIF, BMP, AVIF, HEIC on supporting browsers...)
// into a resized JPEG before upload. The server only accepts JPEG/PNG/WebP/GIF with matching file signatures.

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 1024;

export const UNSUPPORTED_MSG =
  'تعذر قراءة هذه الصورة. استخدم صيغة JPG أو PNG أو WebP، أو صدّرها من الجهاز بصيغة JPG ثم أعد الرفع';

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> decoder.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Returns a JPEG File ready for upload. Throws a user-facing Arabic message on failure.
export async function toUploadableJpeg(file) {
  if (!file) throw new Error('لم يتم اختيار ملف');
  if (!String(file.type || '').startsWith('image/') && !/\.(heic|heif|bmp|tiff?|avif|jpe?g|png|webp|gif)$/i.test(file.name || '')) {
    throw new Error('الملف المختار ليس صورة');
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error('حجم الصورة كبير جداً (الحد الأقصى 15 ميجابايت)');
  if (file.size === 0) throw new Error('الملف فارغ');

  let source;
  try {
    source = await decode(file);
  } catch {
    throw new Error(UNSUPPORTED_MSG);
  }

  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  if (!w || !h) throw new Error(UNSUPPORTED_MSG);

  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(UNSUPPORTED_MSG);
  // White background so transparent PNG/WebP/GIF areas do not become black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (typeof source.close === 'function') source.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob || blob.size === 0) throw new Error(UNSUPPORTED_MSG);

  const base = String(file.name || 'photo').replace(/\.[^.]+$/, '').replace(/[^\w\-]/g, '_').slice(0, 60) || 'photo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
