import supabase from './db-client.js';
import { clip } from '../lib/server.js';
import { cors, requireAuth, TEACHING, toNum, visibleStudentIds, HttpError, handleError } from '../lib/server.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;
    const scope = await visibleStudentIds(profile);

    if (req.method === 'GET') {
      const { class_id, student_id } = req.query;
      let ids = scope;
      if (class_id) {
        const { data: st } = await supabase.from('students').select('id').eq('class_id', Number(class_id));
        const cids = (st || []).map((s) => s.id);
        ids = scope ? cids.filter((i) => scope.includes(i)) : cids;
      }
      if (student_id) ids = (ids === null ? [Number(student_id)] : ids).filter((i) => i === Number(student_id));
      let q = supabase.from('behavior').select('*').order('created_at', { ascending: false }).limit(400);
      if (ids) {
        if (!ids.length) return res.status(200).json({ records: [], totals: {} });
        q = q.in('student_id', ids);
      }
      const { data: records, error } = await q;
      if (error) throw error;
      const sIds = [...new Set((records || []).map((r) => r.student_id))];
      const { data: studs } = await supabase
        .from('students').select('id,full_name').in('id', sIds.length ? sIds : [-1]);
      const nm = Object.fromEntries((studs || []).map((s) => [s.id, s.full_name]));
      const totals = {};
      (records || []).forEach((r) => (totals[r.student_id] = (totals[r.student_id] || 0) + r.points));
      return res.status(200).json({
        records: (records || []).map((r) => ({ ...r, student_name: nm[r.student_id] || '' })),
        totals,
      });
    }

    if (!TEACHING.includes(profile.role)) throw new HttpError(403, 'ليست لديك صلاحية لهذا الإجراء');
    const b = req.body || {};

    if (req.method === 'POST') {
      const sid = toNum(b.student_id);
      const pts = Math.round(Number(b.points));
      if (!sid) throw new HttpError(400, 'اختر الطالب');
      if (!(pts >= 1 && pts <= 10)) throw new HttpError(400, 'النقاط يجب أن تكون بين 1 و 10');
      if (b.type !== 'positive' && b.type !== 'negative') throw new HttpError(400, 'نوع النقطة غير صحيح');
      if (scope && !scope.includes(sid)) throw new HttpError(403, 'هذا الطالب ليس في فصولك');
      const { data: st } = await supabase.from('students').select('class_id').eq('id', sid).maybeSingle();
      const { data, error } = await supabase
        .from('behavior')
        .insert({
          student_id: sid,
          class_id: st?.class_id || null,
          type: b.type,
          points: b.type === 'negative' ? -pts : pts,
          reason: clip(b.reason, 200, 'السبب') || null,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const id = toNum(b.id);
      const { data: r } = await supabase.from('behavior').select('*').eq('id', id).maybeSingle();
      if (!r) throw new HttpError(404, 'السجل غير موجود');
      if (scope && !scope.includes(r.student_id)) throw new HttpError(403, 'غير مسموح');
      const { error } = await supabase.from('behavior').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
