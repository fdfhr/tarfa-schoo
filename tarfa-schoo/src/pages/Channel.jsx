import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, BadgeCheck, Eye, Heart, MessageCircle, Pin, PinOff, Pencil, Trash2, Send, Paperclip, Plus, X, FileText, Link2, BarChart3, Image as ImageIcon, Video, Type, Radio, Users } from 'lucide-react';
import { api, uploadFile } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, Button, Input, Textarea, Modal, Badge, Spinner, ErrorBox, Logo, Empty } from '../components/ui';
import { fmtDateTime, cx } from '../lib/utils';

const KINDS = [
  { value: 'text', label: 'نص', icon: Type },
  { value: 'image', label: 'صورة', icon: ImageIcon },
  { value: 'video', label: 'فيديو', icon: Video },
  { value: 'pdf', label: 'PDF', icon: FileText },
  { value: 'link', label: 'رابط', icon: Link2 },
  { value: 'poll', label: 'استطلاع', icon: BarChart3 },
];

export default function Channel() {
  const { toast, role } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyFollow, setBusyFollow] = useState(false);
  const latestId = useRef(0);
  const firstLoad = useRef(true);
  const isStaff = role === 'admin' || role === 'assistant';

  const load = useCallback(async (silent = false) => {
    try {
      const d = await api('/api/channel');
      const newest = d.posts.reduce((m, p) => Math.max(m, p.id), 0);
      if (!firstLoad.current && newest > latestId.current && !silent) {
        toast('منشور جديد في القناة');
      }
      if (newest > latestId.current) latestId.current = newest;
      firstLoad.current = false;
      setData(d);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [toast]);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 30000);
    return () => clearInterval(t);
  }, [load]);

  const toggleFollow = async () => {
    setBusyFollow(true);
    try {
      await api('/api/channel-actions', { method: 'POST', body: { action: data.channel.following ? 'unfollow' : 'follow' } });
      toast(data.channel.following ? 'تم إلغاء المتابعة' : 'تمت المتابعة');
      load(true);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyFollow(false);
    }
  };

  const act = async (body, onDone) => {
    try {
      const r = await api('/api/channel-actions', { method: 'POST', body });
      if (onDone) onDone(r);
      load(true);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="mb-5 overflow-hidden p-0">
        <div className="relative h-28 overflow-hidden">
          <img src="/school.webp" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-900/70 to-brand-900/10" />
        </div>
        <div className="-mt-10 flex flex-col items-center px-5 pb-5 text-center">
          <div className="rounded-full border-4 border-surface bg-surface">
            <Logo className="h-20 w-20" />
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <h1 className="text-lg font-bold">{data?.channel.name || 'مدرسة طرفا الثانوية المشتركة'}</h1>
            <BadgeCheck className="h-5 w-5 text-brand-500" />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Users className="h-4 w-4" />{data?.channel.followers ?? 0} متابع</p>
          {data && (
            <Button
              className="mt-4 min-w-[180px]"
              variant={data.channel.following ? 'outline' : 'primary'}
              loading={busyFollow}
              onClick={toggleFollow}
            >
              {data.channel.following ? 'إلغاء المتابعة' : 'متابعة'}
            </Button>
          )}
          {data && !data.channel.following && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-soft px-4 py-2 text-sm font-semibold text-primary">
              <BellRing className="h-4 w-4" /> تابع القناة عشان توصلك الأخبار
            </p>
          )}
        </div>
      </Card>

      {data?.can_post && <Composer onPosted={() => load(true)} />}

      <ErrorBox message={error} onRetry={() => load(true)} />
      {!data && !error ? <Spinner /> : data?.posts.length === 0 ? <Empty icon={Radio} title="لا توجد منشورات بعد" /> : (
        <div className="space-y-4">
          {data?.posts.map((p) => (
            <PostCard key={p.id} post={p} isStaff={isStaff} onAction={act} onChanged={() => load(true)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Composer({ onPosted }) {
  const { toast } = useApp();
  const [kind, setKind] = useState('text');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [media, setMedia] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const accept = { image: 'image/*', video: 'video/*', pdf: 'application/pdf' }[kind];

  const pickFile = async (file) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast('حجم الملف يجب ألا يتجاوز 3 ميجابايت', 'error');
    setUploading(true);
    try {
      setMedia(await uploadFile(file, 'channel'));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setBody('');
    setLink('');
    setOptions(['', '']);
    setMedia(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const publish = async () => {
    setSaving(true);
    try {
      await api('/api/channel', {
        method: 'POST',
        body: { kind, body, media_url: media, link_url: link, poll_options: options },
      });
      toast('تم نشر المنشور');
      reset();
      onPosted();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-5 space-y-4 p-4">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.value}
            onClick={() => { setKind(k.value); setMedia(null); }}
            className={cx('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition', kind === k.value ? 'bg-brand-600 text-white' : 'bg-soft text-muted hover:text-ink')}
          >
            <k.icon className="h-3.5 w-3.5" />{k.label}
          </button>
        ))}
      </div>
      <Textarea rows={3} placeholder={kind === 'poll' ? 'اكتب سؤال الاستطلاع...' : 'اكتب المنشور...'} value={body} onChange={(e) => setBody(e.target.value)} />
      {kind === 'link' && <Input dir="ltr" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} className="text-left" />}
      {['image', 'video', 'pdf'].includes(kind) && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-4 py-2.5 text-sm font-semibold text-primary hover:bg-soft">
            <Paperclip className="h-4 w-4" />
            {uploading ? 'جاري الرفع...' : media ? 'تم الرفع ✓ (اختر بديلاً)' : 'اختر الملف (حتى 3 ميجابايت)'}
            <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
        </div>
      )}
      {kind === 'poll' && (
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`الخيار ${i + 1}`} className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500" />
              {options.length > 2 && <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-muted hover:text-red-600" aria-label="حذف"><X className="h-4 w-4" /></button>}
            </div>
          ))}
          {options.length < 6 && <button onClick={() => setOptions([...options, ''])} className="flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" />إضافة خيار</button>}
        </div>
      )}
      <div className="flex justify-end">
        <Button icon={Send} loading={saving} disabled={uploading} onClick={publish}>نشر</Button>
      </div>
    </Card>
  );
}

function PostCard({ post: p, isStaff, onAction, onChanged }) {
  const { toast, profile } = useApp();
  const [showReplies, setShowReplies] = useState(false);
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(p.body || '');
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    api('/api/channel-actions', { method: 'POST', body: { action: 'view', post_id: p.id } }).catch(() => {});
  }, [p.id]);

  const total = p.total_votes || 0;
  const voted = p.my_vote !== null && p.my_vote !== undefined;

  const sendReply = async () => {
    if (!reply.trim()) return;
    await onAction({ action: 'reply', post_id: p.id, body: reply }, () => setReply(''));
  };

  const saveEdit = async () => {
    try {
      await api('/api/channel', { method: 'PUT', body: { id: p.id, body: editText } });
      setEditing(false);
      onChanged();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const togglePin = async () => {
    try {
      await api('/api/channel', { method: 'PUT', body: { id: p.id, pinned: !p.pinned } });
      onChanged();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const remove = async () => {
    if (!window.confirm('حذف هذا المنشور؟')) return;
    try {
      await api('/api/channel', { method: 'DELETE', body: { id: p.id } });
      onChanged();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Card className={cx('p-4 animate-fade-up sm:p-5', p.pinned && 'border-brand-400 ring-1 ring-brand-200 dark:ring-brand-800')}>
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-ink">{p.author_name || 'الإدارة'}</span>
          {p.pinned && <Badge tone="brand"><Pin className="h-3 w-3" />مثبت</Badge>}
        </div>
        <span className="flex shrink-0 items-center gap-1">{fmtDateTime(p.created_at)} <BadgeCheck className="h-4 w-4 text-brand-500" aria-label="تم النشر" /></span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(false)}>إلغاء</Button><Button onClick={saveEdit}>حفظ</Button></div>
        </div>
      ) : (
        <>
          {p.body && p.kind !== 'link' && <p className="whitespace-pre-line text-sm leading-relaxed">{p.body}</p>}
          {p.kind === 'image' && p.media_url && <img src={p.media_url} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" />}
          {p.kind === 'video' && p.media_url && <video src={p.media_url} controls className="mt-3 max-h-96 w-full rounded-xl bg-black" />}
          {p.kind === 'pdf' && p.media_url && (
            <a href={p.media_url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-soft p-3 text-sm font-semibold text-primary"><FileText className="h-6 w-6" />فتح ملف PDF</a>
          )}
          {p.kind === 'link' && p.link_url && (
            <a href={p.link_url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-soft p-3 text-sm"><Link2 className="h-5 w-5 shrink-0 text-primary" /><span className="truncate text-primary underline" dir="ltr">{p.link_url}</span></a>
          )}
          {p.kind === 'poll' && (
            <div className="mt-3 space-y-2">
              {(p.poll_options || []).map((opt, i) => {
                const c = p.poll_counts?.[i] || 0;
                const pct = total ? Math.round((c / total) * 100) : 0;
                const mine = p.my_vote === i;
                return (
                  <button
                    key={i}
                    disabled={voted}
                    onClick={() => onAction({ action: 'vote', post_id: p.id, option_index: i })}
                    className={cx('relative w-full overflow-hidden rounded-xl border p-3 text-right text-sm transition', mine ? 'border-brand-500' : 'border-line', !voted && 'hover:bg-soft')}
                  >
                    {voted && <span className="absolute inset-y-0 right-0 bg-brand-100 dark:bg-brand-900/70" style={{ width: `${pct}%` }} />}
                    <span className="relative flex items-center justify-between gap-2">
                      <span className="font-medium">{opt}{mine && ' ✓'}</span>
                      {voted && <span className="text-xs font-bold">{pct}%</span>}
                    </span>
                  </button>
                );
              })}
              <p className="text-xs text-muted">{total} صوت</p>
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-sm text-muted">
        <span className="flex items-center gap-1.5"><Eye className="h-4 w-4" />{p.views || 0}</span>
        <button onClick={() => onAction({ action: 'like', post_id: p.id })} className={cx('flex items-center gap-1.5 transition', p.liked ? 'text-red-500' : 'hover:text-ink')}>
          <Heart className={cx('h-4 w-4', p.liked && 'fill-current')} />{p.likes}
        </button>
        <button onClick={() => setShowReplies((s) => !s)} className="flex items-center gap-1.5 hover:text-ink"><MessageCircle className="h-4 w-4" />{p.replies.length}</button>
        {isStaff && (
          <div className="mr-auto flex items-center gap-1">
            <button onClick={togglePin} className="rounded-lg p-1.5 hover:bg-soft hover:text-ink" aria-label={p.pinned ? 'إلغاء التثبيت' : 'تثبيت'}>{p.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</button>
            {p.kind !== 'poll' && <button onClick={() => { setEditText(p.body || ''); setEditing(true); }} className="rounded-lg p-1.5 hover:bg-soft hover:text-ink" aria-label="تعديل"><Pencil className="h-4 w-4" /></button>}
            <button onClick={remove} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {showReplies && (
        <div className="mt-3 space-y-3 rounded-xl bg-soft p-3">
          {p.replies.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2 text-sm">
              <p><span className="font-semibold">{r.author_name}: </span>{r.body}</p>
              {(isStaff || r.user_email === profile?.email) && (
                <button onClick={() => onAction({ action: 'reply_delete', id: r.id })} className="text-xs text-red-600">حذف</button>
              )}
            </div>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); sendReply(); }} className="flex items-center gap-2">
            <input value={reply} onChange={(e) => setReply(e.target.value)} maxLength={500} placeholder="اكتب رداً..." className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500" />
            <Button type="submit" variant="secondary" className="px-3" aria-label="إرسال"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      )}
    </Card>
  );
}
