import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Pencil, Trash2, Save, Phone, Mail, CalendarDays, IdCard, Trophy, GraduationCap, CalendarCheck, Star, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, Button, Badge, Avatar, Spinner, ErrorBox, Tabs, Empty, StatCard, Textarea } from '../components/ui';
import StudentForm from '../components/StudentForm';
import { fmtDate, gradeClass, STATUS_LABEL, printStudentResults, printFullStudentReport, DEFAULT_SCHOOL } from '../lib/utils';

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, toast, settings } = useApp();
  const isStaff = role === 'admin' || role === 'assistant';
  const [data, setData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('grades');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await api('/api/students', { query: { id, detail: 1 } });
      setData(d);
      setNotes(d.teacher_notes || '');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    if (isStaff) api('/api/classes').then(setClasses).catch(() => {});
  }, [load, isStaff]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api('/api/students', { method: 'PUT', body: { id: data.id, teacher_notes: notes } });
      toast('تم حفظ الملاحظات');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('حذف الطالب وحسابه نهائياً؟')) return;
    try {
      await api('/api/students', { method: 'DELETE', body: { id: data.id } });
      toast('تم حذف الطالب');
      navigate('/students');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Spinner />;
  const st = data.stats || {};
  const total = (st.present || 0) + (st.absent || 0) + (st.late || 0);
  const rate = total ? Math.round((((st.present || 0) + (st.late || 0)) / total) * 100) : null;

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/students?class=${data.class_id}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
          <ArrowRight className="h-4 w-4" /> العودة للطلاب
        </Link>
        <Button variant="secondary" icon={Printer} onClick={() => { if (!printStudentResults({ ...data, class_name: data.class_name }, settings.school_name || DEFAULT_SCHOOL)) toast('امنع النوافذ المنبثقة لطباعة النتيجة', 'error'); }}>
          طباعة النتيجة
        </Button>
        {role === 'admin' && (
          <Button variant="outline" icon={Printer} onClick={() => { if (!printFullStudentReport(data, settings.school_name || DEFAULT_SCHOOL)) toast('امنع النوافذ المنبثقة لطباعة التقرير', 'error'); }}>
            تقرير شامل
          </Button>
        )}
      </div>

      <Card className="mb-6 flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <Avatar src={data.photo_url} name={data.full_name} size="lg" />
        <div className="flex-1 space-y-2">
          <h1 className="text-2xl font-bold">{data.full_name}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{data.class_name}</Badge>
            {data.rank > 0 && <Badge tone="warning"><Trophy className="h-3 w-3" />الترتيب {data.rank} من {data.class_size}</Badge>}
            {!data.email && <Badge>بدون حساب دخول</Badge>}
          </div>
          <div className="grid gap-2 text-sm text-muted sm:grid-cols-2">
            <p className="flex items-center gap-2"><IdCard className="h-4 w-4" /><span dir="ltr">{data.national_id}</span></p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /><span dir="ltr">{data.phone || '—'}</span></p>
            <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{fmtDate(data.birth_date)}</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /><span dir="ltr">{data.email || '—'}</span></p>
          </div>
        </div>
        {isStaff && (
          <div className="flex gap-2">
            <Button variant="outline" icon={Pencil} onClick={() => setEditOpen(true)}>تعديل</Button>
            {role === 'admin' && <Button variant="danger" icon={Trash2} onClick={remove}>حذف</Button>}
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-bold">ولي الأمر</h2>
          {data.guardians?.length ? data.guardians.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-xl bg-soft p-3 text-sm">
              <div><p className="font-semibold">{g.full_name}</p><p className="text-xs text-muted">{g.relation}</p></div>
              <span className="font-mono text-xs" dir="ltr">{g.phone}</span>
            </div>
          )) : <p className="text-sm text-muted">لم يُربط ولي أمر بعد</p>}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-bold">ملاحظات المدرس</h2>
          {isStaff || role === 'teacher' ? (
            <>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="اكتب ملاحظاتك عن الطالب" />
              <div className="mt-3 flex justify-end">
                <Button icon={Save} loading={savingNotes} onClick={saveNotes}>حفظ الملاحظات</Button>
              </div>
            </>
          ) : <p className="text-sm text-muted">{data.teacher_notes || 'لا توجد ملاحظات'}</p>}
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="المتوسط" value={st.avg == null ? '—' : `${st.avg}%`} />
        <StatCard icon={CalendarCheck} label="نسبة الحضور" value={rate === null ? '—' : `${rate}%`} tone="success" />
        <StatCard icon={CalendarCheck} label="أيام الغياب" value={st.absent || 0} tone={st.absent > 3 ? 'danger' : 'warning'} />
        <StatCard icon={Star} label="نقاط السلوك" value={st.behavior || 0} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'grades', label: 'الدرجات' },
          { value: 'attendance', label: 'الغياب' },
          { value: 'behavior', label: 'السلوك' },
        ]}
      />
      {tab === 'grades' && (
        <Card className="overflow-x-auto p-0">
          {!data.scores?.length ? <Empty title="لا توجد درجات" /> : (
            <table className="w-full text-sm">
              <thead className="bg-soft text-xs text-muted"><tr><th className="p-3 text-right">الاختبار</th><th className="p-3 text-right">الدرجة</th><th className="p-3 text-right">النسبة</th><th className="p-3 text-right">التقدير</th></tr></thead>
              <tbody>{data.scores.map((s) => (
                <tr key={s.exam_id} className="border-t border-line">
                  <td className="p-3">{s.title}</td><td className="p-3">{s.score} / {s.max_score}</td><td className="p-3">{s.pct}%</td>
                  <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeClass(s.label)}`}>{s.label}</span></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      )}
      {tab === 'attendance' && (
        <Card className="divide-y divide-line p-0">
          {!data.attendance?.length ? <Empty title="لا توجد سجلات حضور" /> : data.attendance.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-4 text-sm">
              <span>{fmtDate(a.date)}</span>
              <Badge tone={a.status === 'absent' ? 'danger' : a.status === 'late' ? 'warning' : 'success'}>{STATUS_LABEL[a.status]}</Badge>
            </div>
          ))}
        </Card>
      )}
      {tab === 'behavior' && (
        <Card className="divide-y divide-line p-0">
          {!data.behavior?.length ? <Empty title="لا توجد سجلات سلوك" /> : data.behavior.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div><p className="font-medium">{b.reason || 'بدون سبب محدد'}</p><p className="text-xs text-muted">{fmtDate(b.created_at)}</p></div>
              <span className={`font-bold ${b.points > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{b.points > 0 ? `+${b.points}` : b.points}</span>
            </div>
          ))}
        </Card>
      )}

      <StudentForm open={editOpen} student={data} classes={classes} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); }} />
    </div>
  );
}
