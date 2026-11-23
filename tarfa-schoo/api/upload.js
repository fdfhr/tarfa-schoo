import supabase from './db-client.js';
import { cors, requireAuth, STAFF, TEACHING, HttpError, handleError } from '../lib/server.js';

const BUCKETS = { avatars: TEACHING, channel: STAFF };
const ALLOWED_TYPES = {
  avatars: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' },
  channel: {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'application/pdf': 'pdf',
  },
};
const MAX_BYTES = 3 * 1024 * 1024;

// Checks the file's leading bytes so a renamed file cannot pass as an allowed type.
function matchesSignature(buf, type) {
  const h = buf.subarray(0, 12);
  if (type === 'image/jpeg') return h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  if (type === 'image/png') return h.subarray(0, 4).toString('hex') === '89504e47';
  if (type === 'image/gif') return h.subarray(0, 3).toString() === 'GIF';
  if (type === 'image/webp') return h.subarray(0, 4).toString() === 'RIFF' && h.subarray(8, 12).toString() === 'WEBP';
  if (type === 'application/pdf') return h.subarray(0, 5).toString() === '%PDF-';
  if (type === 'video/webm') return h.subarray(0, 4).toString('hex') === '1a45dfa3';
  if (type === 'video/mp4') return h.subarray(4, 8).toString() === 'ftyp';
  return false;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const profile = await requireAuth(req, res);
    if (!profile) return;
    const { bucket, fileName, fileBase64, contentType } = req.body || {};
    const roles = BUCKETS[bucket];
    if (!roles) throw new HttpError(400, 'مكان الرفع غير صحيح');
    if (!roles.includes(profile.role)) throw new HttpError(403, 'ليست لديك صلاحية للرفع هنا');
    if (!fileBase64) throw new HttpError(400, 'لم يُرفع أي ملف');
    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > MAX_BYTES) throw new HttpError(413, 'حجم الملف يجب ألا يتجاوز 3 ميجابايت');
    const type = String(contentType || '').toLowerCase();
    const ext = ALLOWED_TYPES[bucket][type];
    if (!ext) throw new HttpError(400, 'نوع الملف غير مسموح به');
    if (!matchesSignature(buffer, type)) throw new HttpError(400, 'محتوى الملف لا يطابق نوعه');
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, { contentType: type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return res.status(200).json({ url: data.publicUrl });
  } catch (err) {
    return handleError(res, err);
  }
}
