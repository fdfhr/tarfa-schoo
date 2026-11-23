import supabase from './db-client.js';
import { cors, requireAuth, TEACHING, isDate, toNum, visibleClassIds, visibleStudentIds, HttpError, handleError } from '../lib/server.js';

const STATUSES = ['present', 'absent', 'late'];

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;

    if (req.method === 'GET') {
      const { class_id, date, warnings, student_id } = req.query;

      if (warnings) {
        const scope = await visibleStudentIds(profile);
        let q = supabase.from('attendance').select('student_id,date').eq('status', 'absent');
        if (scope) {
          if (!scope.length) return res.status(200).json([]);
          q = q.in('student_id', scope);
        }
        const { data } = await q;
        const counts = {};
        (data || []).forEach((r) => {
          const c = (counts[r.student_id] ||= { count: 0, last: null });
          c.count++;
          if (!c.last || r.date > c.last) c.last = r.date;
        });
        const flagged = Object.entries(counts).filter(([, v]) => v.count > 3).map(([id, v]) => ({ student_id: Number(id), ...v }));
        if (!flagged.length) return res.status(200).json([]);
        const { data: studs } = await supabase
          .from('students').select('id,full_name,class_id').in('id', flagged.map((f) => f.student_id));
        const { data: classes } = await supabase.from('classes').select('id,name');
        const cm = Object.fromEntries((classes || []).map((c) => [c.id, c.name]));
        const sm = Object.fromEntries((studs || []).map((s) => [s.id, s]));
        return res.status(200).json(
          flagged
            .map((f) => ({
              ...f,
              full_name: sm[f.student_id]?.full_name || '',
              class_name: cm[sm[f.student_id]?.class_id] || '',
            }))
            .sort((a, b) => b.count - a.count)
        );
      }

      if (student_id) {
        const scope = await visibleStudentIds(profile);
        const sid = Number(student_id);
        if (scope && !scope.includes(sid)) throw new HttpError(403, 'غير مسموح');
        const { data } = await supabase.from('attendance').select('*').eq('student_id', sid).order('date', { ascending: false });
        return res.status(200).json(data || []);
      }

      if (class_id && date) {
        const cls = Number(class_id);
        const scope = await visibleClassIds(profile);
        if (scope && !scope.includes(cls)) throw new HttpError(403, 'ليس هذا الفصل ضمن فصولك');
        const { data: students } = await supabase
          .from('students').select('id,full_name,photo_url').eq('class_id', cls).order('full_name');
        const { data: recs } = await supabase
          .from('attendance').select('student_id,status').eq('class_id', cls).eq('date', date);
        const map = Object.fromEntries((recs || []).map((r) => [r.student_id, r.status]));
        return res.status(200).json({
          date,
          students: (students || []).map((s) => ({ ...s, status: map[s.id] || null })),
        });
      }
      return res.status(400).json({ error: 'حدد الفصل والتاريخ' });
    }

    if (req.method === 'POST') {
      if (!TEACHING.includes(profile.role)) throw new HttpError(403, 'ليست لديك صلاحية لتسجيل الغياب');
      const { class_id, date, records } = req.body || {};
      const cls = toNum(class_id);
      if (!cls || !isDate(date) || !Array.isArray(records)) throw new HttpError(400, 'بيانات الحضور غير مكتملة');
      const scope = await visibleClassIds(profile);
      if (scope && !scope.includes(cls)) throw new HttpError(403, 'ليس هذا الفصل ضمن فصولك');
      const { data: students } = await supabase.from('students').select('id').eq('class_id', cls);
      const valid = new Set((students || []).map((s) => s.id));
      const rows = records
        .filter((r) => valid.has(Number(r.student_id)) && STATUSES.includes(r.status))
        .map((r) => ({ student_id: Number(r.student_id), class_id: cls, date, status: r.status }));
      await supabase.from('attendance').delete().eq('class_id', cls).eq('date', date);
      if (rows.length) {
        const { error } = await supabase.from('attendance').insert(rows);
        if (error) throw error;
      }
      return res.status(200).json({ saved: rows.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
