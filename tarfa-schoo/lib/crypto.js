import crypto from 'node:crypto';

// Keys are derived from the server-only service key, so no extra secret is needed.
// Encryption is deterministic (same input -> same ciphertext) so uniqueness checks still work.
function keys() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('مفتاح التشفير غير مهيأ على الخادم');
  return {
    enc: crypto.createHash('sha256').update('enc|' + secret).digest(),
    iv: crypto.createHash('sha256').update('iv|' + secret).digest(),
  };
}

const PREFIX = 'enc:v1:';

export function encryptField(plain) {
  if (plain === null || plain === undefined || plain === '') return plain;
  const k = keys();
  const iv = crypto.createHmac('sha256', k.iv).update(String(plain)).digest().subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k.enc, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

// Values stored before encryption was enabled are returned unchanged.
export function decryptField(value) {
  if (!value || !String(value).startsWith(PREFIX)) return value;
  const k = keys();
  const buf = Buffer.from(String(value).slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', k.enc, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
