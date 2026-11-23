import supabase from './db-client.js';
import { cors, requireAuth, STAFF, visibleClassIds, classStats, handleError, HttpError } from '../lib/server.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;
    const body = req.body || {};

    if (req.method === 'GET') {
      const scope = await visibleClassIds(profile);
      let q = supabase.from('classes').select('*').order('id');
      if (scope) {
        if (!scope.length) return res.status(200).json([]);
        q = q.in('id', scope);
      }
      const { data: classes, error } = await q;
      if (error) throw error;
      const ids = classes.map((c) => c.id);
      const stats = await classStats(ids);
      const [{ data: tc }, { data: teachers }] = await Promise.all([
        ids.length
          ? supabase.from('teacher_classes').select('class_id,teacher_id').in('class_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.from('teachers').select('id,full_name'),
      ]);
      const tMap = Object.fromEntries((teachers || []).map((t) => [t.id, t.full_name]));
      return res.status(200).json(
        classes.map((c) => ({
          ...c,
          students: stats[c.id]?.students || 0,
          average: stats[c.id]?.average ?? null,
          teachers: (tc || [])
            .filter((r) => r.class_id === c.id && tMap[r.teacher_id])
            .map((r) => ({ id: r.teacher_id, full_name: tMap[r.teacher_id] })),
        }))
      );
    }

    if (!STAFF.includes(profile.role)) throw new HttpError(403, 'ليست لديك صلاحية لهذا الإجراء');

    if (req.method === 'POST') {
      const name = String(body.name || '').trim();
      if (!name) throw new HttpError(400, 'اسم الفصل مطلوب');
      const { data, error } = await supabase
        .from('classes')
        .insert({ name, stage: body.stage || null, subject: body.subject || null })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const id = Number(body.id);
      const name = String(body.name || '').trim();
      if (!id) throw new HttpError(400, 'معرّف الفصل مطلوب');
      if (!name) throw new HttpError(400, 'اسم الفصل مطلوب');
      const { data, error } = await supabase
        .from('classes')
        .update({ name, stage: body.stage || null, subject: body.subject || null })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      if (profile.role !== 'admin') throw new HttpError(403, 'حذف الفصول للمدير فقط');
      const id = Number(body.id);
      const { count } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('class_id', id);
      if (count > 0) throw new HttpError(400, 'لا يمكن حذف فصل به طلاب، انقل الطلاب أولاً');
      const { data: exams } = await supabase.from('exams').select('id').eq('class_id', id);
      for (const e of exams || []) await supabase.from('scores').delete().eq('exam_id', e.id);
      await supabase.from('exams').delete().eq('class_id', id);
      await supabase.from('teacher_classes').delete().eq('class_id', id);
      await supabase.from('schedule').delete().eq('class_id', id);
      await supabase.from('announcements').delete().eq('class_id', id);
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
