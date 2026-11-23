import supabase from './db-client.js';
import { cors, requireAuth, normEmail, toNum, syncAccount, deleteAccountByEmail, emailTaken, HttpError, handleError } from '../lib/server.js';

// Deputy (assistant) accounts: managed by the admin only.
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res, ['admin']);
    if (!profile) return;
    const b = req.body || {};

    if (req.method === 'GET') {
      const { data } = await supabase
        .from('profiles')
        .select('id,email,full_name,phone')
        .eq('role', 'assistant')
        .order('full_name');
      return res.status(200).json(data || []);
    }

    const fullName = String(b.full_name || '').trim();
    const phone = String(b.phone || '').trim();
    const email = normEmail(b.email);
    if (req.method === 'POST' || req.method === 'PUT') {
      if (!fullName) throw new HttpError(400, 'الاسم مطلوب');
      if (!phone) throw new HttpError(400, 'الهاتف مطلوب');
    }

    if (req.method === 'POST') {
      if (await emailTaken(email)) throw new HttpError(409, 'البريد الإلكتروني مستخدم بالفعل');
      await syncAccount({ currentEmail: '', newEmail: email, password: String(b.password || ''), role: 'assistant', fullName, phone, refId: null });
      const { data } = await supabase.from('profiles').select('id,email,full_name,phone').eq('email', email).maybeSingle();
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const id = toNum(b.id);
      const { data: p } = await supabase.from('profiles').select('*').eq('id', id).eq('role', 'assistant').maybeSingle();
      if (!p) throw new HttpError(404, 'حساب المساعد غير موجود');
      await syncAccount({ currentEmail: p.email, newEmail: email, password: String(b.password || ''), role: 'assistant', fullName, phone, refId: null });
      const { data } = await supabase.from('profiles').select('id,email,full_name,phone').eq('id', id).maybeSingle();
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const id = toNum(b.id);
      const { data: p } = await supabase.from('profiles').select('*').eq('id', id).eq('role', 'assistant').maybeSingle();
      if (!p) throw new HttpError(404, 'حساب المساعد غير موجود');
      await deleteAccountByEmail(p.email);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
