import supabase from './db-client.js';
import { cors, requireAuth, STAFF, HttpError, handleError } from '../lib/server.js';

// Messaging between students / guardians and school management.
// Each conversation is a thread keyed by the student's or guardian's email.
const USER_ROLES = ['student', 'guardian'];
const MAX_LEN = 1000;

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const profile = await requireAuth(req, res, [...STAFF, ...USER_ROLES]);
    if (!profile) return;
    const isStaff = STAFF.includes(profile.role);

    if (req.method === 'GET') {
      // Student / guardian: their own conversation with management.
      if (!isStaff) {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('thread_email', profile.email)
          .order('created_at', { ascending: true })
          .limit(300);
        if (error) throw error;
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('thread_email', profile.email)
          .eq('sender_role', 'staff')
          .eq('read', false);
        return res.status(200).json({ messages: data || [] });
      }

      // Management: one conversation.
      const thread = String(req.query.thread || '').trim().toLowerCase();
      if (thread) {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('thread_email', thread)
          .order('created_at', { ascending: true })
          .limit(300);
        if (error) throw error;
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('thread_email', thread)
          .eq('sender_role', 'user')
          .eq('read', false);
        return res.status(200).json({ messages: data || [] });
      }

      // Management: list of conversations, newest first.
      const { data, error } = await supabase
        .from('messages')
        .select('thread_email, sender_role, body, created_at, read')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      const map = {};
      for (const r of data || []) {
        const t = (map[r.thread_email] ||= { email: r.thread_email, last_body: r.body, last_at: r.created_at, unread: 0 });
        if (r.sender_role === 'user' && !r.read) t.unread++;
      }
      const emails = Object.keys(map);
      const { data: profs } = emails.length
        ? await supabase.from('profiles').select('email, full_name, role').in('email', emails)
        : { data: [] };
      const pm = Object.fromEntries((profs || []).map((p) => [p.email, p]));
      const threads = Object.values(map)
        .map((t) => ({
          ...t,
          full_name: pm[t.email]?.full_name || t.email,
          role: pm[t.email]?.role || '',
        }))
        .sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
      return res.status(200).json({ threads });
    }

    if (req.method === 'POST') {
      const body = String(req.body?.body || '').trim();
      if (!body) throw new HttpError(400, 'اكتب نص الرسالة');
      if (body.length > MAX_LEN) throw new HttpError(400, 'الرسالة طويلة جداً (1000 حرف كحد أقصى)');

      let thread;
      let senderRole;
      if (isStaff) {
        thread = String(req.body?.thread_email || '').trim().toLowerCase();
        if (!thread) throw new HttpError(400, 'حدد المحادثة');
        const { data: target } = await supabase.from('profiles').select('role').eq('email', thread).maybeSingle();
        if (!target || !USER_ROLES.includes(target.role)) throw new HttpError(400, 'المحادثة غير صالحة');
        senderRole = 'staff';
      } else {
        thread = profile.email;
        senderRole = 'user';
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({ thread_email: thread, sender_role: senderRole, sender_name: profile.full_name, body, read: false })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
}
