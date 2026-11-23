import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Spinner, ErrorBox, Empty, Avatar } from '../components/ui';
import { fmtDateTime, ROLE_LABELS, cx } from '../lib/utils';

export default function Messages() {
  const { role } = useApp();
  const isStaff = role === 'admin' || role === 'assistant';
  return (
    <div>
      <PageHeader
        title="الرسائل"
        subtitle={isStaff ? 'رسائل الطلاب وأولياء الأمور' : 'تواصل مباشر مع إدارة المدرسة'}
      />
      {isStaff ? <StaffInbox /> : <ChatPane title="إدارة المدرسة" subtitle="ستصلك الردود هنا" mineRole="user" />}
    </div>
  );
}

function StaffInbox() {
  const [threads, setThreads] = useState(null);
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api('/api/messages');
      setThreads(r.threads);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="overflow-hidden p-0 lg:col-span-2">
        <ErrorBox message={error} onRetry={load} />
        {!threads && !error ? (
          <Spinner />
        ) : threads?.length === 0 ? (
          <Empty icon={MessageSquare} title="لا توجد محادثات" text="ستظهر هنا رسائل الطلاب وأولياء الأمور" />
        ) : (
          <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
            {threads?.map((t) => (
              <li key={t.email}>
                <button
                  onClick={() => setActive(t)}
                  className={cx('flex w-full items-center gap-3 p-4 text-right transition hover:bg-soft', active?.email === t.email && 'bg-soft')}
                >
                  <Avatar name={t.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{t.full_name}</p>
                      {t.unread > 0 && <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">{t.unread}</span>}
                    </div>
                    <p className="truncate text-xs text-muted">{ROLE_LABELS[t.role] || ''} · {t.last_body}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="lg:col-span-3">
        {active ? (
          <ChatPane
            key={active.email}
            title={active.full_name}
            subtitle={ROLE_LABELS[active.role] || ''}
            query={{ thread: active.email }}
            extra={{ thread_email: active.email }}
            mineRole="staff"
            onSent={load}
          />
        ) : (
          <Card className="flex h-[70vh] items-center justify-center p-6">
            <Empty icon={MessageSquare} title="اختر محادثة للبدء" />
          </Card>
        )}
      </div>
    </div>
  );
}

function ChatPane({ title, subtitle, query, extra = {}, mineRole, onSent }) {
  const { toast } = useApp();
  const [msgs, setMsgs] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const queryKey = JSON.stringify(query || {});

  const load = useCallback(async () => {
    try {
      const r = await api('/api/messages', { query });
      setMsgs(r.messages);
      setError('');
    } catch (e) {
      setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      await api('/api/messages', { method: 'POST', body: { body, ...extra } });
      setText('');
      load();
      onSent?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="flex h-[70vh] min-h-[420px] flex-col overflow-hidden p-0">
      <div className="border-b border-line bg-brand-600 px-5 py-4 text-white">
        <p className="font-bold">{title}</p>
        {subtitle && <p className="text-xs text-white/80">{subtitle}</p>}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-page/40 p-4">
        <ErrorBox message={error} onRetry={load} />
        {!msgs && !error ? (
          <Spinner />
        ) : msgs?.length === 0 ? (
          <Empty icon={MessageSquare} title="لا توجد رسائل بعد" text="ابدأ المحادثة بكتابة رسالة" />
        ) : (
          msgs?.map((m) => <Bubble key={m.id} m={m} mine={m.sender_role === mineRole} />)
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="اكتب رسالتك..."
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-brand-500"
        />
        <Button type="submit" loading={sending} disabled={!text.trim()} icon={Send}>إرسال</Button>
      </form>
    </Card>
  );
}

function Bubble({ m, mine }) {
  return (
    <div className={cx('flex', mine ? 'justify-start' : 'justify-end')}>
      <div
        className={cx(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
          mine ? 'rounded-tr-sm bg-brand-600 text-white' : 'rounded-tl-sm bg-surface text-ink ring-1 ring-line',
        )}
      >
        <p className="whitespace-pre-line break-words">{m.body}</p>
        <p className={cx('mt-1 text-[10px]', mine ? 'text-white/70' : 'text-muted')}>{fmtDateTime(m.created_at)}</p>
      </div>
    </div>
  );
}
