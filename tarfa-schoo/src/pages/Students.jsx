import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Users, Eye, Phone, AlertTriangle, Mail } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Input, Select, Badge, Avatar, Spinner, Empty, ErrorBox } from '../components/ui';
import StudentForm from '../components/StudentForm';

const FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'warn', label: 'تجاوز 3 أيام غياب' },
  { value: 'nologin', label: 'بدون حساب دخول' },
  { value: 'low', label: 'متوسط أقل من 60%' },
];

export default function Students() {
  const { role, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const isStaff = role === 'admin' || role === 'assistant';
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState(null);
  const [classId, setClassId] = useState(params.get('class') || '');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadClasses = useCallback(async () => {
    try {
      const cs = await api('/api/classes');
      setClasses(cs);
      setClassId((cur) => cur || (cs[0] ? String(cs[0].id) : ''));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setError('');
    try {
      setStudents(await api('/api/students', { query: { class_id: classId || undefined } }));
    } catch (e) {
      setError(e.message);
    }
  }, [classId]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (classId) loadStudents();
  }, [classId, loadStudents]);

  const list = useMemo(() => {
    if (!students) return [];
    const q = search.trim();
    return students.filter((s) => {
      if (q && !(s.full_name.includes(q) || (s.national_id || '').includes(q))) return false;
      if (filter === 'warn') return (s.stats?.absent || 0) > 3;
      if (filter === 'nologin') return !s.email;
      if (filter === 'low') return s.stats?.avg !== null && s.stats?.avg < 60;
      return true;
    });
  }, [students, search, filter]);

  const remove = async (s) => {
    if (!window.confirm(`حذف الطالب ${s.full_name} وحسابه نهائياً؟`)) return;
    try {
      await api('/api/students', { method: 'DELETE', body: { id: s.id } });
      toast('تم حذف الطالب');
      loadStudents();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const changeClass = (v) => {
    setClassId(v);
    setParams(v ? { class: v } : {});
  };

  return (
    <div>
      <PageHeader
        title="الطلاب"
        subtitle={students ? `${students.length} طالب في الفصل المحدد` : ''}
        actions={isStaff && (
          <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }} disabled={!classes.length}>إضافة طالب</Button>
        )}
      />

      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-3">
        <Select label="الفصل" value={classId} onChange={(e) => changeClass(e.target.value)}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="relative">
          <Input label="بحث" placeholder="الاسم أو الرقم القومي" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          <Search className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 text-muted" />
        </div>
        <Select label="تصفية" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </Select>
      </Card>

      <ErrorBox message={error} onRetry={loadStudents} />
      {students === null && !error ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Empty icon={Users} title="لا يوجد طلاب مطابقون" text="غيّر البحث أو التصفية" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <Card key={s.id} className="flex flex-col gap-4 p-4 animate-fade-up">
              <div className="flex items-center gap-3">
                <Avatar src={s.photo_url} name={s.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.full_name}</p>
                  <p className="truncate text-xs text-muted" dir="ltr">{s.national_id}</p>
                </div>
                {(s.stats?.absent || 0) > 3 && <Badge tone="danger"><AlertTriangle className="h-3 w-3" />{s.stats.absent} غياب</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-soft p-2"><p className="text-[11px] text-muted">المتوسط</p><p className="font-bold">{s.stats?.avg == null ? '—' : `${s.stats.avg}%`}</p></div>
                <div className="rounded-xl bg-soft p-2"><p className="text-[11px] text-muted">الغياب</p><p className="font-bold">{s.stats?.absent || 0}</p></div>
                <div className="rounded-xl bg-soft p-2"><p className="text-[11px] text-muted">السلوك</p><p className="font-bold">{s.stats?.behavior || 0}</p></div>
              </div>
              <div className="space-y-1 text-xs text-muted">
                {s.guardians?.[0] && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> ولي الأمر: {s.guardians[0].full_name} · <span dir="ltr">{s.guardians[0].phone}</span></p>}
                {s.email ? <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><span dir="ltr">{s.email}</span></p> : <Badge>بدون حساب دخول</Badge>}
              </div>
              <div className="mt-auto flex items-center gap-2">
                <Link to={`/students/${s.id}`} className="flex-1"><Button variant="secondary" icon={Eye} className="w-full">الملف</Button></Link>
                {isStaff && <Button variant="outline" icon={Pencil} className="px-3" aria-label="تعديل" onClick={() => { setEditing(s); setFormOpen(true); }} />}
                {role === 'admin' && <Button variant="outline" icon={Trash2} className="px-3 text-red-600" aria-label="حذف" onClick={() => remove(s)} />}
              </div>
            </Card>
          ))}
        </div>
      )}

      <StudentForm
        open={formOpen}
        student={editing}
        classes={classes}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); loadStudents(); }}
      />
    </div>
  );
}
