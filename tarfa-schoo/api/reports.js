import supabase from './db-client.js';
import { clip } from '../lib/server.js';
import { cors, requireAuth, STAFF, toNum, visibleClassIds, pct, round2, gradeLabel, getScale, HttpError, handleError } from '../lib/server.js';

async function buildContent(kind, classId, scale) {
  const { data: students } = await supabase
    .from('students').select('id,full_name').eq('class_id', classId).order('full_name');
  const sIds = (students || []).map((s) => s.id);

  if (kind === 'attendance') {
    const { data: att } = await supabase.from('attendance').select('student_id,status').eq('class_id', classId);
    const rows = (students || []).map((s) => {
      const r = (att || []).filter((a) => a.student_id === s.id);
      const p = r.filter((x) => x.status === 'present').length;
      const ab = r.filter((x) => x.status === 'absent').length;
      const l = r.filter((x) => x.status === 'late').length;
      const rate = r.length ? Math.round(((p + l) / r.length) * 100) + '%' : '-';
      return [s.full_name, p, ab, l, rate];
    });
    return { headers: ['الطالب', 'حاضر', 'غائب', 'متأخر', 'نسبة الحضور'], rows };
  }

  if (kind === 'grades') {
    const { data: exams } = await supabase.from('exams').select('*').eq('class_id', classId).order('exam_date');
    const eIds = (exams || []).map((e) => e.id);
    const { data: sc } = eIds.length
      ? await supabase.from('scores').select('exam_id,student_id,score').in('exam_id', eIds)
      : { data: [] };
    const rows = (students || []).map((s) => {
      const cells = [];
      const vals = [];
      (exams || []).forEach((e) => {
        const r = (sc || []).find((x) => x.exam_id === e.id && x.student_id === s.id);
        const p = r ? pct(r.score, e.max_score) : null;
        if (p !== null) vals.push(p);
        cells.push(r ? `${Number(r.score)}/${e.max_score}` : '-');
      });
      const avg = vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      return [s.full_name, ...cells, avg === null ? '-' : avg + '%', gradeLabel(avg, scale) || '-'];
    });
    const headers = ['الطالب', ...(exams || []).map((e) => `${e.title} (${e.max_score})`), 'المتوسط %', 'التقدير'];
    return { headers, rows };
  }

  const { data: beh } = sIds.length
    ? await supabase.from('behavior').select('student_id,points').in('student_id', sIds)
    : { data: [] };
  const rows = (students || []).map((s) => {
    const pos = (beh || []).filter((b) => b.student_id === s.id && b.points > 0).reduce((a, b) => a + b.points, 0);
    const neg = (beh || []).filter((b) => b.student_id === s.id && b.points < 0).reduce((a, b) => a + Math.abs(b.points), 0);
    return [s.full_name, pos, neg, pos - neg];
  });
  return { headers: ['الطالب', 'نقاط إيجابية', 'نقاط سلبية', 'الصافي'], rows };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;
    const b = req.body || {};

    if (req.method === 'GET') {
      let q = supabase.from('reports').select('*').order('created_at', { ascending: false });
      if (!STAFF.includes(profile.role)) {
        if (profile.role !== 'teacher') throw new HttpError(403, 'غير مسموح');
        q = q.eq('teacher_id', profile.ref_id);
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
        ...r, class_name: cm[r.class_id] || '', teacher_name: tm[r.teacher_id] || '',
      })));
    }

    if (req.method === 'POST') {
      if (profile.role !== 'teacher') throw new HttpError(403, 'إنشاء التقارير للمدرسين فقط');
      const classId = toNum(b.class_id);
      const kind = b.kind;
      const title = String(b.title || '').trim();
      if (!classId || !['attendance', 'grades', 'behavior'].includes(kind) || !title) {
        throw new HttpError(400, 'الفصل ونوع التقرير والعنوان مطلوبة');
      }
      const scope = await visibleClassIds(profile);
      if (!scope.includes(classId)) throw new HttpError(403, 'ليس هذا الفصل ضمن فصولك');
      const scale = await getScale();
      const content = await buildContent(kind, classId, scale);
      const { data, error } = await supabase
        .from('reports')
        .insert({ teacher_id: profile.ref_id, class_id: classId, kind, title, content, note: clip(b.note, 1000, 'الملاحظة') || null, status: 'new' })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      if (!STAFF.includes(profile.role)) throw new HttpError(403, 'الرد على التقارير للإدارة فقط');
      const id = toNum(b.id);
      const reply = String(b.reply || '').trim();
      if (!id || !reply) throw new HttpError(400, 'اكتب نص الرد');
      const { data, error } = await supabase
        .from('reports')
        .update({ reply, status: 'replied', replied_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const id = toNum(b.id);
      const { data: r } = await supabase.from('reports').select('*').eq('id', id).maybeSingle();
      if (!r || r.teacher_id !== profile.ref_id) throw new HttpError(403, 'غير مسموح');
      await supabase.from('reports').delete().eq('id', id);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
