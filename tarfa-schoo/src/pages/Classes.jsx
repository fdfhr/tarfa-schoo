import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, School, Users, UserX } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Input, Modal, Badge, Spinner, Empty, ErrorBox } from '../components/ui';

const EMPTY = { name: '', stage: '', subject: '' };

export default function Classes() {
  const { role, toast } = useApp();
  const isStaff = role === 'admin' || role === 'assistant';
  const [classes, setClasses] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setClasses(await api('/api/classes'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.name.trim()) return setErrors({ name: 'اسم الفصل مطلوب' });
    setSaving(true);
    try {
      await api('/api/classes', { method: form.id ? 'PUT' : 'POST', body: form });
      toast(form.id ? 'تم تحديث الفصل' : 'تمت إضافة الفصل');
      setForm(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`حذف الفصل ${c.name}؟`)) return;
    try {
      await api('/api/classes', { method: 'DELETE', body: { id: c.id } });
      toast('تم حذف الفصل');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="الفصول"
        subtitle="الفصول التي تشرف عليها"
        actions={isStaff && <Button icon={Plus} onClick={() => { setForm({ ...EMPTY }); setErrors({}); }}>إضافة فصل</Button>}
      />
      <ErrorBox message={error} onRetry={load} />
      {!classes && !error ? (
        <Spinner />
      ) : classes?.length === 0 ? (
        <Empty icon={School} title="لا توجد فصول" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes?.map((c) => (
            <Card key={c.id} className="flex flex-col p-5 animate-fade-up">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{c.name}</p>
                  <p className="text-sm text-muted">{c.stage || '—'} · {c.subject || '—'}</p>
                </div>
                {c.teachers.length === 0 && <Badge tone="warning"><UserX className="h-3 w-3" />بدون مدرس</Badge>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-soft p-3">
                  <p className="flex items-center gap-1 text-xs text-muted"><Users className="h-3.5 w-3.5" />عدد الطلاب</p>
                  <p className="mt-1 text-xl font-bold">{c.students}</p>
                </div>
                <div className="rounded-xl bg-soft p-3">
                  <p className="text-xs text-muted">متوسط الفصل</p>
                  <p className="mt-1 text-xl font-bold">{c.average === null ? '—' : `${c.average}%`}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted">
                المدرسون: {c.teachers.map((t) => t.full_name).join('، ') || 'غير محدد'}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-5">
                <Link to={`/students?class=${c.id}`} className="flex-1">
                  <Button variant="secondary" className="w-full">عرض الطلاب</Button>
                </Link>
                {isStaff && (
                  <>
                    <Button variant="outline" icon={Pencil} className="px-3" aria-label="تعديل" onClick={() => { setForm({ id: c.id, name: c.name, stage: c.stage || '', subject: c.subject || '' }); setErrors({}); }} />
                    {role === 'admin' && <Button variant="outline" icon={Trash2} className="px-3 text-red-600" aria-label="حذف" onClick={() => remove(c)} />}
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!form}
        title={form?.id ? 'تعديل الفصل' : 'إضافة فصل جديد'}
        onClose={() => setForm(null)}
        footer={<>
          <Button variant="outline" onClick={() => setForm(null)}>إلغاء</Button>
          <Button loading={saving} onClick={save}>حفظ</Button>
        </>}
      >
        {form && (
          <div className="space-y-4">
            <Input label="اسم الفصل" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} placeholder="مثال: أولى ثانوي (2)" />
            <Input label="المرحلة" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} placeholder="الصف الأول الثانوي" />
            <Input label="المادة" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="اللغة العربية" />
          </div>
        )}
      </Modal>
    </div>
  );
}
