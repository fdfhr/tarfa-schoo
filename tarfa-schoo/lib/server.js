import supabase from '../api/db-client.js';

export const STAFF = ['admin', 'assistant'];
export const TEACHING = ['admin', 'assistant', 'teacher'];
export const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
export const DEFAULT_SCALE = { excellent: 90, very_good: 80, good: 70, acceptable: 60 };
export const TERM_START = '2026-09-01';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Trims a text field and rejects it when it exceeds the allowed length.
export function clip(value, max, label = 'النص') {
  const s = String(value ?? '').trim();
  if (s.length > max) throw new HttpError(400, `${label} طويل جداً (الحد ${max} حرف)`);
  return s;
}

export function handleError(res, err) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error('API error:', err);
  return res.status(500).json({ error: 'حدث خطأ في الخادم، حاول مرة أخرى' });
}

export function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

export function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
}

export function toNum(v) {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n;
}

export function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

export function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function pct(score, max) {
  if (score === null || score === undefined || score === '') return null;
  const s = Number(score);
  const m = Number(max);
  if (!Number.isFinite(s) || !m) return null;
  return round2((s / m) * 100);
}

export function gradeLabel(p, scale = DEFAULT_SCALE) {
  if (p === null || p === undefined || Number.isNaN(p)) return null;
  if (p >= scale.excellent) return 'ممتاز';
  if (p >= scale.very_good) return 'جيد جداً';
  if (p >= scale.good) return 'جيد';
  if (p >= scale.acceptable) return 'مقبول';
  return 'ضعيف';
}

export function cairoWeekdayAr() {
  const names = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return names[new Date(todayStr() + 'T12:00:00Z').getUTCDay()];
}

export async function requireAuth(req, res, roles) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) {
    res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    return null;
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول مرة أخرى' });
    return null;
  }
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', normEmail(user.email))
    .maybeSingle();
  if (pErr) {
    res.status(500).json({ error: pErr.message });
    return null;
  }
  if (!profile) {
    res.status(403).json({ error: 'هذا الحساب غير مسجل في النظام' });
    return null;
  }
  if (roles && !roles.includes(profile.role)) {
    res.status(403).json({ error: 'ليست لديك صلاحية لتنفيذ هذا الإجراء' });
    return null;
  }
  return profile;
}

export async function getSettings() {
  const { data } = await supabase.from('settings').select('*');
  const map = {};
  (data || []).forEach((r) => (map[r.key] = r.value));
  return map;
}

export async function getScale() {
  const s = await getSettings();
  return { ...DEFAULT_SCALE, ...(s.grading_scale || {}) };
}

export async function guardianStudentIds(guardianId) {
  const { data } = await supabase.from('guardian_students').select('student_id').eq('guardian_id', guardianId);
  return (data || []).map((r) => r.student_id);
}

export async function teacherClassIds(teacherId) {
  const { data } = await supabase.from('teacher_classes').select('class_id').eq('teacher_id', teacherId);
  return (data || []).map((r) => r.class_id);
}

// null = all classes (staff)
export async function visibleClassIds(profile) {
  if (STAFF.includes(profile.role)) return null;
  if (profile.role === 'teacher') return teacherClassIds(profile.ref_id);
  if (profile.role === 'student') {
    const { data } = await supabase.from('students').select('class_id').eq('id', profile.ref_id).maybeSingle();
    return data ? [data.class_id] : [];
  }
  if (profile.role === 'guardian') {
    const ids = await guardianStudentIds(profile.ref_id);
    if (!ids.length) return [];
    const { data } = await supabase.from('students').select('class_id').in('id', ids);
    return [...new Set((data || []).map((r) => r.class_id))];
  }
  return [];
}

// null = all students (staff)
export async function visibleStudentIds(profile) {
  if (STAFF.includes(profile.role)) return null;
  if (profile.role === 'teacher') {
    const cls = await teacherClassIds(profile.ref_id);
    if (!cls.length) return [];
    const { data } = await supabase.from('students').select('id').in('class_id', cls);
    return (data || []).map((r) => r.id);
  }
  if (profile.role === 'student') return [profile.ref_id];
  if (profile.role === 'guardian') return guardianStudentIds(profile.ref_id);
  return [];
}

export async function emailTaken(email, exceptProfileId) {
  const { data } = await supabase.from('profiles').select('id').eq('email', normEmail(email)).maybeSingle();
  return !!data && data.id !== exceptProfileId;
}

export async function createLogin(email, password) {
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    const m = (error.message || '').toLowerCase();
    if (m.includes('already')) throw new HttpError(409, 'البريد الإلكتروني مسجل بالفعل');
    if (m.includes('password')) throw new HttpError(400, 'كلمة السر يجب ألا تقل عن 8 أحرف');
    if (m.includes('email')) throw new HttpError(400, 'البريد الإلكتروني غير صالح');
    throw new HttpError(400, 'تعذر إنشاء حساب الدخول: ' + error.message);
  }
  return data.user;
}

export async function findAuthUserByEmail(email) {
  const target = normEmail(email);
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => normEmail(u.email) === target);
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function deleteAccountByEmail(email) {
  if (!email) return;
  const u = await findAuthUserByEmail(email);
  if (u) await supabase.auth.admin.deleteUser(u.id);
  await supabase.from('profiles').delete().eq('email', normEmail(email));
}

// Creates or updates a login account and its profile row.
export async function syncAccount({ currentEmail, newEmail, password, role, fullName, phone, refId }) {
  const cur = normEmail(currentEmail);
  const next = normEmail(newEmail);
  if (!isValidEmail(next)) throw new HttpError(400, 'البريد الإلكتروني غير صالح');
  if (password && password.length < 8) throw new HttpError(400, 'كلمة السر يجب ألا تقل عن 8 أحرف');

  if (!cur) {
    if (!password) throw new HttpError(400, 'أدخل كلمة السر لإنشاء حساب الدخول');
    if (await emailTaken(next)) throw new HttpError(409, 'البريد الإلكتروني مستخدم بالفعل');
    // A login left behind without a profile (e.g. after clearing data) is reclaimed with the new password.
    const orphan = await findAuthUserByEmail(next);
    let user = orphan;
    if (orphan) {
      const { error: upErr } = await supabase.auth.admin.updateUserById(orphan.id, {
        password, email_confirm: true,
      });
      if (upErr) throw new HttpError(400, 'تعذر تحديث حساب الدخول: ' + upErr.message);
    } else {
      user = await createLogin(next, password);
    }
    const { error } = await supabase
      .from('profiles')
      .insert({ email: next, role, full_name: fullName, phone, ref_id: refId });
    if (error) {
      if (!orphan) await supabase.auth.admin.deleteUser(user.id);
      throw error;
    }
    return next;
  }

  if (next !== cur && (await emailTaken(next))) throw new HttpError(409, 'البريد الإلكتروني مستخدم بالفعل');
  const { data: prof } = await supabase.from('profiles').select('*').eq('email', cur).maybeSingle();
  if (next !== cur || password) {
    const au = await findAuthUserByEmail(cur);
    if (!au) throw new HttpError(404, 'حساب الدخول لهذا المستخدم غير موجود');
    const attrs = {};
    if (next !== cur) {
      attrs.email = next;
      attrs.email_confirm = true;
    }
    if (password) attrs.password = password;
    const { error } = await supabase.auth.admin.updateUserById(au.id, attrs);
    if (error) throw new HttpError(400, 'تعذر تحديث الحساب: ' + error.message);
  }
  if (prof) {
    await supabase.from('profiles').update({ email: next, full_name: fullName, phone }).eq('id', prof.id);
  }
  return next;
}

// Per-class student count and average percentage across all graded exams.
export async function classStats(classIds) {
  const out = {};
  classIds.forEach((id) => (out[id] = { students: 0, average: null }));
  if (!classIds.length) return out;
  const [st, ex] = await Promise.all([
    supabase.from('students').select('id,class_id').in('class_id', classIds),
    supabase.from('exams').select('id,class_id,max_score').in('class_id', classIds),
  ]);
  (st.data || []).forEach((s) => {
    if (out[s.class_id]) out[s.class_id].students++;
  });
  const exams = ex.data || [];
  const examMap = Object.fromEntries(exams.map((e) => [e.id, e]));
  const examIds = exams.map((e) => e.id);
  let scores = [];
  if (examIds.length) {
    const r = await supabase.from('scores').select('exam_id,score').in('exam_id', examIds);
    scores = r.data || [];
  }
  const acc = {};
  scores.forEach((r) => {
    const e = examMap[r.exam_id];
    const p = e ? pct(r.score, e.max_score) : null;
    if (p == null) return;
    (acc[e.class_id] ||= []).push(p);
  });
  Object.entries(acc).forEach(([cid, arr]) => {
    if (out[cid]) out[cid].average = round2(arr.reduce((a, b) => a + b, 0) / arr.length);
  });
  return out;
}

// Per-student totals: attendance counts, behavior sum, grade average.
export async function loadStats(studentIds) {
  const out = {};
  studentIds.forEach((id) => (out[id] = { present: 0, absent: 0, late: 0, behavior: 0, avg: null, tests: 0 }));
  if (!studentIds.length) return out;
  const [att, beh, sc] = await Promise.all([
    supabase.from('attendance').select('student_id,status').in('student_id', studentIds),
    supabase.from('behavior').select('student_id,points').in('student_id', studentIds),
    supabase.from('scores').select('student_id,score,exam_id').in('student_id', studentIds),
  ]);
  (att.data || []).forEach((r) => {
    const o = out[r.student_id];
    if (o && o[r.status] !== undefined) o[r.status]++;
  });
  (beh.data || []).forEach((r) => {
    if (out[r.student_id]) out[r.student_id].behavior += Number(r.points) || 0;
  });
  const rows = sc.data || [];
  const examIds = [...new Set(rows.map((r) => r.exam_id))];
  const { data: exams } = examIds.length
    ? await supabase.from('exams').select('id,max_score').in('id', examIds)
    : { data: [] };
  const maxMap = Object.fromEntries((exams || []).map((e) => [e.id, e.max_score]));
  const acc = {};
  rows.forEach((r) => {
    const p = pct(r.score, maxMap[r.exam_id]);
    if (p == null || !out[r.student_id]) return;
    (acc[r.student_id] ||= []).push(p);
  });
  Object.entries(acc).forEach(([id, arr]) => {
    out[id].avg = round2(arr.reduce((a, b) => a + b, 0) / arr.length);
    out[id].tests = arr.length;
  });
  return out;
}
