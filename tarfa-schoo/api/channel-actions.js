import supabase from './db-client.js';
import { cors, requireAuth, STAFF, toNum, HttpError, handleError } from '../lib/server.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const profile = await requireAuth(req, res);
    if (!profile) return;
    const { action } = req.body || {};
    const me = profile.email;

    if (action === 'follow') {
      const { data: f } = await supabase.from('channel_follows').select('id').eq('user_email', me).maybeSingle();
      if (!f) await supabase.from('channel_follows').insert({ user_email: me });
      return res.status(200).json({ following: true });
    }
    if (action === 'unfollow') {
      await supabase.from('channel_follows').delete().eq('user_email', me);
      return res.status(200).json({ following: false });
    }

    const postId = toNum(req.body.post_id);
    if (action !== 'reply_delete' && !postId) throw new HttpError(400, 'المنشور غير محدد');

    if (action === 'view') {
      const { data: p } = await supabase.from('channel_posts').select('views').eq('id', postId).maybeSingle();
      if (p) await supabase.from('channel_posts').update({ views: (p.views || 0) + 1 }).eq('id', postId);
      return res.status(200).json({ ok: true });
    }

    if (action === 'like') {
      const { data: l } = await supabase.from('channel_likes').select('id').eq('post_id', postId).eq('user_email', me).maybeSingle();
      if (l) await supabase.from('channel_likes').delete().eq('id', l.id);
      else await supabase.from('channel_likes').insert({ post_id: postId, user_email: me });
      const { count } = await supabase.from('channel_likes').select('id', { count: 'exact', head: true }).eq('post_id', postId);
      return res.status(200).json({ liked: !l, likes: count || 0 });
    }

    if (action === 'reply') {
      const body = String(req.body.body || '').trim();
      if (!body) throw new HttpError(400, 'اكتب الرد أولاً');
      if (body.length > 500) throw new HttpError(400, 'الرد طويل جداً');
      const { data, error } = await supabase
        .from('channel_replies')
        .insert({ post_id: postId, user_email: me, author_name: profile.full_name, body })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (action === 'reply_delete') {
      const id = toNum(req.body.id);
      const { data: r } = await supabase.from('channel_replies').select('*').eq('id', id).maybeSingle();
      if (!r) throw new HttpError(404, 'الرد غير موجود');
      if (r.user_email !== me && !STAFF.includes(profile.role)) throw new HttpError(403, 'غير مسموح');
      await supabase.from('channel_replies').delete().eq('id', id);
      return res.status(200).json({ ok: true });
    }

    if (action === 'vote') {
      const idx = Number(req.body.option_index);
      const { data: p } = await supabase.from('channel_posts').select('*').eq('id', postId).maybeSingle();
      if (!p || p.kind !== 'poll') throw new HttpError(404, 'الاستطلاع غير موجود');
      if (!Array.isArray(p.poll_options) || !(idx >= 0 && idx < p.poll_options.length)) throw new HttpError(400, 'اختيار غير صحيح');
      const { data: v } = await supabase.from('channel_votes').select('id').eq('post_id', postId).eq('user_email', me).maybeSingle();
      if (v) throw new HttpError(400, 'لقد صوّت من قبل');
      const { error } = await supabase.from('channel_votes').insert({ post_id: postId, user_email: me, option_index: idx });
      if (error) throw error;
      return res.status(201).json({ ok: true });
    }

    return res.status(400).json({ error: 'إجراء غير معروف' });
  } catch (err) {
    return handleError(res, err);
  }
}
