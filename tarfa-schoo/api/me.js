import supabase from './db-client.js';
import { decryptField } from '../lib/crypto.js';
import { cors, requireAuth, guardianStudentIds, handleError } from '../lib/server.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;
    let entity = null;
    if (profile.role === 'teacher') {
      const { data: t } = await supabase.from('teachers').select('*').eq('id', profile.ref_id).maybeSingle();
      const { data: tc } = await supabase.from('teacher_classes').select('class_id').eq('teacher_id', profile.ref_id);
      const ids = (tc || []).map((r) => r.class_id);
      const { data: classes } = ids.length
        ? await supabase.from('classes').select('*').in('id', ids).order('id')
        : { data: [] };
      entity = { ...(t || {}), classes: classes || [] };
    } else if (profile.role === 'student') {
      const { data: s } = await supabase.from('students').select('*').eq('id', profile.ref_id).maybeSingle();
      const { data: c } = s
        ? await supabase.from('classes').select('*').eq('id', s.class_id).maybeSingle()
        : { data: null };
      // Students never receive their national ID or teacher notes through this endpoint.
      entity = { ...(s || {}), national_id: undefined, teacher_notes: undefined, class: c || null };
    } else if (profile.role === 'guardian') {
      const { data: g } = await supabase.from('guardians').select('*').eq('id', profile.ref_id).maybeSingle();
      const ids = await guardianStudentIds(profile.ref_id);
      const { data: kids } = ids.length
        ? await supabase.from('students').select('id,full_name,class_id,photo_url').in('id', ids).order('full_name')
        : { data: [] };
      const cids = [...new Set((kids || []).map((k) => k.class_id))];
      const { data: classes } = cids.length
        ? await supabase.from('classes').select('id,name').in('id', cids)
        : { data: [] };
      const cm = Object.fromEntries((classes || []).map((c) => [c.id, c.name]));
      entity = { ...(g || {}), children: (kids || []).map((k) => ({ ...k, class_name: cm[k.class_id] || '' })) };
    }
    return res.status(200).json({ profile, entity });
  } catch (err) {
    return handleError(res, err);
  }
}
