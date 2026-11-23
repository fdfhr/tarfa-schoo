import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Megaphone, Medal } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Select, Spinner, Empty, ErrorBox, Avatar } from '../components/ui';
import { cx } from '../lib/utils';

const MEDAL = [
  { ring: 'from-amber-300 to-yellow-500', text: 'text-amber-600', label: 'ذهبي', h: 'h-36' },
  { ring: 'from-slate-200 to-slate-400', text: 'text-slate-500', label: 'فضي', h: 'h-28' },
  { ring: 'from-orange-300 to-orange-600', text: 'text-orange-700', label: 'برونزي', h: 'h-24' },
];

export default function Honor() {
  const { role, toast } = useApp();
  const isStaff = role === 'admin' || role === 'assistant';
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);

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
      setData(await api('/api/honor', { query: { class_id: classId, period } }));
    } catch (e) {
      setError(e.message);
    }
  }, [classId, period]);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async () => {
    setPublishing(true);
    try {
      await api('/api/honor', { method: 'POST', body: { class_id: Number(classId), period } });
      toast('تم نشر لوحة الشرف في القناة');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const items = data?.items || [];
  const podium = [items[1], items[0], items[2]];
  const rest = items.slice(3);

  return (
    <div>
      <PageHeader
        title="لوحة الشرف"
        subtitle="أوائل الفصل بحسب الدرجات ونقاط السلوك"
        actions={isStaff && <Button variant="success" icon={Megaphone} loading={publishing} onClick={publish} disabled={!items.length}>نشر في القناة</Button>}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <Select label="الفصل" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Card>
        <Card className="flex items-end gap-2 p-4">
          {[['month', 'آخر 30 يوم'], ['term', 'الترم الحالي']].map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} className={cx('flex-1 rounded-xl py-2.5 text-sm font-semibold transition', period === v ? 'bg-brand-600 text-white' : 'bg-soft text-muted hover:text-ink')}>{l}</button>
          ))}
        </Card>
      </div>

      <ErrorBox message={error} onRetry={load} />
      {!data && !error ? <Spinner /> : items.length === 0 ? <Empty icon={Trophy} title="لا توجد بيانات كافية للترتيب" text="ستظهر النتائج بعد رصد الدرجات والنقاط" /> : (
        <>
          <Card className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-surface p-6 dark:from-brand-900/40 sm:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #f5c542 0 2px, transparent 3px), radial-gradient(circle at 70% 30%, #6aaef0 0 2px, transparent 3px), radial-gradient(circle at 40% 80%, #f5c542 0 2px, transparent 3px), radial-gradient(circle at 85% 75%, #6aaef0 0 2px, transparent 3px)', backgroundSize: '160px 160px' }} />
            <div className="relative grid grid-cols-3 items-end gap-2 sm:gap-6">
              {podium.map((it, i) => {
                if (!it) return <div key={i} />;
                const medal = MEDAL[i === 1 ? 0 : i === 0 ? 1 : 2];
                return (
                  <motion.div
                    key={it.student_id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.15, duration: 0.5 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div className={cx('relative mb-3 rounded-full bg-gradient-to-br p-1 shadow-lg', medal.ring)}>
                      <Avatar src={it.photo_url} name={it.full_name} size="lg" />
                      <Medal className={cx('absolute -bottom-2 -left-1 h-8 w-8 drop-shadow', medal.text)} />
                    </div>
                    <p className="max-w-full truncate text-sm font-bold sm:text-base">{it.full_name}</p>
                    <p className="text-xs text-muted">المتوسط {it.average ?? '—'}% · سلوك {it.behavior}</p>
                    <div className={cx('mt-3 flex w-full items-center justify-center rounded-t-2xl bg-gradient-to-t text-2xl font-extrabold text-white shadow-inner', medal.ring, medal.h)}>
                      {it.rank}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>

          {rest.length > 0 && (
            <Card className="mt-6 divide-y divide-line p-0">
              {rest.map((it) => (
                <div key={it.student_id} className="flex items-center gap-4 p-4">
                  <span className="w-7 text-center font-bold text-muted">{it.rank}</span>
                  <Avatar src={it.photo_url} name={it.full_name} size="sm" />
                  <span className="flex-1 truncate font-semibold">{it.full_name}</span>
                  <span className="text-sm text-muted">{it.average ?? '—'}% · سلوك {it.behavior}</span>
                </div>
              ))}
            </Card>
          )}
          <p className="mt-4 text-center text-xs text-muted">تُحسب النتيجة من متوسط درجات الاختبارات المرصودة مع نقاط السلوك كمعيار ثاني</p>
        </>
      )}
    </div>
  );
}
