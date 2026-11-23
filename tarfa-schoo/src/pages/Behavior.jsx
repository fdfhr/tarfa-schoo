import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Input, Select, Textarea, Badge, Spinner, Empty, ErrorBox, Avatar } from '../components/ui';
import { fmtDateTime, cx } from '../lib/utils';

const REASONS = {
  positive: ['مشاركة فعّالة', 'تعاون مع الزملاء', 'تميّز في الواجب', 'مبادرة طيبة'],
  negative: ['إزعاج داخل الفصل', 'عدم إحضار الأدوات', 'عدم أداء الواجب', 'تأخر متكرر'],
};

export default function Behavior() {
  const { toast, role } = useApp();
  const canEdit = role !== 'student' && role !== 'guardian';
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ student_id: '', type: 'positive', points: 2, reason: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/classes').then((cs) => {
      setClasses(cs);
      if (cs[0]) setClassId(String(cs[0].id));
    }).catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    if (!classId) return;
    setError('');
    try {
      const [b, s] = await Promise.all([
        api('/api/behavior', { query: { class_id: classId } }),
        api('/api/students', { query: { class_id: classId } }),
      ]);
      setData(b);
      setStudents(s);
      setForm((f) => ({ ...f, student_id: s[0] ? String(s[0].id) : '' }));
    } catch (e) {
      setError(e.message);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.student_id) return toast('اختر الطالب', 'error');
    if (!form.reason.trim()) return toast('اكتب سبب النقاط', 'error');
    setSaving(true);
    try {
      await api('/api/behavior', { method: 'POST', body: { ...form, student_id: Number(form.student_id), points: Number(form.points) } });
      toast(form.type === 'positive' ? 'تمت إضافة نقاط إيجابية' : 'تم تسجيل نقاط سلبية');
      setForm((f) => ({ ...f, reason: '' }));
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm('حذف هذا السجل؟')) return;
    try {
      await api('/api/behavior', { method: 'DELETE', body: { id: r.id } });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const totals = data?.totals || {};
  const sorted = [...students].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));

  return (
    <div>
      <PageHeader title="السلوك والنقاط" subtitle="نقاط إيجابية للمشاركة وسلبية للمخالفات" />
      <Card className="mb-6 p-4">
        <Select label="الفصل" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Card>
      <ErrorBox message={error} onRetry={load} />

      {canEdit && (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-bold"><Plus className="h-4 w-4" /> تسجيل نقطة جديدة</h2>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <Select label="الطالب" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </Select>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">النوع</span>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm({ ...form, type: 'positive', reason: '' })} className={cx('flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold', form.type === 'positive' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-line text-muted')}><ThumbsUp className="h-4 w-4" />إيجابي</button>
                <button type="button" onClick={() => setForm({ ...form, type: 'negative', reason: '' })} className={cx('flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold', form.type === 'negative' ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'border-line text-muted')}><ThumbsDown className="h-4 w-4" />سلبي</button>
              </div>
            </div>
            <Input label="عدد النقاط (1 - 10)" type="number" min="1" max="10" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
            <div className="space-y-2">
              <Input label="السبب" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="اكتب السبب أو اختر من الاقتراحات" />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              {REASONS[form.type].map((r) => (
                <button key={r} type="button" onClick={() => setForm({ ...form, reason: r })} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-soft">{r}</button>
              ))}
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" loading={saving} icon={Plus}>حفظ النقطة</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold">صافي نقاط الطلاب</h2>
          {!data && !error ? <Spinner /> : (
            <ul className="space-y-2">
              {sorted.map((s) => {
                const t = totals[s.id] || 0;
                return (
                  <li key={s.id} className="flex items-center gap-3 rounded-xl bg-soft p-3">
                    <Avatar src={s.photo_url} name={s.full_name} size="sm" />
                    <span className="flex-1 truncate text-sm font-medium">{s.full_name}</span>
                    <span className={cx('text-sm font-bold', t > 0 ? 'text-emerald-600' : t < 0 ? 'text-red-600' : 'text-muted')}>{t > 0 ? `+${t}` : t}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-0 lg:col-span-3">
          <h2 className="border-b border-line p-5 font-bold">سجل النقاط</h2>
          {!data ? <Spinner /> : data.records.length === 0 ? <Empty title="لا توجد سجلات بعد" /> : (
            <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
              {data.records.map((r) => (
                <li key={r.id} className="flex items-center gap-3 p-4">
                  <Badge tone={r.points > 0 ? 'success' : 'danger'}>{r.points > 0 ? `+${r.points}` : r.points}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.student_name}</p>
                    <p className="truncate text-xs text-muted">{r.reason || 'بدون سبب'} · {fmtDateTime(r.created_at)}</p>
                  </div>
                  {canEdit && <Button variant="ghost" icon={Trash2} className="px-2 text-red-600" aria-label="حذف" onClick={() => remove(r)} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
