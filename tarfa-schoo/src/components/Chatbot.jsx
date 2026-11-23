import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui';
import { cx } from '../lib/utils';

const QUICK = ['درجاتي', 'غيابي', 'جدول اليوم', 'ترتيبي', 'مواعيد الاختبارات'];
const WELCOME = 'أهلاً بك! أنا المساعد الآلي للمدرسة. اسألني عن درجاتك أو غيابك أو جدولك أو ترتيبك.';

export default function Chatbot() {
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: 'bot', text: WELCOME }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [offReason, setOffReason] = useState(null);
  const endRef = useRef(null);

  const aiOn = settings.ai_config?.enabled !== false;
  const offMsg = settings.ai_config?.message || 'الشات متوقف مؤقتاً بقرار من إدارة المدرسة';

  useEffect(() => {
    if (!open) return;
    api('/api/chat').then((rows) => {
      if (rows.length) {
        const hist = rows.flatMap((r) => [{ from: 'me', text: r.message }, { from: 'bot', text: r.reply }]);
        setMessages([{ from: 'bot', text: WELCOME }, ...hist]);
      }
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (msg) => {
    const message = (msg ?? text).trim();
    if (!message || busy) return;
    setText('');
    setMessages((m) => [...m, { from: 'me', text: message }]);
    setBusy(true);
    try {
      const r = await api('/api/chat', { method: 'POST', body: { message } });
      setMessages((m) => [...m, { from: 'bot', text: r.reply, escalated: r.escalated }]);
      if (r.disabled) setOffReason(r.reply);
    } catch (e) {
      setMessages((m) => [...m, { from: 'bot', text: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const disabled = !aiOn || !!offReason;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 transition hover:scale-105"
        aria-label="فتح المساعد الذكي"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
      {open && (
        <div className="fixed bottom-24 left-3 right-3 z-40 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl animate-fade-up sm:left-5 sm:right-auto sm:w-96">
          <div className="flex items-center gap-3 border-b border-line bg-brand-600 px-4 py-3 text-white">
            <Bot className="h-6 w-6" />
            <div>
              <p className="font-bold">المساعد الذكي للمدرسة</p>
              <p className="text-xs text-white/80">يرد فوراً · متاح 24 ساعة</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!aiOn && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{offMsg}</p>}
            {messages.map((m, i) => (
              <div key={i} className={cx('flex', m.from === 'me' ? 'justify-start' : 'justify-end')}>
                <div
                  className={cx(
                    'max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    m.from === 'me' ? 'rounded-tr-sm bg-brand-600 text-white' : 'rounded-tl-sm bg-soft text-ink',
                    m.error && 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-muted">جاري الرد...</p>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-line p-3">
            <div className="mb-2 flex gap-2 overflow-x-auto">
              {QUICK.map((q) => (
                <button key={q} disabled={disabled} onClick={() => send(q)} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:bg-soft disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={disabled}
                placeholder={disabled ? 'الشات متوقف' : 'اكتب سؤالك...'}
                maxLength={500}
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 disabled:opacity-60"
              />
              <Button type="submit" disabled={disabled || !text.trim()} loading={busy} className="px-3" aria-label="إرسال">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
