import supabase from './db-client.js';
import { cors, requireAuth, STAFF, DAYS, toNum, visibleClassIds, HttpError, handleError } from '../lib/server.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;
    const b = req.body || {};

    if (req.method === 'GET') {
      const { class_id } = req.query;
      let q = supabase.from('schedule').select('*').order('period');
      if (class_id) {
        const cid = Number(class_id);
        const scope = await visibleClassIds(profile);
        if (scope && !scope.includes(cid)) throw new HttpError(403, 'هذا الفصل ليس ضمن صلاحياتك');
        q = q.eq('class_id', cid);
      } else if (profile.role === 'teacher') {
        q = q.eq('teacher_id', profile.ref_id);
      } else if (!STAFF.includes(profile.role)) {
        const scope = await visibleClassIds(profile);
        if (!scope.length) return res.status(200).json([]);
        q = q.in('class_id', scope);
      }
      const { data, error } = await q;
      if (error) throw error;
      const [{ data: classes }, { data: teachers }] = await Promise.all([
        supabase.from('classes').select('id,name'),
        supabase.from('teachers').select('id,full_name'),
      ]);
      const cm = Object.fromEntries((classes || []).map((c) => [c.id, c.name]));
      const tm = Object.fromEntries((teachers || []).map((t) => [t.id, t.full_name]));
      return res.status(200).json((data || []).map((r) => ({
        ...r,
        class_name: cm[r.class_id] || '',
        teacher_name: tm[r.teacher_id] || '',
      })));
    }

    if (!STAFF.includes(profile.role)) throw new HttpError(403, 'تعديل الجدول للإدارة فقط');

    const row = () => {
      const day = String(b.day || '');
      const period = Number(b.period);
      const class_id = toNum(b.class_id);
      if (!DAYS.includes(day)) throw new HttpError(400, 'اليوم غير صحيح');
      if (!(period >= 1 && period <= 10)) throw new HttpError(400, 'رقم الحصة غير صحيح');
      if (!class_id) throw new HttpError(400, 'اختر الفصل');
      return {
        class_id,
        teacher_id: toNum(b.teacher_id),
        day,
        period,
        subject: String(b.subject || '').trim() || null,
        room: String(b.room || '').trim() || null,
      };
    };

    if (req.method === 'POST') {
      const { data, error } = await supabase.from('schedule').insert(row()).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const id = toNum(b.id);
      if (!id) throw new HttpError(400, 'معرّف الحصة مطلوب');
      const { data, error } = await supabase.from('schedule').update(row()).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const id = toNum(b.id);
      const { error } = await supabase.from('schedule').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
