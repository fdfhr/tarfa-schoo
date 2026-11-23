import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Phone, Mail, Users, BookOpen, UserCog } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Input, Select, Modal, Badge, Spinner, Empty, ErrorBox, Tabs } from '../components/ui';
import { isValidEmail } from '../lib/utils';

export default function Accounts() {
  const { role } = useApp();
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState('teachers');
  const tabs = [
    { value: 'teachers', label: 'المدرسون', icon: BookOpen },
    { value: 'guardians', label: 'أولياء الأمور', icon: Users },
    ...(isAdmin ? [{ value: 'assistant', label: 'مساعد المدير', icon: UserCog }] : []),
  ];
  return (
    <div>
      <PageHeader title="الحسابات" subtitle="إضافة وتعديل حسابات المدرسين وأولياء الأمور ومساعد المدير" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'teachers' && <TeachersTab />}
      {tab === 'guardians' && <GuardiansTab />}
      {tab === 'assistant' && isAdmin && <AssistantTab />}
    </div>
  );
}

// Shared list/loading/error wrapper for account tabs.
function useList(url) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await api(url));
    } catch (e) {
      setError(e.message);
    }
  }, [url]);
  useEffect(() => {
    load();
  }, [load]);
  return { rows, error, load, setRows };
}

function AccountShell({ error, loading, empty, children, onRetry }) {
  return (
    <>
      <ErrorBox message={error} onRetry={onRetry} />
      {loading ? <Spinner /> : empty ? <Empty title="لا توجد سجلات بعد" /> : children}
    </>
  );
}

function DeleteBtn({ onClick }) {
  const { role } = useApp();
  if (role !== 'admin') return null;
  return <Button variant="outline" icon={Trash2} className="px-3 text-red-600" aria-label="حذف" onClick={onClick} />;
}

/* ---------------- Teachers ---------------- */

const T_EMPTY = { full_name: '', subject: '', phone: '', email: '', password: '', class_ids: [] };

function TeachersTab() {
  const { role, toast } = useApp();
  const isAdmin = role === 'admin';
  const { rows, error, load } = useList('/api/teachers');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const teachers = rows?.teachers || [];
  const classes = rows?.classes || [];

  const save = async () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'الاسم مطلوب';
    if (!form.subject.trim()) e.subject = 'المادة مطلوبة';
    if (!form.phone.trim()) e.phone = 'الهاتف مطلوب';
    if (!isValidEmail(form.email)) e.email = 'بريد إلكتروني صحيح مطلوب';
    if (!form.id && form.password.length < 8) e.password = 'كلمة السر 8 أحرف على الأقل';
    if (form.password && form.password.length < 8) e.password = 'كلمة السر 8 أحرف على الأقل';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const body = { ...form, class_ids: form.class_ids.map(Number), password: form.password || undefined };
      await api('/api/teachers', { method: form.id ? 'PUT' : 'POST', body });
      toast(form.id ? 'تم تحديث بيانات المدرس' : 'تمت إضافة المدرس وحسابه');
      setForm(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`حذف حساب المدرس ${t.full_name} نهائياً؟ ستصبح فصوله بدون مدرس لتوزيعها من جديد.`)) return;
    try {
      await api('/api/teachers', { method: 'DELETE', body: { id: t.id } });
      toast('تم حذف المدرس');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggleClass = (id) =>
    setForm((f) => ({ ...f, class_ids: f.class_ids.includes(id) ? f.class_ids.filter((x) => x !== id) : [...f.class_ids, id] }));

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button icon={Plus} onClick={() => { setForm({ ...T_EMPTY }); setErrors({}); }}>إضافة مدرس</Button>
      </div>
      <AccountShell error={error} onRetry={load} loading={!rows && !error} empty={rows && teachers.length === 0}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teachers.map((t) => (
            <Card key={t.id} className="flex flex-col gap-3 p-5">
              <div>
                <p className="font-bold">{t.full_name}</p>
                <Badge tone="brand" className="mt-1">{t.subject}</Badge>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{t.phone}</span></p>
              <p className="flex items-center gap-2 text-sm text-muted"><Mail className="h-3.5 w-3.5" /><span dir="ltr" className="truncate">{t.email || 'بدون حساب'}</span></p>
              <div className="flex flex-wrap gap-1.5">
                {t.classes.length ? t.classes.map((c) => <Badge key={c.id}>{c.name}</Badge>) : <Badge tone="warning">بدون فصول</Badge>}
              </div>
              <div className="mt-auto flex gap-2 pt-2">
                <Button variant="outline" icon={Pencil} className="flex-1" onClick={() => { setForm({ ...t, password: '', class_ids: t.class_ids }); setErrors({}); }}>تعديل / نقل</Button>
                <DeleteBtn onClick={() => remove(t)} />
              </div>
            </Card>
          ))}
        </div>
      </AccountShell>

      <Modal
        open={!!form}
        wide
        title={form?.id ? 'تعديل بيانات المدرس' : 'إضافة مدرس جديد'}
        onClose={() => setForm(null)}
        footer={<>
          <Button variant="outline" onClick={() => setForm(null)}>إلغاء</Button>
          <Button loading={saving} onClick={save}>حفظ</Button>
        </>}
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="الاسم الكامل" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} error={errors.full_name} />
            <Input label="المادة" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} error={errors.subject} />
            <Input label="الهاتف" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} className="text-left" />
            <Input label="البريد الإلكتروني" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} error={errors.email} className="text-left" />
            <Input
              label={form.id ? 'كلمة سر جديدة' : 'كلمة السر'}
              dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password}
              hint={form.id ? (isAdmin ? 'اتركها فارغة لعدم التغيير' : 'تغيير كلمة السر للمدير فقط') : undefined}
              disabled={!!form.id && !isAdmin}
              className="text-left"
            />
            <div className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">الفصول المسؤول عنها</span>
              <div className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
                {classes.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-soft">
                    <input type="checkbox" className="accent-brand-600" checked={form.class_ids.includes(c.id)} onChange={() => toggleClass(c.id)} />
                    {c.name} <span className="text-xs text-muted">({c.subject || '—'})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ---------------- Guardians ---------------- */

const G_EMPTY = { full_name: '', relation: '', phone: '', email: '', password: '', student_ids: [] };

function GuardiansTab() {
  const { toast } = useApp();
  const { rows, error, load } = useList('/api/guardians');
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/students').then(setStudents).catch(() => {});
  }, []);

  const save = async () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'الاسم مطلوب';
    if (!form.relation.trim()) e.relation = 'صلة القرابة مطلوبة';
    if (!form.phone.trim()) e.phone = 'الهاتف مطلوب';
    if (!isValidEmail(form.email)) e.email = 'بريد إلكتروني صحيح مطلوب';
    if ((!form.id || form.password) && form.password.length < 8) e.password = 'كلمة السر 8 أحرف على الأقل';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await api('/api/guardians', {
        method: form.id ? 'PUT' : 'POST',
        body: { ...form, student_ids: form.student_ids.map(Number), password: form.password || undefined },
      });
      toast(form.id ? 'تم تحديث ولي الأمر' : 'تمت إضافة ولي الأمر وحسابه');
      setForm(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g) => {
    if (!window.confirm(`حذف حساب ${g.full_name}؟`)) return;
    try {
      await api('/api/guardians', { method: 'DELETE', body: { id: g.id } });
      toast('تم الحذف');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggleStudent = (id) =>
    setForm((f) => ({ ...f, student_ids: f.student_ids.includes(id) ? f.student_ids.filter((x) => x !== id) : [...f.student_ids, id] }));

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button icon={Plus} onClick={() => { setForm({ ...G_EMPTY }); setErrors({}); }}>إضافة ولي أمر</Button>
      </div>
      <AccountShell error={error} onRetry={load} loading={!rows && !error} empty={rows && rows.length === 0}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(rows || []).map((g) => (
            <Card key={g.id} className="flex flex-col gap-3 p-5">
              <div>
                <p className="font-bold">{g.full_name}</p>
                <p className="text-xs text-muted">{g.relation}</p>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{g.phone}</span></p>
              <p className="flex items-center gap-2 text-sm text-muted"><Mail className="h-3.5 w-3.5" /><span dir="ltr" className="truncate">{g.email}</span></p>
              <div className="flex flex-wrap gap-1.5">
                {g.students.length ? g.students.map((s) => <Badge key={s.id} tone="brand">{s.full_name} · {s.class_name}</Badge>) : <Badge tone="warning">لم يُربط بطالب</Badge>}
              </div>
              <div className="mt-auto flex gap-2 pt-2">
                <Button variant="outline" icon={Pencil} className="flex-1" onClick={() => { setForm({ ...g, password: '', student_ids: g.student_ids }); setErrors({}); }}>تعديل</Button>
                <DeleteBtn onClick={() => remove(g)} />
              </div>
            </Card>
          ))}
        </div>
      </AccountShell>

      <Modal
        open={!!form}
        wide
        title={form?.id ? 'تعديل ولي الأمر' : 'إضافة ولي أمر'}
        onClose={() => setForm(null)}
        footer={<>
          <Button variant="outline" onClick={() => setForm(null)}>إلغاء</Button>
          <Button loading={saving} onClick={save}>حفظ</Button>
        </>}
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="اسم ولي الأمر" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} error={errors.full_name} />
            <Input label="صلة القرابة" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} error={errors.relation} placeholder="أب / أم / عم..." />
            <Input label="رقم الهاتف" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} className="text-left" />
            <Input label="البريد الإلكتروني" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} error={errors.email} className="text-left" />
            <Input label={form.id ? 'كلمة سر جديدة' : 'كلمة السر'} dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} hint={form.id ? 'اتركها فارغة لعدم التغيير' : undefined} className="text-left" />
            <div className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">الأبناء المرتبطون (يمكن اختيار أكثر من ابن للإخوة)</span>
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
                {students.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-soft">
                    <input type="checkbox" className="accent-brand-600" checked={form.student_ids.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                    {s.full_name} <span className="text-xs text-muted">({s.class_name})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ---------------- Assistant (admin only) ---------------- */

const A_EMPTY = { full_name: '', phone: '', email: '', password: '' };

function AssistantTab() {
  const { toast } = useApp();
  const { rows, error, load } = useList('/api/assistant');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'الاسم مطلوب';
    if (!form.phone.trim()) e.phone = 'الهاتف مطلوب';
    if (!isValidEmail(form.email)) e.email = 'بريد إلكتروني صحيح مطلوب';
    if ((!form.id || form.password) && form.password.length < 8) e.password = 'كلمة السر 8 أحرف على الأقل';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await api('/api/assistant', { method: form.id ? 'PUT' : 'POST', body: { ...form, password: form.password || undefined } });
      toast(form.id ? 'تم تحديث حساب المساعد' : 'تمت إضافة المساعد');
      setForm(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`حذف حساب ${a.full_name}؟`)) return;
    try {
      await api('/api/assistant', { method: 'DELETE', body: { id: a.id } });
      toast('تم الحذف');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button icon={Plus} onClick={() => { setForm({ ...A_EMPTY }); setErrors({}); }} disabled={(rows || []).length > 0}>إضافة مساعد للمدير</Button>
      </div>
      <AccountShell error={error} onRetry={load} loading={!rows && !error} empty={rows && rows.length === 0}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(rows || []).map((a) => (
            <Card key={a.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <p className="font-bold">{a.full_name}</p>
                <Badge tone="brand">وكيل المدرسة</Badge>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{a.phone}</span></p>
              <p className="flex items-center gap-2 text-sm text-muted"><Mail className="h-3.5 w-3.5" /><span dir="ltr">{a.email}</span></p>
              <div className="mt-auto flex gap-2 pt-2">
                <Button variant="outline" icon={Pencil} className="flex-1" onClick={() => { setForm({ ...a, password: '' }); setErrors({}); }}>تعديل</Button>
                <Button variant="outline" icon={Trash2} className="px-3 text-red-600" aria-label="حذف" onClick={() => remove(a)} />
              </div>
            </Card>
          ))}
        </div>
      </AccountShell>

      <Modal
        open={!!form}
        title={form?.id ? 'تعديل حساب المساعد' : 'إضافة مساعد المدير'}
        onClose={() => setForm(null)}
        footer={<>
          <Button variant="outline" onClick={() => setForm(null)}>إلغاء</Button>
          <Button loading={saving} onClick={save}>حفظ</Button>
        </>}
      >
        {form && (
          <div className="grid gap-4">
            <Input label="الاسم الكامل" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} error={errors.full_name} />
            <Input label="الهاتف" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} className="text-left" />
            <Input label="البريد الإلكتروني" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} error={errors.email} className="text-left" />
            <Input label={form.id ? 'كلمة سر جديدة' : 'كلمة السر'} dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} className="text-left" />
          </div>
        )}
      </Modal>
    </>
  );
}
