import supabase from './db-client.js';
import { clip } from '../lib/server.js';
import { cors, requireAuth, getSettings, HttpError, handleError } from '../lib/server.js';

const KEYS = ['school_name', 'grading_scale', 'ai_config'];

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const all = await getSettings();
      delete all.setup_code_hash;
      delete all.setup_attempts;
      delete all.about;
      return res.status(200).json(all);
    }
    if (req.method === 'PUT') {
      const profile = await requireAuth(req, res, ['admin']);
      if (!profile) return;
      const { key, value } = req.body || {};
      if (key === 'about') throw new HttpError(403, 'بيانات المطورين وإدارة المدرسة ثابتة ولا يمكن تعديلها');
      if (!KEYS.includes(key)) throw new HttpError(400, 'إعداد غير معروف');
      if (JSON.stringify(value ?? null).length > 20000) throw new HttpError(400, 'حجم الإعداد كبير جداً');
      if (key === 'school_name') clip(value, 120, 'اسم المدرسة');
      const { data: existing } = await supabase.from('settings').select('key').eq('key', key).maybeSingle();
      const r = existing
        ? await supabase.from('settings').update({ value }).eq('key', key)
        : await supabase.from('settings').insert({ key, value });
      if (r.error) throw r.error;
      return res.status(200).json({ ok: true, key, value });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
