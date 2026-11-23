import supabase from './db-client.js';
import { cors, requireAuth, TEACHING, isDate, toNum, pct, round2, gradeLabel, getScale, visibleClassIds, HttpError, handleError } from '../lib/server.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;
    const scale = await getScale();
    const scope = await visibleClassIds(profile);

    if (req.method === 'GET') {
      const { exam_id, class_id } = req.query;
      if (exam_id) {
        const { data: ex } = await supabase.from('exams').select('*').eq('id', Number(exam_id)).maybeSingle();
        if (!ex) throw new HttpError(404, 'الاختبار غير موجود');
        if (scope && !scope.includes(ex.class_id)) throw new HttpError(403, 'غير مسموح');
        const [{ data: cls }, { data: students }, { data: sc }] = await Promise.all([
          supabase.from('classes').select('name').eq('id', ex.class_id).maybeSingle(),
          supabase.from('students').select('id,full_name').eq('class_id', ex.class_id).order('full_name'),
          supabase.from('scores').select('student_id,score').eq('exam_id', ex.id),
        ]);
        const map = Object.fromEntries((sc || []).map((r) => [r.student_id, r.score]));
        const rows = (students || []).map((s) => {
          const score = map[s.id] ?? null;
          const p = pct(score, ex.max_score);
          return { student_id: s.id, full_name: s.full_name, score: score === null ? null : Number(score), pct: p, label: gradeLabel(p, scale) };
        });
        return res.status(200).json({ exam: { ...ex, class_name: cls?.name || '' }, rows, scale });
      }

      let q = supabase.from('exams').select('*').order('exam_date', { ascending: false });
      if (scope) {
        if (!scope.length) return res.status(200).json([]);
        q = q.in('class_id', scope);
      }
      if (class_id) q = q.eq('class_id', Number(class_id));
      const { data: exams, error } = await q;
      if (error) throw error;
      const ids = (exams || []).map((e) => e.id);
      const { data: sc } = ids.length
        ? await supabase.from('scores').select('exam_id,score').in('exam_id', ids)
        : { data: [] };
      const { data: classes } = await supabase.from('classes').select('id,name');
      const cm = Object.fromEntries((classes || []).map((c) => [c.id, c.name]));
      return res.status(200).json((exams || []).map((e) => {
        const vals = (sc || []).filter((x) => x.exam_id === e.id && x.score !== null)
          .map((x) => pct(x.score, e.max_score)).filter((v) => v !== null);
        const avg = vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        return {
          ...e,
          class_name: cm[e.class_id] || '',
          graded: vals.length,
          average: avg,
          label: gradeLabel(avg, scale),
          weak: vals.filter((v) => v < scale.acceptable).length,
        };
      }));
    }

    if (!TEACHING.includes(profile.role)) throw new HttpError(403, 'ليست لديك صلاحية لهذا الإجراء');
    const b = req.body || {};

    if (req.method === 'POST') {
      const cls = toNum(b.class_id);
      const title = String(b.title || '').trim();
      if (!cls || !title) throw new HttpError(400, 'الفصل واسم الاختبار مطلوبان');
      if (!isDate(b.exam_date)) throw new HttpError(400, 'تاريخ الاختبار غير صحيح');
      const max = Number(b.max_score);
      if (!(max > 0)) throw new HttpError(400, 'الدرجة النهائية يجب أن تكون أكبر من صفر');
      if (scope && !scope.includes(cls)) throw new HttpError(403, 'ليس هذا الفصل ضمن فصولك');
      const { data, error } = await supabase
        .from('exams')
        .insert({ class_id: cls, title, subject: b.subject || null, exam_date: b.exam_date, max_score: max, term: b.term || '1' })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const id = toNum(b.exam_id);
      const { data: ex } = await supabase.from('exams').select('*').eq('id', id).maybeSingle();
      if (!ex) throw new HttpError(404, 'الاختبار غير موجود');
      if (scope && !scope.includes(ex.class_id)) throw new HttpError(403, 'غير مسموح');

      if (Array.isArray(b.scores)) {
        const { data: students } = await supabase.from('students').select('id').eq('class_id', ex.class_id);
        const valid = new Set((students || []).map((s) => s.id));
        const { data: existing } = await supabase.from('scores').select('id').eq('exam_id', ex.id);
        const firstTime = (existing || []).length === 0;
        const rows = [];
        for (const r of b.scores) {
          const sid = Number(r.student_id);
          if (!valid.has(sid)) continue;
          if (r.score === null || r.score === undefined || r.score === '') continue;
          const v = Number(r.score);
          if (!Number.isFinite(v) || v < 0 || v > Number(ex.max_score)) {
            throw new HttpError(400, `الدرجة يجب أن تكون بين 0 و ${ex.max_score}`);
          }
          rows.push({ exam_id: ex.id, student_id: sid, score: v });
        }
        await supabase.from('scores').delete().eq('exam_id', ex.id);
        if (rows.length) {
          const { error } = await supabase.from('scores').insert(rows);
          if (error) throw error;
        }
        if (firstTime && rows.length) await publishResult(ex, rows, scale);
        return res.status(200).json({ saved: rows.length });
      }

      const patch = {};
      if (b.title !== undefined) patch.title = String(b.title).trim();
      if (b.subject !== undefined) patch.subject = b.subject || null;
      if (b.exam_date !== undefined) {
        if (!isDate(b.exam_date)) throw new HttpError(400, 'تاريخ غير صحيح');
        patch.exam_date = b.exam_date;
      }
      if (b.max_score !== undefined) patch.max_score = Number(b.max_score);
      const { data, error } = await supabase.from('exams').update(patch).eq('id', ex.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const id = toNum(b.id);
      const { data: ex } = await supabase.from('exams').select('*').eq('id', id).maybeSingle();
      if (!ex) throw new HttpError(404, 'الاختبار غير موجود');
      if (scope && !scope.includes(ex.class_id)) throw new HttpError(403, 'غير مسموح');
      await supabase.from('scores').delete().eq('exam_id', id);
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}

// Automatically announces a newly graded exam on the school channel.
async function publishResult(ex, rows, scale) {
  const { data: cls } = await supabase.from('classes').select('name').eq('id', ex.class_id).maybeSingle();
  const { data: students } = await supabase.from('students').select('id,full_name').in('id', rows.map((r) => r.student_id));
  const nm = Object.fromEntries((students || []).map((s) => [s.id, s.full_name]));
  const pcts = rows.map((r) => pct(r.score, ex.max_score));
  const avg = round2(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  const top = rows
    .map((r) => ({ name: nm[r.student_id], p: pct(r.score, ex.max_score) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3)
    .map((t, i) => `${i + 1}) ${t.name} (${t.p}%)`);
  const body = `تم رصد نتائج اختبار «${ex.title}» لـ ${cls?.name || ''}.\nمتوسط الفصل: ${avg}% (${gradeLabel(avg, scale)})\nأوائل الفصل:\n${top.join('\n')}`;
  await supabase.from('channel_posts').insert({ kind: 'result', body, author_name: 'النظام', is_auto: true });
}
