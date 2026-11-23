import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Send, Phone, CalendarDays, IdCard, Mail, Users, Trophy, ExternalLink, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { Card, PageHeader, Button, Avatar, Badge } from '../components/ui';
import { fmtDate, gradeClass, STATUS_LABEL, cx } from '../lib/utils';

export default function AdminAssistant() {
  const [messages, setMessages] = useState([
    { from: 'bot', type: 'text', message: 'أهلاً بك يا أستاذ. اكتب اسم الطالب وسأعرض لك بياناته ودرجاته وكل ما هو متاح عنه.' },
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const ask = async (body, label) => {
    setMessages((m) => [...m, { from: 'me', type: 'text', message: label }]);
    setBusy(true);
    try {
      const r = await api('/api/admin-assistant', { method: 'POST', body });
      setMessages((m) => [...m, { from: 'bot', ...r }]);
    } catch (e) {
      setMessages((m) => [...m, { from: 'bot', type: 'text', message: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const send = (e) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setText('');
    ask({ query: q }, q);
  };

  return (
    <div>
      <PageHeader title="المساعد الذكي للمدير" subtitle="ابحث عن أي طالب واعرض بياناته ودرجاته وسجلاته" />
      <Card className="flex h-[72vh] min-h-[460px] flex-col overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-line bg-brand-600 px-5 py-4 text-white">
          <Bot className="h-6 w-6" />
          <div>
            <p className="font-bold">مساعد الإدارة</p>
            <p className="text-xs text-white/80">يبحث في بيانات الطلاب مباشرة</p>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-page/40 p-4">
          {messages.map((m, i) => (
            <Message key={i} m={m} onPick={(c) => ask({ student_id: c.id }, c.full_name)} />
          ))}
          {busy && <p className="text-xs text-muted">جارِ البحث...</p>}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={100}
            placeholder="اكتب اسم الطالب..."
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-brand-500"
          />
          <Button type="submit" loading={busy} disabled={!text.trim()} icon={Send}>بحث</Button>
        </form>
      </Card>
    </div>
  );
}

function Message({ m, onPick }) {
  if (m.from === 'me') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3.5 py-2.5 text-sm text-white">{m.message}</div>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <div className={cx('w-full', m.type === 'profile' ? 'max-w-[100%]' : 'max-w-[85%]')}>
        {m.message && m.type !== 'profile' && (
          <div className={cx('rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed', m.error ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-surface text-ink ring-1 ring-line')}>
            {m.message}
          </div>
        )}
        {m.type === 'candidates' && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {m.items.map((c) => (
              <button key={c.id} onClick={() => onPick(c)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-right transition hover:border-brand-400 hover:bg-soft">
                <UserRound className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.full_name}</p>
                  <p className="truncate text-xs text-muted">{c.class_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {m.type === 'profile' && <ProfileCard p={m.profile} intro={m.message} />}
      </div>
    </div>
  );
}

function ProfileCard({ p, intro }) {
  const st = p.stats || {};
  const total = (st.present || 0) + (st.absent || 0) + (st.late || 0);
  const rate = total ? Math.round((((st.present || 0) + (st.late || 0)) / total) * 100) : null;
  const info = [
    { icon: IdCard, label: 'الرقم القومي', value: p.national_id, ltr: true },
    { icon: Phone, label: 'الهاتف', value: p.phone, ltr: true },
    { icon: CalendarDays, label: 'تاريخ الميلاد', value: p.birth_date ? fmtDate(p.birth_date) : '' },
    { icon: Mail, label: 'البريد', value: p.email, ltr: true },
    { icon: Users, label: 'الفصل', value: p.class_name },
  ].filter((x) => x.value);
  const stats = [
    ['متوسط الدرجات', st.avg == null ? '—' : `${st.avg}%`],
    ['نسبة الحضور', rate === null ? '—' : `${rate}%`],
    ['أيام الغياب', st.absent || 0],
    ['أيام التأخر', st.late || 0],
    ['نقاط السلوك', st.behavior || 0],
    ['الترتيب', p.rank ? `${p.rank} / ${p.class_size}` : '—'],
  ];

  return (
    <Card className="space-y-5 p-4 sm:p-5">
      <p className="text-sm font-semibold text-muted">{intro}</p>
      <div className="flex items-center gap-3">
        <Avatar src={p.photo_url} name={p.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{p.full_name}</p>
          <p className="text-xs text-muted">{p.class_name}{p.subject ? ` · ${p.subject}` : ''}</p>
        </div>
        <Link to={`/students/${p.id}`} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
          الملف الكامل <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {info.map((x) => (
          <div key={x.label} className="flex items-center gap-2 rounded-xl bg-soft p-2.5">
            <x.icon className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted">{x.label}</p>
              <p className="truncate text-sm font-semibold" dir={x.ltr ? 'ltr' : 'rtl'}>{x.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line p-2.5 text-center">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="mt-1 text-base font-bold">{value}</p>
          </div>
        ))}
      </div>

      <Section title="أولياء الأمور">
        {p.guardians.length ? (
          <div className="flex flex-wrap gap-2">
            {p.guardians.map((g, i) => (
              <Badge key={i} tone="brand">{g.full_name} · {g.relation} · <span dir="ltr">{g.phone}</span></Badge>
            ))}
          </div>
        ) : <p className="text-sm text-muted">لا يوجد ولي أمر مرتبط</p>}
      </Section>

      <Section title="الدرجات">
        {p.scores.length ? (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-soft text-xs text-muted">
                <tr><th className="p-2.5 text-right">الاختبار</th><th className="p-2.5 text-right">التاريخ</th><th className="p-2.5 text-right">الدرجة</th><th className="p-2.5 text-right">النسبة</th><th className="p-2.5 text-right">التقدير</th></tr>
              </thead>
              <tbody>
                {p.scores.map((s, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="p-2.5 font-medium">{s.title}</td>
                    <td className="p-2.5 text-muted">{fmtDate(s.exam_date)}</td>
                    <td className="p-2.5">{s.score} / {s.max_score}</td>
                    <td className="p-2.5">{s.pct}%</td>
                    <td className="p-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeClass(s.label)}`}>{s.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">لا توجد درجات مسجلة</p>}
      </Section>

      <Section title="آخر أيام الحضور">
        {p.attendance.length ? (
          <div className="flex flex-wrap gap-2">
            {p.attendance.slice(0, 10).map((a, i) => (
              <Badge key={i} tone={a.status === 'absent' ? 'danger' : a.status === 'late' ? 'warning' : 'success'}>
                {fmtDate(a.date)} · {STATUS_LABEL[a.status]}
              </Badge>
            ))}
          </div>
        ) : <p className="text-sm text-muted">لا توجد سجلات حضور</p>}
      </Section>

      <Section title="السلوك الأخير">
        {p.behavior.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {p.behavior.slice(0, 5).map((b, i) => (
              <li key={i} className="flex items-center justify-between gap-3 p-2.5 text-sm">
                <span className="truncate">{b.reason || 'بدون سبب محدد'}</span>
                <span className={`font-bold ${b.points > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{b.points > 0 ? `+${b.points}` : b.points}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">لا توجد نقاط سلوك</p>}
      </Section>

      {p.upcoming.length > 0 && (
        <Section title="اختبارات قادمة للفصل">
          <div className="flex flex-wrap gap-2">
            {p.upcoming.map((e, i) => <Badge key={i} tone="brand"><Trophy className="h-3 w-3" />{e.title} · {fmtDate(e.exam_date)}</Badge>)}
          </div>
        </Section>
      )}

      {p.teacher_notes && (
        <Section title="ملاحظات المدرس">
          <p className="whitespace-pre-line rounded-xl bg-soft p-3 text-sm">{p.teacher_notes}</p>
        </Section>
      )}
    </Card>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-primary">{title}</h3>
      {children}
    </div>
  );
}
