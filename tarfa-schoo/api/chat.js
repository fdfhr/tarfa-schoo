import supabase from './db-client.js';
import { SCHOOL_LOCATION, STAFF as FIXED_STAFF } from '../lib/fixed.js';
import { cors, requireAuth, STAFF, getSettings, getScale, pct, round2, gradeLabel, cairoWeekdayAr, todayStr, guardianStudentIds, loadStats, DAYS, HttpError, handleError } from '../lib/server.js';

const DEFAULT_OFF = 'الشات متوقف مؤقتاً بقرار من إدارة المدرسة';
const ESCALATE_MSG = 'تم تحويل رسالتك إلى إدارة المدرسة لمتابعتها بشكل مباشر.';
const UNKNOWN_MSG = 'لم أجد إجابة واضحة لسؤالك. تم تحويله إلى إدارة المدرسة وسيتم الرد عليك قريباً.';

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[\u0625\u0623\u0622]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064a');
const has = (t, words) => words.some((w) => t.includes(norm(w)));

const SENSITIVE = ['شكوى', 'ظلم', 'تهديد', 'تحرش', 'عنف', 'ضرب', 'اساءه', 'مضايقه', 'تنمر', 'اعتداء', 'تظلم', 'استثناء', 'اعاده الامتحان', 'غش'];

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;

    if (req.method === 'GET') {
      if (req.query.escalated) {
        if (!STAFF.includes(profile.role)) throw new HttpError(403, 'غير مسموح');
        const { data } = await supabase.from('chat_messages').select('*').eq('escalated', true)
          .order('created_at', { ascending: false }).limit(100);
        return res.status(200).json(data || []);
      }
      const { data } = await supabase.from('chat_messages').select('*')
        .eq('user_email', profile.email).order('created_at', { ascending: false }).limit(30);
      return res.status(200).json((data || []).reverse());
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (STAFF.includes(profile.role) || profile.role === 'teacher') throw new HttpError(403, 'الشات للطلاب وأولياء الأمور فقط');

    const message = String(req.body?.message || '').trim().slice(0, 500);
    if (!message) throw new HttpError(400, 'اكتب رسالتك');

    // Resolve the children this account can ask about.
    let students = [];
    if (profile.role === 'student') {
      const { data } = await supabase.from('students').select('*').eq('id', profile.ref_id).maybeSingle();
      if (data) students = [data];
    } else {
      const ids = await guardianStudentIds(profile.ref_id);
      if (ids.length) {
        const { data } = await supabase.from('students').select('*').in('id', ids).order('full_name');
        students = data || [];
      }
    }

    const settings = await getSettings();
    const cfg = settings.ai_config || { enabled: true, message: DEFAULT_OFF, disabled_classes: [] };
    const offMsg = cfg.message || DEFAULT_OFF;
    const disabledClasses = cfg.disabled_classes || [];
    const blocked = !cfg.enabled || (students.length && students.every((s) => disabledClasses.includes(s.class_id)));
    if (blocked) return res.status(200).json({ reply: offMsg, disabled: true });

    const t = norm(message);
    let reply;
    let escalated = false;
    if (has(t, SENSITIVE)) {
      reply = ESCALATE_MSG;
      escalated = true;
    } else {
      const parts = await answer(t, profile, students);
      if (parts.length) reply = parts.join('\n\n');
      else {
        reply = UNKNOWN_MSG;
        escalated = true;
      }
    }
    await supabase.from('chat_messages').insert({ user_email: profile.email, message, reply, escalated });
    return res.status(200).json({ reply, escalated });
  } catch (err) {
    return handleError(res, err);
  }
}

async function answer(t, profile, students) {
  const out = [];
  const multi = students.length > 1;
  const prefix = (s) => (multi ? `بالنسبة لـ ${s.full_name}:\n` : '');
  const today = todayStr();
  const scale = await getScale();

  if (has(t, ['مواعيد الاختبار', 'موعد الاختبار', 'امتحان القادم', 'اختبار القادم', 'امتى الاختبار', 'متى الاختبار'])) {
    const cids = [...new Set(students.map((s) => s.class_id))];
    const { data: ex } = cids.length
      ? await supabase.from('exams').select('*').in('class_id', cids).gte('exam_date', today).order('exam_date').limit(10)
      : { data: [] };
    out.push(ex?.length
      ? 'مواعيد الاختبارات القادمة:\n' + ex.map((e) => `- ${e.title} (${e.exam_date}) الدرجة ${e.max_score}`).join('\n')
      : 'لا توجد اختبارات مسجلة قادمة حالياً.');
    return out;
  }

  if (has(t, ['درج', 'نتيج', 'تقدير', 'مجموع', 'اختبار', 'امتحان'])) {
    for (const s of students) {
      const { data: sc } = await supabase.from('scores').select('score,exam_id').eq('student_id', s.id);
      const eIds = (sc || []).map((x) => x.exam_id);
      const { data: ex } = eIds.length ? await supabase.from('exams').select('*').in('id', eIds) : { data: [] };
      const em = Object.fromEntries((ex || []).map((e) => [e.id, e]));
      if (!sc?.length) {
        out.push(prefix(s) + 'لم تُرصد أي درجات بعد.');
        continue;
      }
      const lines = sc.map((r) => {
        const e = em[r.exam_id] || {};
        const p = pct(r.score, e.max_score);
        return `- ${e.title} (${e.subject || ''}): ${Number(r.score)} من ${e.max_score} = ${p}% (${gradeLabel(p, scale)})`;
      });
      out.push(prefix(s) + 'درجاته:\n' + lines.join('\n'));
    }
    return out;
  }

  if (has(t, ['غياب', 'غايب', 'حضور', 'حضر', 'متاخر'])) {
    for (const s of students) {
      const st = (await loadStats([s.id]))[s.id];
      const total = st.present + st.absent + st.late;
      const rate = total ? Math.round(((st.present + st.late) / total) * 100) : null;
      out.push(prefix(s) + `حضر: ${st.present} يوم، غاب: ${st.absent} يوم، متأخر: ${st.late} يوم` +
        (rate !== null ? `\nنسبة الحضور: ${rate}%` : '') +
        (st.absent > 3 ? '\nتنبيه: تجاوز عدد أيام الغياب 3 أيام.' : ''));
    }
    return out;
  }

  if (has(t, ['جدول', 'حصه', 'حصة', 'حصص', 'اليوم', 'ماده اليوم'])) {
    const today_ar = cairoWeekdayAr();
    const cids = [...new Set(students.map((s) => s.class_id))];
    const { data: rows } = cids.length ? await supabase.from('schedule').select('*').in('class_id', cids).order('period') : { data: [] };
    const { data: classes } = cids.length ? await supabase.from('classes').select('id,name').in('id', cids) : { data: [] };
    const cm = Object.fromEntries((classes || []).map((c) => [c.id, c.name]));
    const wantAll = has(t, ['الاسبوع', 'كل']);
    const dayRows = (rows || []).filter((r) => wantAll || r.day === today_ar);
    if (!dayRows.length) {
      out.push(wantAll ? 'لا يوجد جدول مسجل حالياً.' : `لا توجد حصص مسجلة ليوم ${today_ar}.`);
      return out;
    }
    const lines = dayRows.map((r) => `- ${wantAll ? r.day + ' - ' : ''}الحصة ${r.period}: ${r.subject || ''}` + (r.room ? ` (${r.room})` : '') + (multi ? ` - ${cm[r.class_id] || ''}` : ''));
    out.push(`جدول ${wantAll ? 'الأسبوع' : 'اليوم (' + today_ar + ')'}:\n` + lines.join('\n'));
    return out;
  }

  if (has(t, ['ترتيب', 'مركز', 'الشرف', 'الاول'])) {
    for (const s of students) {
      const { data: mates } = await supabase.from('students').select('id').eq('class_id', s.class_id);
      const stats = await loadStats((mates || []).map((m) => m.id));
      const ranked = Object.entries(stats)
        .map(([id, v]) => ({ id: Number(id), avg: v.avg, beh: v.behavior }))
        .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.beh - a.beh);
      const pos = ranked.findIndex((r) => r.id === s.id) + 1;
      out.push(prefix(s) + `ترتيبه في الفصل: ${pos} من ${ranked.length}` +
        (stats[s.id]?.avg != null ? ` (متوسط ${round2(stats[s.id].avg)}%)` : ''));
    }
    return out;
  }

  if (has(t, ['سلوك', 'نقاط', 'نقطه', 'ملاحظ'])) {
    for (const s of students) {
      const st = (await loadStats([s.id]))[s.id];
      out.push(prefix(s) + `صافي نقاط السلوك: ${st.behavior}`);
    }
    return out;
  }

  if (has(t, ['القناه', 'قناه', 'اخبار', 'اعلان', 'منشور'])) {
    const { data: posts } = await supabase.from('channel_posts').select('body,kind,created_at').order('created_at', { ascending: false }).limit(3);
    out.push(posts?.length
      ? 'آخر منشورات القناة:\n' + posts.map((p) => '- ' + String(p.body || '').split('\n')[0].slice(0, 120)).join('\n')
      : 'لا توجد منشورات بعد.');
    return out;
  }

  if (has(t, ['مدرسه', 'المدير', 'الوكيل', 'العنوان', 'مكان', 'التواصل', 'الهاتف', 'الموقع'])) {
    out.push(`مدرسة طرفا الثانوية المشتركة.\nالموقع: ${SCHOOL_LOCATION}\nمدير المدرسة: ${FIXED_STAFF[0].name}`);
    return out;
  }

  return out;
}
