import crypto from 'node:crypto';
import supabase from './db-client.js';
import { cors, normEmail, isValidEmail, syncAccount, HttpError, handleError } from '../lib/server.js';

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

async function adminCount() {
  const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
  return count || 0;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const admins = await adminCount();
      return res.status(200).json({ needed: admins === 0 });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if ((await adminCount()) > 0) throw new HttpError(403, 'تم إعداد حساب المدير مسبقاً');

    const b = req.body || {};
    const code = String(b.code || '').trim().toUpperCase();
    const fullName = String(b.full_name || '').trim();
    const phone = String(b.phone || '').trim();
    const email = normEmail(b.email);
    const password = String(b.password || '');

    const { data: row } = await supabase.from('settings').select('value').eq('key', 'setup_code_hash').maybeSingle();
    if (!row?.value?.hash) throw new HttpError(403, 'رمز الإعداد غير متاح، تواصل مع مطوّر النظام');

    const { data: lockRow } = await supabase.from('settings').select('value').eq('key', 'setup_attempts').maybeSingle();
    const fails = Number(lockRow?.value?.count || 0);
    if (fails >= 10) throw new HttpError(429, 'تم إيقاف المحاولات مؤقتاً بسبب كثرة الأخطاء، تواصل مع مطوّر النظام');

    const given = Buffer.from(sha256(code));
    const stored = Buffer.from(row.value.hash);
    if (!code || given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
      await supabase.from('settings').upsert({ key: 'setup_attempts', value: { count: fails + 1 } });
      throw new HttpError(403, 'رمز الإعداد غير صحيح');
    }
    if (!fullName) throw new HttpError(400, 'الاسم الكامل مطلوب');
    if (!phone) throw new HttpError(400, 'رقم الهاتف مطلوب');
    if (!isValidEmail(email)) throw new HttpError(400, 'البريد الإلكتروني غير صالح');
    if (password.length < 8) throw new HttpError(400, 'كلمة السر يجب ألا تقل عن 8 أحرف');

    await syncAccount({ currentEmail: '', newEmail: email, password, role: 'admin', fullName, phone, refId: null });
    // The one-time code is consumed so it cannot be reused.
    await supabase.from('settings').delete().in('key', ['setup_code_hash', 'setup_attempts']);
    return res.status(201).json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}
