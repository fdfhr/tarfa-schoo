import supabase from './db-client.js';
import { cors, requireAuth, STAFF, todayStr, addDays, visibleClassIds, classStats, round2, pct, handleError } from '../lib/server.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res, STAFF.concat(['teacher']));
    if (!profile) return;
    const scope = await visibleClassIds(profile);
    const today = todayStr();

    let cq = supabase.from('classes').select('*').order('id');
    if (scope) {
      if (!scope.length) return res.status(200).json(emptyDash());
      cq = cq.in('id', scope);
    }
    const { data: classes } = await cq;
    const cids = (classes || []).map((c) => c.id);
    const stats = await classStats(cids);
    const { data: students } = cids.length
      ? await supabase.from('students').select('id,class_id').in('class_id', cids)
      : { data: [] };
    const sIds = (students || []).map((s) => s.id);

    // Attendance over the last 28 days.
    const from = addDays(today, -27);
    const { data: att } = sIds.length
      ? await supabase.from('attendance').select('date,status,class_id').in('class_id', cids).gte('date', from).lte('date', today)
      : { data: [] };

    const rate = (rows) => {
      if (!rows.length) return null;
      const ok = rows.filter((r) => r.status === 'present' || r.status === 'late').length;
      return Math.round((ok / rows.length) * 100);
    };
    const todayRows = (att || []).filter((r) => r.date === today);
    const trend = [3, 2, 1, 0].map((w) => {
      const end = addDays(today, -7 * w);
      const start = addDays(end, -6);
      const rows = (att || []).filter((r) => r.date >= start && r.date <= end);
      return { label: w === 0 ? 'الأسبوع الحالي' : `قبل ${w} ${w === 1 ? 'أسبوع' : 'أسابيع'}`, rate: rate(rows) };
    });

    const { data: exams } = cids.length
      ? await supabase.from('exams').select('*').in('class_id', cids).gte('exam_date', today).order('exam_date').limit(5)
      : { data: [] };
    const cm = Object.fromEntries((classes || []).map((c) => [c.id, c.name]));

    const { data: warn } = sIds.length
      ? await supabase.from('attendance').select('student_id').eq('status', 'absent').in('student_id', sIds)
      : { data: [] };
    const counts = {};
    (warn || []).forEach((r) => (counts[r.student_id] = (counts[r.student_id] || 0) + 1));

    let unassigned = [];
    if (STAFF.includes(profile.role)) {
      const { data: tc } = await supabase.from('teacher_classes').select('class_id');
      const assigned = new Set((tc || []).map((r) => r.class_id));
      unassigned = (classes || []).filter((c) => !assigned.has(c.id)).map((c) => ({ id: c.id, name: c.name }));
    }

    const { data: tcAll } = cids.length
      ? await supabase.from('teacher_classes').select('class_id,teacher_id').in('class_id', cids)
      : { data: [] };
    const { data: teachers } = await supabase.from('teachers').select('id,full_name');
    const tm = Object.fromEntries((teachers || []).map((t) => [t.id, t.full_name]));

    return res.status(200).json({
      today: { date: today, rate: rate(todayRows), recorded: todayRows.length },
      totals: {
        classes: cids.length,
        students: sIds.length,
        warnings: Object.values(counts).filter((n) => n > 3).length,
      },
      classes: (classes || []).map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        students: stats[c.id]?.students || 0,
        average: stats[c.id]?.average ?? null,
        teachers: (tcAll || []).filter((r) => r.class_id === c.id && tm[r.teacher_id]).map((r) => tm[r.teacher_id]),
      })),
      trend,
      upcoming: (exams || []).map((e) => ({ id: e.id, title: e.title, subject: e.subject, exam_date: e.exam_date, max_score: e.max_score, class_name: cm[e.class_id] || '' })),
      unassigned,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

function emptyDash() {
  return {
    today: { date: todayStr(), rate: null, recorded: 0 },
    totals: { classes: 0, students: 0, warnings: 0 },
    classes: [],
    trend: [],
    upcoming: [],
    unassigned: [],
  };
}
