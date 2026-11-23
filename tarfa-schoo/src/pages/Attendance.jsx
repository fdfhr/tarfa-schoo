import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, Save, AlertTriangle, CalendarCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Select, Input, Spinner, Empty, ErrorBox, Avatar, Badge } from '../components/ui';
import { todayStr, STATUS_LABEL, cx, fmtDate } from '../lib/utils';

const OPTIONS = [
  { value: 'present', cls: 'bg-emerald-600 text-white', label: 'حاضر' },
  { value: 'absent', cls: 'bg-red-600 text-white', label: 'غائب' },
  { value: 'late', cls: 'bg-amber-500 text-white', label: 'متأخر' },
];

export default function Attendance() {
  const { toast } = useApp();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    api('/api/classes').then((cs) => {
      setClasses(cs);
      if (cs[0]) setClassId(String(cs[0].id));
    }).catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    if (!classId || !date) return;
    setError('');
    try {
      const r = await api('/api/attendance', { query: { class_id: classId, date } });
      setRows(r.students);
      setDirty(false);
    } catch (e) {
      setError(e.message);
    }
  }, [classId, date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api('/api/attendance', { query: { warnings: 1 } }).then(setWarnings).catch(() => {});
  }, []);

  const setStatus = (id, status) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    setDirty(true);
  };

  const markAll = () => {
    setRows((rs) => rs.map((r) => ({ ...r, status: 'present' })));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const records = rows.filter((r) => r.status).map((r) => ({ student_id: r.id, status: r.status }));
      if (!records.length) throw new Error('علّم حالة طالب واحد على الأقل');
      await api('/api/attendance', { method: 'POST', body: { class_id: Number(classId), date, records } });
      toast('تم حفظ الحضور');
      setDirty(false);
      api('/api/attendance', { query: { warnings: 1 } }).then(setWarnings).catch(() => {});
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, none: 0 };
    (rows || []).forEach((r) => (r.status ? c[r.status]++ : c.none++));
    return c;
  }, [rows]);

  const className = classes.find((c) => String(c.id) === classId)?.name;

  return (
    <div>
      <PageHeader
        title="الغياب"
        subtitle={`${className || ''} · ${fmtDate(date)}`}
        actions={<>
          <Button variant="outline" icon={CheckCheck} onClick={markAll} disabled={!rows?.length}>الكل حاضر</Button>
          <Button icon={Save} onClick={save} loading={saving} disabled={!rows?.length || !dirty}>حفظ الحضور</Button>
        </>}
      />

      <Card className="mb-5 grid gap-3 p-4 sm:grid-cols-2">
        <Select label="الفصل" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="التاريخ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Card>

      {warnings.length > 0 && (
        <Card className="mb-5 border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <div className="mb-2 flex items-center gap-2 font-bold text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" /> تنبيه: طلاب تجاوزوا 3 أيام غياب
          </div>
          <div className="flex flex-wrap gap-2">
            {warnings.map((w) => <Badge key={w.student_id} tone="danger">{w.full_name} ({w.class_name}) · {w.count} يوم</Badge>)}
          </div>
        </Card>
      )}

      <ErrorBox message={error} onRetry={load} />
      {rows && (
        <div className="mb-4 grid grid-cols-4 gap-2 text-center text-xs sm:text-sm">
          <div className="rounded-xl bg-emerald-50 p-2.5 font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">حاضر {counts.present}</div>
          <div className="rounded-xl bg-red-50 p-2.5 font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">غائب {counts.absent}</div>
          <div className="rounded-xl bg-amber-50 p-2.5 font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">متأخر {counts.late}</div>
          <div className="rounded-xl bg-soft p-2.5 font-bold text-muted">لم يُحدد {counts.none}</div>
        </div>
      )}

      {!rows && !error ? <Spinner /> : rows?.length === 0 ? <Empty icon={CalendarCheck} title="لا يوجد طلاب في هذا الفصل" /> : (
        <div className="space-y-2">
          {rows?.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={r.photo_url} name={r.full_name} size="sm" />
                <span className="truncate font-semibold">{r.full_name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex">
                {OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setStatus(r.id, o.value)}
                    className={cx(
                      'rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95',
                      r.status === o.value ? o.cls + ' shadow-md' : 'bg-soft text-muted hover:text-ink',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
