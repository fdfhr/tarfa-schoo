import supabase from './db-client.js';
import { cors, requireAuth, handleError, clip, pct, gradeLabel, getScale, loadStats, todayStr } from '../lib/server.js';
import { decryptField } from '../lib/crypto.js';

// Words people type around a name; they are ignored when searching.
const STOP_WORDS = [
  'ابحث', 'بحث', 'عن', 'الطالب', 'الطالبه', 'طالب', 'بيانات', 'درجات', 'درجاته', 'درجه', 'غياب', 'حضور',
  'سلوك', 'نقاط', 'معلومات', 'اعرض', 'اعطني', 'هات', 'اظهر', 'ورني', 'تقرير', 'كل', 'جميع', 'في', 'على',
  'الخاص', 'اسم', 'ملف', 'ملفه', 'لي', 'من',
];

// Normalizes Arabic for matching: removes diacritics, unifies alef/ya/ta-marbuta forms.
export function normAr(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0640/g, '')
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_N = new Set(STOP_WORDS.map(normAr));

async function buildProfile(s, scale) {
  const [{ data: cls }, { data: links }, { data: sc }, { data: att }, { data: beh }, { data: tc }] = await Promise.all([
    supabase.from('classes').select('id,name,subject').eq('id', s.class_id).maybeSingle(),
    supabase.from('guardian_students').select('guardian_id').eq('student_id', s.id),
    supabase.from('scores').select('exam_id,score').eq('student_id', s.id),
    supabase.from('attendance').select('date,status').eq('student_id', s.id).order('date', { ascending: false }),
    supabase.from('behavior').select('points,reason,created_at').eq('student_id', s.id).order('created_at', { ascending: false }),
    supabase.from('teacher_classes').select('teacher_id').eq('class_id', s.class_id),
  ]);

  const gIds = (links || []).map((l) => l.guardian_id);
  const { data: guardians } = gIds.length
    ? await supabase.from('guardians').select('full_name,relation,phone,email').in('id', gIds)
    : { data: [] };

  const eIds = [...new Set((sc || []).map((r) => r.exam_id))];
  const { data: exams } = eIds.length
    ? await supabase.from('exams').select('id,title,subject,exam_date,max_score').in('id', eIds)
    : { data: [] };
  const em = Object.fromEntries((exams || []).map((e) => [e.id, e]));
  const scores = (sc || [])
    .map((r) => {
      const e = em[r.exam_id] || {};
      const p = pct(r.score, e.max_score);
      return {
        title: e.title, subject: e.subject, exam_date: e.exam_date,
        score: Number(r.score), max_score: e.max_score, pct: p, label: gradeLabel(p, scale),
      };
    })
    .sort((a, b) => String(b.exam_date).localeCompare(String(a.exam_date)));

  const tIds = (tc || []).map((r) => r.teacher_id);
  const { data: teachers } = tIds.length
    ? await supabase.from('teachers').select('full_name,subject').in('id', tIds)
    : { data: [] };

  // Rank inside the class by average, then behavior points.
  const { data: mates } = await supabase.from('students').select('id').eq('class_id', s.class_id);
  const mateIds = (mates || []).map((m) => m.id);
  const mateStats = await loadStats(mateIds);
  const ranked = mateIds
    .map((id) => ({ id, avg: mateStats[id]?.avg, beh: mateStats[id]?.behavior || 0 }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.beh - a.beh);
  const rank = ranked.findIndex((r) => r.id === s.id) + 1;

  const { data: upcoming } = await supabase
    .from('exams')
    .select('title,subject,exam_date,max_score')
    .eq('class_id', s.class_id)
    .gte('exam_date', todayStr())
    .order('exam_date')
    .limit(5);

  return {
    id: s.id,
    full_name: s.full_name,
    national_id: decryptField(s.national_id),
    phone: s.phone,
    birth_date: s.birth_date,
    email: s.email,
    photo_url: s.photo_url,
    teacher_notes: s.teacher_notes,
    class_name: cls?.name || '',
    subject: cls?.subject || '',
    teachers: teachers || [],
    guardians: guardians || [],
    stats: (await loadStats([s.id]))[s.id],
    rank,
    class_size: mateIds.length,
    scores,
    attendance: att || [],
    behavior: beh || [],
    upcoming: upcoming || [],
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const profile = await requireAuth(req, res, ['admin']);
    if (!profile) return;

    const { data: all, error } = await supabase
      .from('students')
      .select('id,full_name,class_id,phone,birth_date,email,photo_url,teacher_notes,national_id');
    if (error) throw error;

    // Second step: the admin picked one student from the candidate list.
    const sid = Number(req.body?.student_id);
    if (sid) {
      const s = (all || []).find((x) => x.id === sid);
      if (!s) return res.status(200).json({ type: 'none', message: 'هذا الطالب غير موجود.' });
      return res.status(200).json({ type: 'profile', message: `بيانات ${s.full_name}:`, profile: await buildProfile(s, await getScale()) });
    }

    const query = clip(req.body?.query, 100, 'نص البحث');
    const tokens = normAr(query).split(' ').filter((t) => t.length >= 2 && !STOP_N.has(t));
    if (!tokens.length) {
      return res.status(200).json({
        type: 'help',
        message: 'اكتب اسم الطالب (الاسم الأول والثاني على الأقل) مثل: "بيانات الطالب أحمد محمد".',
      });
    }

    const q = tokens.join(' ');
    const exact = (all || []).find((s) => normAr(s.full_name) === q);
    const hits = (all || []).filter((s) => {
      const n = normAr(s.full_name);
      return tokens.every((t) => n.includes(t));
    });
    const chosen = exact || (hits.length === 1 ? hits[0] : null);

    if (chosen) {
      return res.status(200).json({
        type: 'profile',
        message: `بيانات ${chosen.full_name}:`,
        profile: await buildProfile(chosen, await getScale()),
      });
    }
    if (!hits.length) {
      return res.status(200).json({ type: 'none', message: 'لم أجد طالباً بهذا الاسم. جرّب كتابة الاسم الأول والثاني.' });
    }

    const { data: classes } = await supabase.from('classes').select('id,name');
    const cm = Object.fromEntries((classes || []).map((c) => [c.id, c.name]));
    return res.status(200).json({
      type: 'candidates',
      message: `وجدت ${hits.length} طلاب مطابقين، اختر الطالب المقصود:`,
      items: hits.slice(0, 10).map((s) => ({ id: s.id, full_name: s.full_name, class_name: cm[s.class_id] || '' })),
    });
  } catch (err) {
    return handleError(res, err);
  }
}
