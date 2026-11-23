import supabase from './db-client.js';
import { cors, requireAuth, STAFF, toNum, pct, round2, addDays, todayStr, visibleClassIds, TERM_START, HttpError, handleError } from '../lib/server.js';

async function computeHonor(classId, period) {
  const today = todayStr();
  const start = period === 'term' ? TERM_START : addDays(today, -30);
  const { data: cls } = await supabase.from('classes').select('id,name').eq('id', classId).maybeSingle();
  const { data: students } = await supabase.from('students').select('id,full_name,photo_url').eq('class_id', classId);
  const sIds = (students || []).map((s) => s.id);
  const { data: exams } = await supabase.from('exams').select('id,max_score')
    .eq('class_id', classId).gte('exam_date', start).lte('exam_date', today);
  const eIds = (exams || []).map((e) => e.id);
  const [{ data: sc }, { data: beh }] = await Promise.all([
    eIds.length && sIds.length
      ? supabase.from('scores').select('student_id,score,exam_id').in('exam_id', eIds).in('student_id', sIds)
      : Promise.resolve({ data: [] }),
    sIds.length
      ? supabase.from('behavior').select('student_id,points,created_at').in('student_id', sIds).gte('created_at', start)
      : Promise.resolve({ data: [] }),
  ]);
  const maxMap = Object.fromEntries((exams || []).map((e) => [e.id, e.max_score]));
  const rows = (students || []).map((s) => {
    const ps = (sc || []).filter((r) => r.student_id === s.id).map((r) => pct(r.score, maxMap[r.exam_id])).filter((v) => v !== null);
    const b = (beh || []).filter((r) => r.student_id === s.id).reduce((a, r) => a + r.points, 0);
    return {
      student_id: s.id,
      full_name: s.full_name,
      photo_url: s.photo_url,
      average: ps.length ? round2(ps.reduce((a, c) => a + c, 0) / ps.length) : null,
      graded: ps.length,
      behavior: b,
    };
  });
  rows.sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || b.behavior - a.behavior);
  return {
    class: cls || null,
    period,
    start,
    exams_count: eIds.length,
    items: rows.slice(0, 5).map((r, i) => ({ ...r, rank: i + 1 })),
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;
    const scope = await visibleClassIds(profile);

    if (req.method === 'GET') {
      const classId = toNum(req.query.class_id);
      const period = req.query.period === 'term' ? 'term' : 'month';
      if (!classId) throw new HttpError(400, 'اختر الفصل');
      if (scope && !scope.includes(classId)) throw new HttpError(403, 'غير مسموح');
      return res.status(200).json(await computeHonor(classId, period));
    }

    if (req.method === 'POST') {
      if (!STAFF.includes(profile.role)) throw new HttpError(403, 'النشر في القناة للإدارة فقط');
      const classId = toNum(req.body?.class_id);
      const period = req.body?.period === 'term' ? 'term' : 'month';
      if (!classId) throw new HttpError(400, 'اختر الفصل');
      const h = await computeHonor(classId, period);
      if (!h.items.length) throw new HttpError(400, 'لا توجد بيانات كافية للنشر');
      const medals = ['🥇', '🥈', '🥉', '4)', '5)'];
      const lines = h.items.map((it, i) => `${medals[i]} ${it.full_name} - المتوسط ${it.average ?? '-'}% ونقاط السلوك ${it.behavior}`);
      const body = `لوحة الشرف - ${h.class?.name || ''} (${period === 'term' ? 'الترم' : 'آخر 30 يوم'})\n` + lines.join('\n');
      const { data, error } = await supabase
        .from('channel_posts')
        .insert({ kind: 'honor', body, author_name: 'لوحة الشرف', is_auto: true })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
