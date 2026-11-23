import supabase from './db-client.js';
import { clip } from '../lib/server.js';
import { cors, requireAuth, STAFF, TEACHING, toNum, visibleClassIds, HttpError, handleError } from '../lib/server.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;
    const b = req.body || {};

    if (req.method === 'GET') {
      const scope = await visibleClassIds(profile);
      let q = supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(200);
      if (scope) {
        const parts = [...scope.map((c) => `class_id.eq.${c}`), 'class_id.is.null'];
        q = q.or(parts.join(','));
      }
      const { data, error } = await q;
      if (error) throw error;
      const { data: classes } = await supabase.from('classes').select('id,name');
      const cm = Object.fromEntries((classes || []).map((c) => [c.id, c.name]));
      return res.status(200).json((data || []).map((a) => ({ ...a, class_name: a.class_id ? cm[a.class_id] || '' : 'كل المدرسة' })));
    }

    if (!TEACHING.includes(profile.role)) throw new HttpError(403, 'ليست لديك صلاحية للنشر');

    if (req.method === 'POST') {
      const title = clip(b.title, 200, 'العنوان');
      const body = clip(b.body, 5000, 'نص الإعلان');
      if (!title || !body) throw new HttpError(400, 'العنوان ونص الإعلان مطلوبان');
      const classId = toNum(b.class_id);
      const scope = await visibleClassIds(profile);
      if (classId === null) {
        if (!STAFF.includes(profile.role)) throw new HttpError(403, 'إعلانات المدرسة للإدارة فقط');
      } else if (scope && !scope.includes(classId)) {
        throw new HttpError(403, 'ليس هذا الفصل ضمن فصولك');
      }
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title, body, class_id: classId, author_name: profile.full_name,
          teacher_id: profile.role === 'teacher' ? profile.ref_id : null,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const id = toNum(b.id);
      const { data: a } = await supabase.from('announcements').select('*').eq('id', id).maybeSingle();
      if (!a) throw new HttpError(404, 'الإعلان غير موجود');
      const own = profile.role === 'teacher' && a.teacher_id === profile.ref_id;
      if (!STAFF.includes(profile.role) && !own) throw new HttpError(403, 'غير مسموح');
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
