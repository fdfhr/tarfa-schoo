import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft, Plus, Trash2, CalendarDays } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Input, Select, Modal, Tabs, Spinner, ErrorBox, Empty } from '../components/ui';
import { DAYS, PERIODS, todayStr, cx } from '../lib/utils';

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function Schedule() {
  const { role } = useApp();
  const isStaff = role === 'admin' || role === 'assistant';
  const [tab, setTab] = useState('week');
  return (
    <div>
      <PageHeader title="الجدول والتقويم" subtitle="جدول الحصص الأسبوعي ومواعيد الاختبارات" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[{ value: 'week', label: 'الجدول الأسبوعي', icon: CalendarDays }, { value: 'month', label: 'التقويم الشهري', icon: CalendarDays }]}
      />
      {tab === 'week' ? <WeekView isStaff={isStaff} /> : <MonthView />}
    </div>
  );
}

function WeekView({ isStaff }) {
  const { toast, role, entity } = useApp();
  const [rows, setRows] = useState(null);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await api('/api/schedule'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    if (isStaff) {
      api('/api/classes').then(setClasses).catch(() => {});
      api('/api/teachers').then((d) => setTeachers(d.teachers || [])).catch(() => {});
    }
  }, [load, isStaff]);

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...modal, class_id: Number(modal.class_id), teacher_id: modal.teacher_id ? Number(modal.teacher_id) : null, period: Number(modal.period) };
      await api('/api/schedule', { method: modal.id ? 'PUT' : 'POST', body });
      toast('تم حفظ الحصة');
      setModal(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm('حذف هذه الحصة؟')) return;
    try {
      await api('/api/schedule', { method: 'DELETE', body: { id: r.id } });
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const find = (d, p) => (rows || []).find((r) => r.day === d && r.period === p);
  const title = role === 'teacher' ? `جدولي الأسبوعي (${entity?.full_name || ''})` : 'الجدول الأسبوعي';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        {isStaff && <Button icon={Plus} onClick={() => setModal({ class_id: classes[0]?.id ? String(classes[0].id) : '', teacher_id: '', day: DAYS[0], period: 1, subject: '', room: '' })}>إضافة حصة</Button>}
      </div>
      <ErrorBox message={error} onRetry={load} />
      {!rows && !error ? <Spinner /> : rows.length === 0 ? <Empty icon={CalendarDays} title="لم يُضف جدول بعد" /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-center text-sm">
            <thead className="bg-soft text-xs text-muted">
              <tr><th className="p-3">الحصة</th>{DAYS.map((d) => <th key={d} className="p-3">{d}</th>)}</tr>
            </thead>
            <tbody>
              {PERIODS.map((p) => (
                <tr key={p} className="border-t border-line">
                  <td className="p-3 font-bold text-primary">{p}</td>
                  {DAYS.map((d) => {
                    const r = find(d, p);
                    return (
                      <td key={d} className="p-2 align-top">
                        {r ? (
                          <div className="group relative rounded-xl bg-brand-50 p-2.5 text-right dark:bg-brand-900/50">
                            <p className="font-bold text-brand-700 dark:text-brand-200">{r.subject}</p>
                            <p className="text-xs text-muted">{r.class_name}</p>
                            {r.teacher_name && <p className="text-xs text-muted">{r.teacher_name}</p>}
                            {r.room && <p className="text-xs text-muted">قاعة {r.room}</p>}
                            {isStaff && (
                              <div className="mt-1 flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                <button onClick={() => setModal({ ...r, class_id: String(r.class_id), teacher_id: r.teacher_id ? String(r.teacher_id) : '' })} className="text-xs text-primary hover:underline">تعديل</button>
                                <button onClick={() => remove(r)} className="text-red-600" aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            )}
                          </div>
                        ) : isStaff ? (
                          <button onClick={() => setModal({ class_id: classes[0]?.id ? String(classes[0].id) : '', teacher_id: '', day: d, period: p, subject: '', room: '' })} className="h-full min-h-[52px] w-full rounded-xl border border-dashed border-line text-xs text-muted hover:bg-soft">+</button>
                        ) : <span className="text-muted">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={!!modal}
        title={modal?.id ? 'تعديل الحصة' : 'إضافة حصة'}
        onClose={() => setModal(null)}
        footer={<>
          <Button variant="outline" onClick={() => setModal(null)}>إلغاء</Button>
          <Button loading={saving} onClick={save}>حفظ</Button>
        </>}
      >
        {modal && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="الفصل" value={modal.class_id} onChange={(e) => setModal({ ...modal, class_id: e.target.value })}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="المدرس" value={modal.teacher_id} onChange={(e) => setModal({ ...modal, teacher_id: e.target.value })}>
              <option value="">غير محدد</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </Select>
            <Select label="اليوم" value={modal.day} onChange={(e) => setModal({ ...modal, day: e.target.value })}>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </Select>
            <Select label="رقم الحصة" value={modal.period} onChange={(e) => setModal({ ...modal, period: e.target.value })}>
              {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Input label="المادة" value={modal.subject} onChange={(e) => setModal({ ...modal, subject: e.target.value })} />
            <Input label="القاعة" value={modal.room} onChange={(e) => setModal({ ...modal, room: e.target.value })} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function MonthView() {
  const [cursor, setCursor] = useState(() => {
    const t = todayStr();
    return { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 };
  });
  const [exams, setExams] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/exams').then(setExams).catch((e) => setError(e.message));
  }, []);

  const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const key = (d) => `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const examsOn = (d) => (exams || []).filter((e) => e.exam_date === key(d));
  const today = todayStr();
  const monthName = first.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const move = (n) => setCursor((c) => { const d = new Date(Date.UTC(c.y, c.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  return (
    <div>
      <Card className="p-4 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <button onClick={() => move(1)} className="rounded-xl p-2 hover:bg-soft" aria-label="السابق"><ChevronRight className="h-5 w-5" /></button>
          <h2 className="font-bold">{monthName}</h2>
          <button onClick={() => move(-1)} className="rounded-xl p-2 hover:bg-soft" aria-label="التالي"><ChevronLeft className="h-5 w-5" /></button>
        </div>
        <ErrorBox message={error} />
        {!exams && !error ? <Spinner /> : (
          <div className="grid grid-cols-7 gap-1 text-center text-xs sm:gap-2">
            {WEEKDAYS.map((w) => <div key={w} className="pb-2 font-semibold text-muted">{w}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const list = examsOn(d);
              const isToday = key(d) === today;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(list.length ? { date: key(d), list } : null)}
                  className={cx(
                    'flex min-h-[56px] flex-col items-center gap-1 rounded-xl border p-1.5 transition sm:min-h-[80px]',
                    isToday ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/50' : 'border-line hover:bg-soft',
                  )}
                >
                  <span className={cx('font-semibold', isToday && 'text-primary')}>{d}</span>
                  {list.length > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{list.length} اختبار</span>}
                </button>
              );
            })}
          </div>
        )}
      </Card>
      {selected && (
        <Card className="mt-5 space-y-3 p-5">
          <h3 className="font-bold">الاختبارات في {selected.date}</h3>
          {selected.list.map((e) => (
            <div key={e.id} className="rounded-xl bg-soft p-3 text-sm">
              <p className="font-semibold">{e.title}</p>
              <p className="text-xs text-muted">{e.class_name} · {e.subject || '—'} · الدرجة النهائية {e.max_score}</p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
