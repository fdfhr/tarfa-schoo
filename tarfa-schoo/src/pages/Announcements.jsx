import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Send, Copy, Trash2, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Input, Select, Textarea, Badge, Spinner, Empty, ErrorBox } from '../components/ui';
import { fmtDateTime, whatsappLink } from '../lib/utils';

export default function Announcements() {
  const { role, profile, toast } = useApp();
  const canPost = role === 'admin' || role === 'assistant' || role === 'teacher';
  const isStaff = role === 'admin' || role === 'assistant';
  const [items, setItems] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', body: '', class_id: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setItems(await api('/api/announcements'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    if (canPost) {
      api('/api/classes').then((cs) => {
        setClasses(cs);
        setForm((f) => ({ ...f, class_id: f.class_id || (cs[0] ? String(cs[0].id) : '') }));
      }).catch(() => {});
    }
  }, [load, canPost]);

  const publish = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = 'أدخل عنوان الإعلان';
    if (!form.body.trim()) errs.body = 'اكتب نص الإعلان';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await api('/api/announcements', {
        method: 'POST',
        body: { title: form.title, body: form.body, class_id: form.class_id === 'all' ? null : Number(form.class_id) },
      });
      toast('تم نشر الإعلان');
      setForm((f) => ({ ...f, title: '', body: '' }));
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm('حذف هذا الإعلان؟')) return;
    try {
      await api('/api/announcements', { method: 'DELETE', body: { id: a.id } });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const textOf = (a) => `📢 ${a.title}\n\n${a.body}\n\n— ${a.author_name || 'إدارة المدرسة'}\nمدرسة طرفا الثانوية المشتركة`;

  const copy = async (a) => {
    try {
      await navigator.clipboard.writeText(textOf(a));
      toast('تم نسخ نص الإعلان');
    } catch {
      toast('تعذر النسخ', 'error');
    }
  };

  return (
    <div>
      <PageHeader title="الإعلانات" subtitle="إعلانات الفصول والمدرسة" />
      {canPost && (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-bold"><Megaphone className="h-4 w-4 text-primary" /> كتابة إعلان جديد</h2>
          <form onSubmit={publish} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="العنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} />
              <Select label="الموجّه إلى" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                {isStaff && <option value="all">كل المدرسة</option>}
                {classes.map((c) => <option key={c.id} value={c.id}>فصل: {c.name}</option>)}
              </Select>
            </div>
            <Textarea label="نص الإعلان" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} error={errors.body} />
            <div className="flex justify-end"><Button type="submit" icon={Send} loading={saving}>نشر الإعلان</Button></div>
          </form>
        </Card>
      )}

      <ErrorBox message={error} onRetry={load} />
      {!items && !error ? <Spinner /> : items?.length === 0 ? <Empty icon={Megaphone} title="لا توجد إعلانات" /> : (
        <div className="space-y-4">
          {items?.map((a) => (
            <Card key={a.id} className="p-5 animate-fade-up">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={a.class_id ? 'brand' : 'warning'}>{a.class_name}</Badge>
                <span className="text-xs text-muted">{fmtDateTime(a.created_at)}</span>
              </div>
              <h3 className="text-lg font-bold">{a.title}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{a.body}</p>
              <p className="mt-3 text-xs text-muted">بواسطة: {a.author_name}</p>
              {canPost && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <Button variant="outline" icon={Copy} onClick={() => copy(a)}>نسخ</Button>
                  <a href={whatsappLink(textOf(a))} target="_blank" rel="noreferrer">
                    <Button variant="success" icon={MessageCircle}>إرسال عبر واتساب</Button>
                  </a>
                  {(isStaff || a.teacher_id === profile?.ref_id) && (
                    <Button variant="ghost" icon={Trash2} className="text-red-600" onClick={() => remove(a)}>حذف</Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
