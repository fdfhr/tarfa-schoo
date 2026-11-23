import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, CalendarCheck, Star, Trophy, AlertTriangle, Users, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, StatCard, Spinner, ErrorBox, Tabs, Empty, Badge, Avatar, Button } from '../components/ui';
import { fmtDate, gradeClass, STATUS_LABEL, DAYS, printStudentResults, DEFAULT_SCHOOL } from '../lib/utils';

export default function MyPortal() {
  const { role, entity, me, toast, settings } = useApp();
  const children = role === 'guardian' ? entity?.children || [] : [];
  const [selected, setSelected] = useState(role === 'student' ? entity?.id : children[0]?.id);
  const [detail, setDetail] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [tab, setTab] = useState('grades');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError('');
    api('/api/students', { query: { id: selected, detail: 1 } })
      .then(async (d) => {
        setDetail(d);
        setSchedule(await api('/api/schedule', { query: { class_id: d.class_id } }));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (role === 'guardian' && !children.length) {
    return (
      <div>
        <PageHeader title="لوحة ولي الأمر" />
        <Empty icon={Users} title="لا يوجد أبناء مرتبطون بهذا الحساب" text="تواصل مع إدارة المدرسة لربط الأبناء" />
      </div>
    );
  }

  const st = detail?.stats;
  const total = st ? st.present + st.absent + st.late : 0;
  const rate = total ? Math.round(((st.present + st.late) / total) * 100) : null;
  const sorted = [...(detail?.scores || [])].sort((a, b) => new Date(b.exam_date) - new Date(a.exam_date));

  return (
    <div>
      <PageHeader
        title={role === 'guardian' ? 'لوحة ولي الأمر' : 'لوحة الطالب'}
        subtitle={detail ? `${detail.full_name} · ${detail.class_name}` : ''}
        actions={detail && (
          <Button variant="secondary" icon={Printer} onClick={() => { if (!printStudentResults(detail, settings.school_name || DEFAULT_SCHOOL)) toast('امنع النوافذ المنبثقة لطباعة النتيجة', 'error'); }}>
            طباعة النتيجة
          </Button>
        )}
      />

      {role === 'guardian' && children.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-right transition ${
                selected === c.id ? 'border-brand-600 bg-brand-600 text-white shadow-md' : 'border-line bg-surface hover:bg-soft'
              }`}
            >
              <Avatar src={c.photo_url} name={c.full_name} size="sm" />
              <div>
                <p className="text-sm font-bold">{c.full_name}</p>
                <p className={`text-xs ${selected === c.id ? 'text-white/80' : 'text-muted'}`}>{c.class_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <ErrorBox message={error} />
      {loading && !detail ? (
        <Spinner />
      ) : detail ? (
        <>
          {st?.absent > 3 && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-semibold">تنبيه: تجاوز الطالب 3 أيام غياب (عدد الغياب: {st.absent} يوم).</p>
            </div>
          )}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard icon={GraduationCap} label="متوسط الدرجات" value={st?.avg == null ? '—' : `${st.avg}%`} />
            <StatCard icon={CalendarCheck} label="نسبة الحضور" value={rate === null ? '—' : `${rate}%`} hint={`غياب: ${st?.absent || 0} يوم`} tone="success" />
            <StatCard icon={Star} label="نقاط السلوك" value={st?.behavior ?? 0} tone="warning" />
            <StatCard icon={Trophy} label="الترتيب في الفصل" value={detail.rank ? `${detail.rank} / ${detail.class_size}` : '—'} />
          </div>

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'grades', label: 'الدرجات', icon: GraduationCap },
              { value: 'attendance', label: 'الحضور', icon: CalendarCheck },
              { value: 'behavior', label: 'السلوك', icon: Star },
              { value: 'schedule', label: 'الجدول', icon: Users },
            ]}
          />

          {tab === 'grades' && (
            <Card className="overflow-x-auto p-0">
              {sorted.length === 0 ? <Empty title="لا توجد درجات بعد" /> : (
                <table className="w-full text-sm">
                  <thead className="bg-soft text-xs text-muted">
                    <tr><th className="p-3 text-right">الاختبار</th><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">الدرجة</th><th className="p-3 text-right">النسبة</th><th className="p-3 text-right">التقدير</th></tr>
                  </thead>
                  <tbody>
                    {sorted.map((s) => (
                      <tr key={s.exam_id} className="border-t border-line">
                        <td className="p-3 font-medium">{s.title}</td>
                        <td className="p-3 text-muted">{fmtDate(s.exam_date)}</td>
                        <td className="p-3">{s.score} / {s.max_score}</td>
                        <td className="p-3">{s.pct}%</td>
                        <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeClass(s.label)}`}>{s.label}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {tab === 'attendance' && (
            <Card className="divide-y divide-line p-0">
              {detail.attendance.length === 0 ? <Empty title="لا توجد سجلات حضور" /> : detail.attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-4">
                  <span className="text-sm">{fmtDate(a.date)}</span>
                  <Badge tone={a.status === 'absent' ? 'danger' : a.status === 'late' ? 'warning' : 'success'}>{STATUS_LABEL[a.status]}</Badge>
                </div>
              ))}
            </Card>
          )}

          {tab === 'behavior' && (
            <Card className="divide-y divide-line p-0">
              {detail.behavior.length === 0 ? <Empty title="لا توجد نقاط سلوك" /> : detail.behavior.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">{b.reason || (b.points > 0 ? 'نقاط إيجابية' : 'نقاط سلبية')}</p>
                    <p className="text-xs text-muted">{fmtDate(b.created_at)}</p>
                  </div>
                  <span className={`text-sm font-bold ${b.points > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{b.points > 0 ? `+${b.points}` : b.points}</span>
                </div>
              ))}
            </Card>
          )}

          {tab === 'schedule' && (
            <Card className="overflow-x-auto p-0">
              {schedule.length === 0 ? <Empty title="لم يُضف جدول لهذا الفصل بعد" /> : (
                <table className="w-full min-w-[480px] text-center text-sm">
                  <thead className="bg-soft text-xs text-muted">
                    <tr><th className="p-3">الحصة</th>{DAYS.map((d) => <th key={d} className="p-3">{d}</th>)}</tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                      <tr key={p} className="border-t border-line">
                        <td className="p-3 font-bold text-primary">{p}</td>
                        {DAYS.map((d) => {
                          const r = schedule.find((x) => x.day === d && x.period === p);
                          return <td key={d} className="p-3">{r ? <span className="font-medium">{r.subject}</span> : <span className="text-muted">—</span>}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link to="/announcements" className="font-semibold text-primary hover:underline">إعلانات الفصل</Link>
            <Link to="/channel" className="font-semibold text-primary hover:underline">قناة المدرسة</Link>
            <Link to="/honor" className="font-semibold text-primary hover:underline">لوحة الشرف</Link>
          </div>
        </>
      ) : null}
      {me?.error && <ErrorBox message={me.error} />}
    </div>
  );
}
