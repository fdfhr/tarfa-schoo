import supabase from './db-client.js';
import { clip } from '../lib/server.js';
import { encryptField, decryptField } from '../lib/crypto.js';
import {
  cors, requireAuth, STAFF, normEmail, isValidEmail, toNum, isDate, pct, round2, gradeLabel,
  getScale, visibleClassIds, visibleStudentIds, loadStats, syncAccount, deleteAccountByEmail,
  emailTaken, HttpError, handleError,
} from '../lib/server.js';

const NID = /^\d{14}$/;

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;
    if (req.method === 'GET') return listOrDetail(req, res, profile);
    if (req.method === 'POST') return create(req, res, profile);
    if (req.method === 'PUT') return update(req, res, profile);
    if (req.method === 'DELETE') return remove(req, res, profile);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}

async function listOrDetail(req, res, profile) {
  const { id, class_id, detail } = req.query;
  const scope = await visibleStudentIds(profile);
  let q = supabase.from('students').select('*').order('full_name');
  if (scope) {
    if (!scope.length) return res.status(200).json([]);
    q = q.in('id', scope);
  }
  if (id) q = q.eq('id', Number(id));
  if (class_id) q = q.eq('class_id', Number(class_id));
  const { data: students, error } = await q;
  if (error) throw error;
  if (!students.length) return res.status(200).json([]);

  const ids = students.map((s) => s.id);
  const classIds = [...new Set(students.map((s) => s.class_id).filter(Boolean))];
  const [{ data: classes }, { data: links }, stats] = await Promise.all([
    supabase.from('classes').select('id,name,subject,stage').in('id', classIds.length ? classIds : [-1]),
    supabase.from('guardian_students').select('student_id,guardian_id').in('student_id', ids),
    loadStats(ids),
  ]);
  const gIds = [...new Set((links || []).map((l) => l.guardian_id))];
  const { data: guardians } = await supabase
    .from('guardians')
    .select('id,full_name,relation,phone')
    .in('id', gIds.length ? gIds : [-1]);
  const cMap = Object.fromEntries((classes || []).map((c) => [c.id, c]));
  const gMap = Object.fromEntries((guardians || []).map((g) => [g.id, g]));
  // National IDs and teacher notes are internal: only staff and teachers see them.
  const internal = ['admin', 'assistant', 'teacher'].includes(profile.role);
  const enrich = (s) => ({
    ...s,
    national_id: internal ? decryptField(s.national_id) : undefined,
    teacher_notes: internal ? s.teacher_notes : undefined,
    class_name: cMap[s.class_id]?.name || '',
    subject: cMap[s.class_id]?.subject || '',
    guardians: (links || []).filter((l) => l.student_id === s.id).map((l) => gMap[l.guardian_id]).filter(Boolean),
    stats: stats[s.id],
  });

  if (!(id && detail)) return res.status(200).json(students.map(enrich));

  const s = students[0];
  const scale = await getScale();
  const [sc, att, beh, mates] = await Promise.all([
    supabase.from('scores').select('*').eq('student_id', s.id),
    supabase.from('attendance').select('*').eq('student_id', s.id).order('date', { ascending: false }),
    supabase.from('behavior').select('*').eq('student_id', s.id).order('created_at', { ascending: false }),
    supabase.from('students').select('id').eq('class_id', s.class_id),
  ]);
  const examIds = [...new Set((sc.data || []).map((r) => r.exam_id))];
  const { data: exams } = examIds.length
    ? await supabase.from('exams').select('*').in('id', examIds)
    : { data: [] };
  const exMap = Object.fromEntries((exams || []).map((e) => [e.id, e]));
  const scores = (sc.data || []).map((r) => {
    const e = exMap[r.exam_id] || {};
    const p = pct(r.score, e.max_score);
    return {
      exam_id: r.exam_id, score: Number(r.score), title: e.title, subject: e.subject,
      exam_date: e.exam_date, max_score: e.max_score, pct: p, label: gradeLabel(p, scale),
    };
  });
  const mateIds = (mates.data || []).map((m) => m.id);
  const mateStats = await loadStats(mateIds);
  const ranked = mateIds
    .map((id) => ({ id, avg: mateStats[id]?.avg, beh: mateStats[id]?.behavior || 0 }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.beh - a.beh);
  const rank = ranked.findIndex((r) => r.id === s.id) + 1;
  return res.status(200).json({
    ...enrich(s),
    class: cMap[s.class_id] || null,
    scores,
    attendance: att.data || [],
    behavior: beh.data || [],
    rank,
    class_size: mateIds.length,
  });
}

function validateCore(b, requireAll) {
  const out = {};
  if (requireAll || b.full_name !== undefined) {
    out.full_name = String(b.full_name || '').trim();
    if (!out.full_name) throw new HttpError(400, 'الاسم الكامل مطلوب');
  }
  if (requireAll || b.national_id !== undefined) {
    out.national_id = String(b.national_id || '').trim();
    if (!NID.test(out.national_id)) throw new HttpError(400, 'الرقم القومي يجب أن يكون 14 رقماً');
  }
  if (requireAll || b.phone !== undefined) {
    out.phone = String(b.phone || '').trim() || null;
  }
  if (b.birth_date !== undefined) {
    if (b.birth_date && !isDate(b.birth_date)) throw new HttpError(400, 'تاريخ الميلاد غير صحيح');
    out.birth_date = b.birth_date || null;
  }
  if (requireAll || b.class_id !== undefined) {
    out.class_id = toNum(b.class_id);
    if (!out.class_id) throw new HttpError(400, 'اختر الفصل');
  }
  if (b.photo_url !== undefined) out.photo_url = b.photo_url || null;
  if (b.teacher_notes !== undefined) out.teacher_notes = b.teacher_notes || null;
  return out;
}

async function create(req, res, profile) {
  if (!STAFF.includes(profile.role)) throw new HttpError(403, 'ليست لديك صلاحية لإضافة طالب');
  const b = req.body || {};
  const core = validateCore(b, true);
  const email = normEmail(b.email);
  const password = String(b.password || '');
  if (!isValidEmail(email)) throw new HttpError(400, 'البريد الإلكتروني غير صالح');
  if (password.length < 8) throw new HttpError(400, 'كلمة السر يجب ألا تقل عن 8 أحرف');
  const nidEnc = encryptField(core.national_id);
  const { data: dupNid } = await supabase.from('students').select('id').eq('national_id', nidEnc).maybeSingle();
  if (dupNid) throw new HttpError(409, 'الرقم القومي مسجل لطالب آخر');
  if (await emailTaken(email)) throw new HttpError(409, 'البريد الإلكتروني مستخدم بالفعل');
  const { data: cls } = await supabase.from('classes').select('id').eq('id', core.class_id).maybeSingle();
  if (!cls) throw new HttpError(400, 'الفصل غير موجود');

  const { data: st, error } = await supabase
    .from('students')
    .insert({ ...core, national_id: nidEnc, email, birth_date: b.birth_date || null, photo_url: b.photo_url || null })
    .select()
    .single();
  if (error) throw error;
  try {
    await syncAccount({ currentEmail: '', newEmail: email, password, role: 'student', fullName: core.full_name, phone: core.phone, refId: st.id });
  } catch (e) {
    await supabase.from('students').delete().eq('id', st.id);
    throw e;
  }
  const gids = (Array.isArray(b.guardian_ids) ? b.guardian_ids : []).map(Number).filter(Boolean);
  if (gids.length) {
    await supabase.from('guardian_students').insert(gids.map((g) => ({ guardian_id: g, student_id: st.id })));
  }
  return res.status(201).json(st);
}

async function update(req, res, profile) {
  const b = req.body || {};
  const id = toNum(b.id);
  if (!id) throw new HttpError(400, 'معرّف الطالب مطلوب');
  const { data: s } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
  if (!s) throw new HttpError(404, 'الطالب غير موجود');

  if (profile.role === 'teacher') {
    const cls = await visibleClassIds(profile);
    if (!cls.includes(s.class_id)) throw new HttpError(403, 'هذا الطالب ليس في فصولك');
    const { data, error } = await supabase
      .from('students')
      .update({ teacher_notes: b.teacher_notes === undefined ? s.teacher_notes : clip(b.teacher_notes, 2000, 'الملاحظات') || null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  if (!STAFF.includes(profile.role)) throw new HttpError(403, 'ليست لديك صلاحية للتعديل');

  const core = validateCore(b, false);
  const nidEnc = core.national_id ? encryptField(core.national_id) : null;
  if (nidEnc && nidEnc !== s.national_id) {
    const { data: d } = await supabase.from('students').select('id').eq('national_id', nidEnc).neq('id', id).maybeSingle();
    if (d) throw new HttpError(409, 'الرقم القومي مسجل لطالب آخر');
  }
  if (core.class_id) {
    const { data: cls } = await supabase.from('classes').select('id').eq('id', core.class_id).maybeSingle();
    if (!cls) throw new HttpError(400, 'الفصل غير موجود');
  }

  const patch = { ...core };
  if (nidEnc) patch.national_id = nidEnc;
  if (b.email !== undefined || b.password) {
    const email = normEmail(b.email !== undefined ? b.email : s.email);
    const fullName = core.full_name ?? s.full_name;
    const phone = core.phone !== undefined ? core.phone : s.phone;
    await syncAccount({
      currentEmail: s.email, newEmail: email, password: b.password ? String(b.password) : '',
      role: 'student', fullName, phone, refId: s.id,
    });
    patch.email = email;
  }

  if (Array.isArray(b.guardian_ids)) {
    await supabase.from('guardian_students').delete().eq('student_id', id);
    const gids = b.guardian_ids.map(Number).filter(Boolean);
    if (gids.length) await supabase.from('guardian_students').insert(gids.map((g) => ({ guardian_id: g, student_id: id })));
  }

  if (Object.keys(patch).length) {
    const { data, error } = await supabase.from('students').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  }
  return res.status(200).json(s);
}

async function remove(req, res, profile) {
  if (profile.role !== 'admin') throw new HttpError(403, 'حذف الطلاب للمدير فقط');
  const id = toNum(req.body?.id);
  if (!id) throw new HttpError(400, 'معرّف الطالب مطلوب');
  const { data: s } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
  if (!s) throw new HttpError(404, 'الطالب غير موجود');
  await supabase.from('attendance').delete().eq('student_id', id);
  await supabase.from('scores').delete().eq('student_id', id);
  await supabase.from('behavior').delete().eq('student_id', id);
  await supabase.from('guardian_students').delete().eq('student_id', id);
  if (s.email) await deleteAccountByEmail(s.email);
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}
