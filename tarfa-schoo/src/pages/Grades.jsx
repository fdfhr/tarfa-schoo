import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2, ArrowRight, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Input, Select, Modal, Badge, Spinner, Empty, ErrorBox } from '../components/ui';
import { todayStr, fmtDate, gradeClass, gradeLabel as gradeLabelLocal, cx } from '../lib/utils';

export default function Grades() {
  const { toast } = useApp();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [exams, setExams] = useState(null);
  const [openExam, setOpenExam] = useState(null);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

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
      setExams(await api('/api/exams', { query: { class_id: classId } }));
    } catch (e) {
      setError(e.message);
    }
  }, [classId]);

  useEffect(() => {
    setOpenExam(null);
    load();
  }, [load]);

  const remove = async (ex) => {
    if (!window.confirm(`حذف الاختبار ${ex.title} وجميع درجاته؟`)) return;
    try {
      await api('/api/exams', { method: 'DELETE', body: { id: ex.id } });
      toast('تم حذف الاختبار');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (openExam) {
    return <ExamSheet examId={openExam} onBack={() => { setOpenExam(null); load(); }} />;
  }

  return (
    <div>
      <PageHeader
        title="الدرجات"
        subtitle="اختبارات الفصل ورصد الدرجات"
        actions={<Button icon={Plus} onClick={() => setCreateOpen(true)} disabled={!classId}>إضافة اختبار</Button>}
      />
      <Card className="mb-6 p-4">
        <Select label="الفصل" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Card>
      <ErrorBox message={error} onRetry={load} />
      {!exams && !error ? <Spinner /> : exams?.length === 0 ? <Empty icon={FileText} title="لا توجد اختبارات لهذا الفصل" text="أضف اختباراً جديداً لبدء رصد الدرجات" /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {exams?.map((ex) => (
            <Card key={ex.id} className="flex flex-col gap-4 p-5 animate-fade-up">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{ex.title}</p>
                  <p className="text-xs text-muted">{ex.subject || '—'} · {fmtDate(ex.exam_date)}</p>
                </div>
                <Badge tone="brand">النهائية {ex.max_score}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-soft p-2.5"><p className="text-[11px] text-muted">المتوسط</p><p className="font-bold">{ex.average == null ? '—' : `${ex.average}%`}</p></div>
                <div className="rounded-xl bg-soft p-2.5"><p className="text-[11px] text-muted">المرصودة</p><p className="font-bold">{ex.graded}</p></div>
                <div className="rounded-xl bg-soft p-2.5"><p className="text-[11px] text-muted">ضعيف</p><p className="font-bold text-red-600">{ex.weak}</p></div>
              </div>
              <div className="mt-auto flex gap-2">
                <Button className="flex-1" variant="secondary" onClick={() => setOpenExam(ex.id)}>رصد الدرجات</Button>
                <Button variant="outline" icon={Trash2} className="px-3 text-red-600" aria-label="حذف" onClick={() => remove(ex)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateExam open={createOpen} classId={classId} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
    </div>
  );
}

function CreateExam({ open, classId, onClose, onCreated }) {
  const { toast } = useApp();
  const empty = { title: '', subject: '', exam_date: todayStr(), max_score: 50, term: '1' };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setF(empty); setErrors({}); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const e = {};
    if (!f.title.trim()) e.title = 'عنوان الاختبار مطلوب';
    if (!f.exam_date) e.exam_date = 'اختر التاريخ';
    if (!(Number(f.max_score) > 0)) e.max_score = 'الدرجة النهائية يجب أن تكون أكبر من صفر';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await api('/api/exams', { method: 'POST', body: { ...f, class_id: Number(classId), max_score: Number(f.max_score) } });
      toast('تمت إضافة الاختبار');
      onCreated();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="إضافة اختبار جديد" onClose={onClose} footer={<>
      <Button variant="outline" onClick={onClose}>إلغاء</Button>
      <Button loading={saving} onClick={save}>حفظ الاختبار</Button>
    </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="اسم الاختبار" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errors.title} /></div>
        <Input label="المادة" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <Input label="التاريخ" type="date" value={f.exam_date} onChange={(e) => setF({ ...f, exam_date: e.target.value })} error={errors.exam_date} />
        <Input label="الدرجة النهائية" type="number" min="1" value={f.max_score} onChange={(e) => setF({ ...f, max_score: e.target.value })} error={errors.max_score} />
        <Select label="الترم" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })}>
          <option value="1">الترم الأول</option>
          <option value="2">الترم الثاني</option>
        </Select>
      </div>
    </Modal>
  );
}

function ExamSheet({ examId, onBack }) {
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await api('/api/exams', { query: { exam_id: examId } });
      setData(d);
      setValues(Object.fromEntries(d.rows.map((r) => [r.student_id, r.score ?? ''])));
      setDirty(false);
    } catch (e) {
      setError(e.message);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  const max = Number(data?.exam.max_score || 0);
  const rowsView = (data?.rows || []).map((r) => {
    const v = values[r.student_id];
    const score = v === '' || v === null || v === undefined ? null : Number(v);
    const p = score === null || !max ? null : Math.round((score / max) * 10000) / 100;
    const label = p === null ? null : gradeLabelLocal(p, data.scale);
    return { ...r, score, pct: p, label };
  });
  const graded = rowsView.filter((r) => r.pct !== null);
  const avg = graded.length ? Math.round((graded.reduce((a, r) => a + r.pct, 0) / graded.length) * 100) / 100 : null;

  const save = async () => {
    for (const [sid, v] of Object.entries(values)) {
      if (v === '') continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > max) {
        return toast(`الدرجة يجب أن تكون بين 0 و ${max}`, 'error');
      }
    }
    setSaving(true);
    try {
      const scores = data.rows.map((r) => ({ student_id: r.student_id, score: values[r.student_id] === '' ? null : Number(values[r.student_id]) }));
      await api('/api/exams', { method: 'PUT', body: { exam_id: examId, scores } });
      toast('تم حفظ الدرجات');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowRight className="h-4 w-4" /> العودة للاختبارات
      </button>
      <PageHeader
        title={data?.exam.title || 'رصد الدرجات'}
        subtitle={data ? `${data.exam.class_name} · ${fmtDate(data.exam.exam_date)} · النهائية ${data.exam.max_score}` : ''}
        actions={<Button icon={Save} onClick={save} loading={saving} disabled={!dirty}>حفظ الدرجات</Button>}
      />
      <ErrorBox message={error} onRetry={load} />
      {!data && !error ? <Spinner /> : data && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-4 text-center"><p className="text-xs text-muted">المتوسط</p><p className="text-xl font-bold">{avg === null ? '—' : `${avg}%`}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-muted">المرصودة</p><p className="text-xl font-bold">{graded.length} / {rowsView.length}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-muted">أعلى درجة</p><p className="text-xl font-bold">{graded.length ? Math.max(...graded.map((r) => r.score)) : '—'}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-muted">ضعيف (أقل من المقبول)</p><p className="text-xl font-bold text-red-600">{graded.filter((r) => r.label === 'ضعيف').length}</p></Card>
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-soft text-xs text-muted">
                <tr><th className="p-3 text-right">الطالب</th><th className="p-3 text-right">الدرجة من {max}</th><th className="p-3 text-right">النسبة</th><th className="p-3 text-right">التقدير</th></tr>
              </thead>
              <tbody>
                {rowsView.map((r) => (
                  <tr key={r.student_id} className={cx('border-t border-line', r.label === 'ضعيف' && 'bg-red-50/70 dark:bg-red-950/30')}>
                    <td className="p-3 font-medium">{r.full_name}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min="0"
                        max={max}
                        step="0.5"
                        value={values[r.student_id] ?? ''}
                        onChange={(e) => { setValues((v) => ({ ...v, [r.student_id]: e.target.value })); setDirty(true); }}
                        className="w-24 rounded-lg border border-line bg-surface px-2.5 py-1.5 outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="p-3 text-muted">{r.pct === null ? '—' : `${r.pct}%`}</td>
                    <td className="p-3">{r.label ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeClass(r.label)}`}>{r.label}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

