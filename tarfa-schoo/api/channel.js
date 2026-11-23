import supabase from './db-client.js';
import { clip } from '../lib/server.js';
import { cors, requireAuth, STAFF, toNum, HttpError, handleError } from '../lib/server.js';

const KINDS = ['text', 'image', 'video', 'pdf', 'link', 'poll'];
export const CHANNEL_NAME = 'مدرسة طرفا الثانوية المشتركة';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res);
    if (!profile) return;
    const b = req.body || {};

    if (req.method === 'GET') {
      const { data: posts, error } = await supabase
        .from('channel_posts').select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const ids = (posts || []).map((p) => p.id);
      const [likes, votes, replies, follow, followers] = await Promise.all([
        ids.length ? supabase.from('channel_likes').select('post_id,user_email').in('post_id', ids) : { data: [] },
        ids.length ? supabase.from('channel_votes').select('post_id,option_index,user_email').in('post_id', ids) : { data: [] },
        ids.length ? supabase.from('channel_replies').select('*').in('post_id', ids).order('created_at') : { data: [] },
        supabase.from('channel_follows').select('id').eq('user_email', profile.email).maybeSingle(),
        supabase.from('channel_follows').select('id', { count: 'exact', head: true }),
      ]);
      const me = profile.email;
      const out = (posts || []).map((p) => {
        const pl = (likes.data || []).filter((l) => l.post_id === p.id);
        const pv = (votes.data || []).filter((v) => v.post_id === p.id);
        const opts = Array.isArray(p.poll_options) ? p.poll_options : [];
        return {
          ...p,
          likes: pl.length,
          liked: pl.some((l) => l.user_email === me),
          poll_counts: opts.map((_, i) => pv.filter((v) => v.option_index === i).length),
          my_vote: pv.find((v) => v.user_email === me)?.option_index ?? null,
          total_votes: pv.length,
          replies: (replies.data || []).filter((r) => r.post_id === p.id),
        };
      });
      return res.status(200).json({
        channel: { name: CHANNEL_NAME, followers: followers.count || 0, following: !!follow.data },
        can_post: STAFF.includes(profile.role),
        posts: out,
      });
    }

    if (!STAFF.includes(profile.role)) throw new HttpError(403, 'النشر في القناة للمدير ومساعده فقط');

    if (req.method === 'POST') {
      const kind = b.kind;
      if (!KINDS.includes(kind)) throw new HttpError(400, 'نوع المنشور غير صحيح');
      const body = clip(b.body, 5000, 'نص المنشور');
      const row = { kind, body: body || null, author_name: profile.full_name, pinned: false };
      if (kind === 'text' && !body) throw new HttpError(400, 'اكتب نص المنشور');
      if (['image', 'video', 'pdf'].includes(kind)) {
        if (!b.media_url) throw new HttpError(400, 'ارفع الملف أولاً');
        // Only files uploaded to this project's storage may be embedded.
        const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/`;
        if (!base.startsWith('https://') || !String(b.media_url).startsWith(base)) {
          throw new HttpError(400, 'رابط الملف غير صالح، ارفع الملف من جديد');
        }
        row.media_url = b.media_url;
      }
      if (kind === 'link') {
        if (!/^https?:\/\//.test(b.link_url || '')) throw new HttpError(400, 'أدخل رابطاً صحيحاً يبدأ ب https');
        row.link_url = b.link_url;
        if (!body) row.body = b.link_url;
      }
      if (kind === 'poll') {
        const opts = (Array.isArray(b.poll_options) ? b.poll_options : []).map((o) => String(o).trim()).filter(Boolean);
        if (!body) throw new HttpError(400, 'اكتب سؤال الاستطلاع');
        if (opts.length < 2) throw new HttpError(400, 'أضف خيارين على الأقل');
        row.poll_options = opts;
      }
      const { data, error } = await supabase.from('channel_posts').insert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const id = toNum(b.id);
      if (!id) throw new HttpError(400, 'معرّف المنشور مطلوب');
      const patch = {};
      if (b.body !== undefined) patch.body = String(b.body).trim() || null;
      if (b.pinned !== undefined) {
        patch.pinned = !!b.pinned;
        if (patch.pinned) {
          await supabase.from('channel_posts').update({ pinned: false }).eq('pinned', true);
        }
      }
      const { data, error } = await supabase.from('channel_posts').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const id = toNum(b.id);
      await supabase.from('channel_votes').delete().eq('post_id', id);
      await supabase.from('channel_likes').delete().eq('post_id', id);
      await supabase.from('channel_replies').delete().eq('post_id', id);
      const { error } = await supabase.from('channel_posts').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
