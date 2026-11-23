import supabase from './db-client.js';
import { cors, requireAuth, STAFF, normEmail, toNum, syncAccount, deleteAccountByEmail, emailTaken, HttpError, handleError } from '../lib/server.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res, STAFF);
    if (!profile) return;
    const b = req.body || {};

    if (req.method === 'GET') {
      const { data: gs } = await supabase.from('guardians').select('*').order('full_name');
      const { data: links } = await supabase.from('guardian_students').select('guardian_id,student_id');
      const sIds = [...new Set((links || []).map((l) => l.student_id))];
      const { data: studs } = await supabase.from('students').select('id,full_name,class_id').in('id', sIds.length ? sIds : [-1]);
      const { data: classes } = await supabase.from('classes').select('id,name');
      const sMap = Object.fromEntries((studs || []).map((s) => [s.id, s]));
      const cMap = Object.fromEntries((classes || []).map((c) => [c.id, c.name]));
      return res.status(200).json((gs || []).map((g) => {
        const ids = (links || []).filter((l) => l.guardian_id === g.id).map((l) => l.student_id);
        return {
          ...g,
          student_ids: ids,
          students: ids.map((id) => sMap[id]).filter(Boolean).map((s) => ({ id: s.id, full_name: s.full_name, class_name: cMap[s.class_id] || '' })),
        };
      }));
    }

    const fullName = String(b.full_name || '').trim();
    const relation = String(b.relation || '').trim();
    const phone = String(b.phone || '').trim();
    const studentIds = (Array.isArray(b.student_ids) ? b.student_ids : []).map(Number).filter(Boolean);

    if (req.method === 'POST') {
      const email = normEmail(b.email);
      if (!fullName) throw new HttpError(400, 'اسم ولي الأمر مطلوب');
      if (!relation) throw new HttpError(400, 'صلة القرابة مطلوبة');
      if (!phone) throw new HttpError(400, 'رقم الهاتف مطلوب');
      if (await emailTaken(email)) throw new HttpError(409, 'البريد الإلكتروني مستخدم بالفعل');
      const { data: g, error } = await supabase
        .from('guardians')
        .insert({ full_name: fullName, relation, phone, email })
        .select()
        .single();
      if (error) throw error;
      try {
        await syncAccount({ currentEmail: '', newEmail: email, password: String(b.password || ''), role: 'guardian', fullName, phone, refId: g.id });
      } catch (e) {
        await supabase.from('guardians').delete().eq('id', g.id);
        throw e;
      }
      if (studentIds.length) {
        await supabase.from('guardian_students').insert(studentIds.map((s) => ({ guardian_id: g.id, student_id: s })));
      }
      return res.status(201).json(g);
    }

    if (req.method === 'PUT') {
      const id = toNum(b.id);
      if (!id) throw new HttpError(400, 'معرّف ولي الأمر مطلوب');
      const { data: g } = await supabase.from('guardians').select('*').eq('id', id).maybeSingle();
      if (!g) throw new HttpError(404, 'ولي الأمر غير موجود');
      if (!fullName || !relation || !phone) throw new HttpError(400, 'الاسم والصلة والهاتف مطلوبة');
      const email = normEmail(b.email || g.email);
      await syncAccount({
        currentEmail: g.email, newEmail: email, password: String(b.password || ''),
        role: 'guardian', fullName, phone, refId: id,
      });
      const { data, error } = await supabase
        .from('guardians')
        .update({ full_name: fullName, relation, phone, email })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (Array.isArray(b.student_ids)) {
        await supabase.from('guardian_students').delete().eq('guardian_id', id);
        if (studentIds.length) {
          await supabase.from('guardian_students').insert(studentIds.map((s) => ({ guardian_id: id, student_id: s })));
        }
      }
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      if (profile.role !== 'admin') throw new HttpError(403, 'حذف ولي الأمر للمدير فقط');
      const id = toNum(b.id);
      const { data: g } = await supabase.from('guardians').select('*').eq('id', id).maybeSingle();
      if (!g) throw new HttpError(404, 'ولي الأمر غير موجود');
      await supabase.from('guardian_students').delete().eq('guardian_id', id);
      if (g.email) await deleteAccountByEmail(g.email);
      const { error } = await supabase.from('guardians').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
