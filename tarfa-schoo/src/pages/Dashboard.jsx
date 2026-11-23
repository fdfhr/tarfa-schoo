import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { School, Users, CalendarCheck, AlertTriangle, CalendarClock, UserX } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, StatCard, Spinner, ErrorBox, Badge, Empty } from '../components/ui';
import { fmtDate } from '../lib/utils';
import MyPortal from './MyPortal';

export default function Dashboard() {
  const { role } = useApp();
  if (role === 'student' || role === 'guardian') return <MyPortal />;
  return <StaffDashboard />;
}

function StaffDashboard() {
  const { profile, role } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api('/api/dashboard'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxRate = 100;
  return (
    <div>
      <PageHeader
        title={`أهلاً، ${profile?.full_name?.split(' ').slice(0, 2).join(' ') || ''}`}
        subtitle={role === 'teacher' ? 'لوحة فصولك وطلابك' : 'نظرة عامة على المدرسة اليوم'}
      />
      <ErrorBox message={error} onRetry={load} />
      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard icon={School} label="الفصول" value={data.totals.classes} />
            <StatCard icon={Users} label="الطلاب" value={data.totals.students} />
            <StatCard
              icon={CalendarCheck}
              label="نسبة حضور اليوم"
              value={data.today.rate === null ? '—' : `${data.today.rate}%`}
              hint={data.today.recorded ? `سجلت ${data.today.recorded} حالة` : 'لم تُسجّل بعد'}
              tone="success"
            />
            <StatCard icon={AlertTriangle} label="تنبيه غياب" value={data.totals.warnings} hint="تجاوز 3 أيام غياب" tone="warning" />
          </div>

          {data.unassigned.length > 0 && (
            <Card className="flex flex-col gap-3 border-amber-300 bg-amber-50 p-5 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <UserX className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold">فصول بدون مدرس</p>
                  <p className="text-sm text-muted">{data.unassigned.map((c) => c.name).join('، ')}</p>
                </div>
              </div>
              <Link to="/accounts" className="text-sm font-semibold text-primary hover:underline">توزيع المدرسين</Link>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h2 className="mb-1 font-bold">نسبة الحضور آخر 4 أسابيع</h2>
              <p className="mb-6 text-xs text-muted">متوسط الحضور والتأخير لكل أسبوع</p>
              <div className="flex h-56 items-end justify-around gap-4 border-b border-line px-2 pb-2">
                {data.trend.map((w) => (
                  <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-sm font-bold">{w.rate === null ? '—' : `${w.rate}%`}</span>
                    <div className="relative w-full max-w-[72px] flex-1">
                      <div className="absolute inset-x-0 bottom-0 top-0 rounded-t-xl bg-soft" />
                      <div
                        className="animate-grow absolute inset-x-0 bottom-0 rounded-t-xl bg-gradient-to-t from-brand-600 to-brand-400"
                        style={{ height: `${((w.rate || 0) / maxRate) * 100}%` }}
                      />
                    </div>
                    <span className="text-center text-xs text-muted">{w.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <h2 className="font-bold">أقرب الاختبارات</h2>
              </div>
              {data.upcoming.length === 0 ? (
                <Empty title="لا توجد اختبارات قادمة" />
              ) : (
                <ul className="space-y-3">
                  {data.upcoming.map((e) => (
                    <li key={e.id} className="rounded-xl border border-line p-3">
                      <p className="text-sm font-semibold">{e.title}</p>
                      <p className="text-xs text-muted">{e.class_name} · {fmtDate(e.exam_date)}</p>
                      <div className="mt-2"><Badge tone="brand">الدرجة النهائية {e.max_score}</Badge></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div>
            <h2 className="mb-3 font-bold">الفصول ومتوسطاتها</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.classes.map((c) => (
                <Link key={c.id} to={`/students?class=${c.id}`}>
                  <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">{c.name}</p>
                        <p className="text-xs text-muted">{c.subject || '—'}</p>
                      </div>
                      <Badge tone="brand">{c.students} طالب</Badge>
                    </div>
                    <div className="mt-5">
                      <div className="mb-1.5 flex justify-between text-xs text-muted">
                        <span>متوسط الفصل</span>
                        <span className="font-bold text-ink">{c.average === null ? '—' : `${c.average}%`}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-soft">
                        <div className="h-full rounded-full bg-gradient-to-l from-brand-400 to-brand-600" style={{ width: `${c.average || 0}%` }} />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
