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
      const [{ data: teachers }, { data: tc }, { data: classes }] = await Promise.all([
        supabase.from('teachers').select('*').order('full_name'),
        supabase.from('teacher_classes').select('teacher_id,class_id'),
        supabase.from('classes').select('id,name,stage,subject').order('id'),
      ]);
      const cMap = Object.fromEntries((classes || []).map((c) => [c.id, c]));
      return res.status(200).json({
        classes: classes || [],
        teachers: (teachers || []).map((t) => {
          const ids = (tc || []).filter((r) => r.teacher_id === t.id).map((r) => r.class_id);
          return { ...t, class_ids: ids, classes: ids.map((i) => cMap[i]).filter(Boolean) };
        }),
      });
    }

    const fullName = String(b.full_name || '').trim();
    const subject = String(b.subject || '').trim();
    const phone = String(b.phone || '').trim();
    const classIds = (Array.isArray(b.class_ids) ? b.class_ids : []).map(Number).filter(Boolean);

    if (req.method === 'POST') {
      const email = normEmail(b.email);
      if (!fullName) throw new HttpError(400, 'الاسم الكامل مطلوب');
      if (!subject) throw new HttpError(400, 'المادة مطلوبة');
      if (await emailTaken(email)) throw new HttpError(409, 'البريد الإلكتروني مستخدم بالفعل');
      const { data: t, error } = await supabase
        .from('teachers')
        .insert({ full_name: fullName, subject, phone, email })
        .select()
        .single();
      if (error) throw error;
      try {
        await syncAccount({ currentEmail: '', newEmail: email, password: String(b.password || ''), role: 'teacher', fullName, phone, refId: t.id });
      } catch (e) {
        await supabase.from('teachers').delete().eq('id', t.id);
        throw e;
      }
      if (classIds.length) {
        await supabase.from('teacher_classes').insert(classIds.map((c) => ({ teacher_id: t.id, class_id: c })));
      }
      return res.status(201).json(t);
    }

    if (req.method === 'PUT') {
      const id = toNum(b.id);
      if (!id) throw new HttpError(400, 'معرّف المدرس مطلوب');
      const { data: t } = await supabase.from('teachers').select('*').eq('id', id).maybeSingle();
      if (!t) throw new HttpError(404, 'المدرس غير موجود');
      if (!fullName || !subject) throw new HttpError(400, 'الاسم والمادة مطلوبان');
      if (b.password && profile.role !== 'admin') throw new HttpError(403, 'تغيير كلمة سر المدرس للمدير فقط');
      const email = normEmail(b.email || t.email);
      await syncAccount({
        currentEmail: t.email, newEmail: email, password: String(b.password || ''),
        role: 'teacher', fullName, phone, refId: id,
      });
      const { data, error } = await supabase
        .from('teachers')
        .update({ full_name: fullName, subject, phone, email })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (Array.isArray(b.class_ids)) {
        await supabase.from('teacher_classes').delete().eq('teacher_id', id);
        if (classIds.length) {
          await supabase.from('teacher_classes').insert(classIds.map((c) => ({ teacher_id: id, class_id: c })));
        }
      }
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      if (profile.role !== 'admin') throw new HttpError(403, 'حذف المدرس للمدير فقط');
      const id = toNum(b.id);
      const { data: t } = await supabase.from('teachers').select('*').eq('id', id).maybeSingle();
      if (!t) throw new HttpError(404, 'المدرس غير موجود');
      // Classes stay in the school; they become unassigned and appear in the admin's list to reassign.
      await supabase.from('teacher_classes').delete().eq('teacher_id', id);
      await supabase.from('schedule').update({ teacher_id: null }).eq('teacher_id', id);
      await supabase.from('announcements').delete().eq('teacher_id', id);
      await supabase.from('reports').delete().eq('teacher_id', id);
      if (t.email) await deleteAccountByEmail(t.email);
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
