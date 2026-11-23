import { useCallback, useEffect, useState } from 'react';
import { Send, FileDown, Table2, MessageSquare, Inbox, Bot } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, Badge, Spinner, Empty, ErrorBox, Tabs } from '../components/ui';
import { exportExcel, exportPdf, fmtDateTime, fmtDate } from '../lib/utils';

const KINDS = [
  { value: 'attendance', label: 'تقرير غياب وحضور' },
  { value: 'grades', label: 'تقرير درجات' },
  { value: 'behavior', label: 'تقرير سلوك ونقاط' },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export default function Reports() {
  const { role } = useApp();
  const isStaff = role === 'admin' || role === 'assistant';
  const [tab, setTab] = useState(isStaff ? 'inbox' : 'mine');
  const tabs = isStaff
    ? [{ value: 'inbox', label: 'التقارير الواردة', icon: Inbox }, { value: 'chat', label: 'تحويلات الشات', icon: Bot }]
    : [{ value: 'mine', label: 'تقاريري', icon: Table2 }, { value: 'new', label: 'إنشاء تقرير وإرساله', icon: Send }];
  return (
    <div>
      <PageHeader title="التقارير" subtitle={isStaff ? 'تقارير المدرسين والرد عليها' : 'أنشئ تقارير فصلك وأرسلها للإدارة'} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'inbox' && <Inbox_ />}
      {tab === 'chat' && <ChatEscalations />}
      {tab === 'mine' && <MyReports />}
      {tab === 'new' && <NewReport onSent={() => setTab('mine')} />}
    </div>
  );
}

function useReports() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await api('/api/reports'));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { rows, error, load };
}

function ReportCard({ r, onOpen }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold">{r.title}</p>
          <p className="text-xs text-muted">{KIND_LABEL[r.kind]} · {r.class_name} · {r.teacher_name}</p>
        </div>
        <Badge tone={r.status === 'replied' ? 'success' : 'warning'}>{r.status === 'replied' ? 'تم الرد' : 'جديد'}</Badge>
      </div>
      <p className="text-xs text-muted">{fmtDateTime(r.created_at)}</p>
      <Button variant="secondary" onClick={() => onOpen(r)} className="mt-auto">عرض التقرير</Button>
    </Card>
  );
}

function Inbox_() {
  const { rows, error, load } = useReports();
  const { toast } = useApp();
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);

  const sendReply = async () => {
    if (!reply.trim()) return toast('اكتب نص الرد', 'error');
    setSaving(true);
    try {
      await api('/api/reports', { method: 'PUT', body: { id: open.id, reply } });
      toast('تم إرسال الرد للمدرس');
      setOpen(null);
      setReply('');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ErrorBox message={error} onRetry={load} />
      {!rows && !error ? <Spinner /> : rows?.length === 0 ? <Empty icon={Inbox} title="لم تصل تقارير بعد" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows?.map((r) => <ReportCard key={r.id} r={r} onOpen={(x) => { setOpen(x); setReply(x.reply || ''); }} />)}
        </div>
      )}
      <ReportModal
        report={open}
        onClose={() => setOpen(null)}
        footer={open && (
          <div className="w-full space-y-3">
            {open.reply && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">الرد السابق: {open.reply}</p>}
            <Textarea label="الرد على المدرس" value={reply} onChange={(e) => setReply(e.target.value)} rows={2} />
            <div className="flex justify-end"><Button loading={saving} onClick={sendReply}>إرسال الرد</Button></div>
          </div>
        )}
      />
    </>
  );
}

function ChatEscalations() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/api/chat', { query: { escalated: 1 } }).then(setRows).catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <p className="mb-4 text-sm text-muted">الأسئلة الحساسة أو التي لم يجد لها الشات إجابة تُحول هنا للإدارة.</p>
      <ErrorBox message={error} />
      {!rows && !error ? <Spinner /> : rows?.length === 0 ? <Empty icon={Bot} title="لا توجد تحويلات" /> : (
        <div className="space-y-3">
          {rows?.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted"><span dir="ltr">{m.user_email}</span><span>{fmtDateTime(m.created_at)}</span></div>
              <p className="text-sm font-semibold">السؤال: {m.message}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">الرد: {m.reply}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function MyReports() {
  const { rows, error, load } = useReports();
  const [open, setOpen] = useState(null);
  return (
    <>
      <ErrorBox message={error} onRetry={load} />
      {!rows && !error ? <Spinner /> : rows?.length === 0 ? <Empty icon={Table2} title="لم ترسل أي تقرير بعد" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows?.map((r) => <ReportCard key={r.id} r={r} onOpen={setOpen} />)}
        </div>
      )}
      <ReportModal report={open} onClose={() => setOpen(null)} footer={open?.reply && (
        <div className="w-full rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <p className="mb-1 flex items-center gap-2 font-bold"><MessageSquare className="h-4 w-4" /> رد الإدارة ({fmtDate(open.replied_at)})</p>
          {open.reply}
        </div>
      )} />
    </>
  );
}

function NewReport({ onSent }) {
  const { toast } = useApp();
  const [classes, setClasses] = useState([]);
  const [f, setF] = useState({ class_id: '', kind: 'attendance', title: '', note: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api('/api/classes').then((cs) => {
      setClasses(cs);
      setF((x) => ({ ...x, class_id: x.class_id || (cs[0] ? String(cs[0].id) : '') }));
    }).catch(() => {});
  }, []);

  const send = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.title.trim()) errs.title = 'عنوان التقرير مطلوب';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await api('/api/reports', { method: 'POST', body: { ...f, class_id: Number(f.class_id) } });
      toast('تم إرسال التقرير للمدير');
      onSent();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={send} className="grid gap-4 sm:grid-cols-2">
        <Select label="الفصل" value={f.class_id} onChange={(e) => setF({ ...f, class_id: e.target.value })}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select label="نوع التقرير" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </Select>
        <div className="sm:col-span-2"><Input label="عنوان التقرير" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errors.title} /></div>
        <div className="sm:col-span-2"><Textarea label="ملاحظة للمدير (اختياري)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <p className="text-xs text-muted sm:col-span-2">يُنشأ التقرير تلقائياً من بيانات الفصل الحالية ويمكن تصديره PDF وExcel.</p>
        <div className="flex justify-end sm:col-span-2"><Button type="submit" icon={Send} loading={saving}>إنشاء وإرسال للمدير</Button></div>
      </form>
    </Card>
  );
}

function ReportModal({ report, onClose, footer }) {
  const { toast } = useApp();
  if (!report) return null;
  const { headers = [], rows = [] } = report.content || {};
  const meta = `${KIND_LABEL[report.kind]} — ${report.class_name} — ${report.teacher_name} — ${fmtDateTime(report.created_at)}`;
  const exportName = `${report.title}-${report.class_name}`;
  const pdf = () => { if (!exportPdf(report.title, headers, rows, meta)) toast('ألغِ مانع النوافذ المنبثقة للتصدير', 'error'); };
  return (
    <Modal
      open
      wide
      title={report.title}
      onClose={onClose}
      footer={<>
        <Button variant="outline" icon={FileDown} onClick={pdf}>تصدير PDF</Button>
        <Button variant="outline" icon={Table2} onClick={() => exportExcel(exportName, headers, rows)}>تصدير Excel</Button>
        {footer && <div className="w-full">{footer}</div>}
      </>}
    >
      <p className="mb-4 text-xs text-muted">{meta}</p>
      {report.note && <p className="mb-4 rounded-xl bg-soft p-3 text-sm">{report.note}</p>}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-soft text-xs text-muted">
            <tr>{headers.map((h) => <th key={h} className="whitespace-nowrap p-2.5 text-right">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                {r.map((c, j) => <td key={j} className="whitespace-nowrap p-2.5">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
