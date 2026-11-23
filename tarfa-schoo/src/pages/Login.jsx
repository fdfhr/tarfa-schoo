import { useState } from 'react';
import { api } from '../lib/api';
import { Mail, LogIn, Eye, EyeOff, BookOpen, Backpack, Users, ShieldCheck } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Button, Input, Logo, ErrorBox } from '../components/ui';
import { DEFAULT_SCHOOL, isValidEmail } from '../lib/utils';
import { DEVELOPER_NAMES } from '../../lib/fixed.js';

function SchoolPhoto() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-full min-h-[220px] w-full items-center justify-center bg-soft text-sm text-muted">
        صورة المدرسة غير متاحة
      </div>
    );
  }
  return (
    <img
      src="/school.webp"
      alt="مدرسة طرفا البحرية الثانوية المشتركة"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-700 ease-out hover:scale-105"
    />
  );
}

export default function Login() {
  const { signIn, signOut, settings } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [accountType, setAccountType] = useState('');

  // Each account type maps to the roles allowed to enter through it.
  const ACCOUNT_TYPES = [
    { value: 'teacher', label: 'معلم', icon: BookOpen, roles: ['teacher'] },
    { value: 'student', label: 'طالب', icon: Backpack, roles: ['student'] },
    { value: 'guardian', label: 'ولي أمر', icon: Users, roles: ['guardian'] },
    { value: 'admin', label: 'مدير', icon: ShieldCheck, roles: ['admin', 'assistant'] },
  ];
  const [loading, setLoading] = useState(false);
  const schoolName = settings.school_name || DEFAULT_SCHOOL;
  const devs = DEVELOPER_NAMES;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!accountType) errs.accountType = 'اختر نوع الحساب';
    if (!isValidEmail(email)) errs.email = 'أدخل بريداً إلكترونياً صحيحاً';
    if (!password) errs.password = 'أدخل كلمة السر';
    setErrors(errs);
    setError('');
    if (Object.keys(errs).length) return;
    setLoading(true);
    const { error: err } = await signIn(email.trim(), password);
    if (err) {
      setLoading(false);
      const msg = err.message || '';
      setError(
        msg === 'Invalid login credentials' ? 'البريد أو كلمة السر غير صحيحة'
          : /not confirmed/i.test(msg) ? 'الحساب لم يُفعَّل بعد، تواصل مع إدارة المدرسة'
          : /fetch|network|Failed/i.test(msg) ? 'تعذر الاتصال بالخادم، تحقق من الإنترنت وحاول مرة أخرى'
          : 'تعذر تسجيل الدخول، حاول مرة أخرى'
      );
      return;
    }
    // Only accounts registered in the system (admin, assistant, teacher, student, guardian) may enter.
    try {
      const me = await api('/api/me');
      if (!me?.profile) throw new Error('هذا الحساب غير مسجل في النظام');
      const chosen = ACCOUNT_TYPES.find((t) => t.value === accountType);
      if (!chosen.roles.includes(me.profile.role)) {
        throw new Error('هذا الحساب لا يطابق نوع الحساب الذي اخترته');
      }
    } catch (e) {
      await signOut();
      setLoading(false);
      setError(e.message || 'تعذر التحقق من الحساب');
    }
  };

  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2 lg:gap-12">
        <div className="animate-fade-up space-y-6">
          <div className="flex items-center gap-4">
            <Logo className="h-16 w-16 shadow-lg shadow-brand-600/20" />
            <div>
              <h1 className="text-xl font-bold leading-snug sm:text-2xl">{schoolName}</h1>
              <p className="text-sm text-muted">نظام إدارة الفصول والطلاب</p>
            </div>
          </div>
          <div className="group relative aspect-[5/4] w-full overflow-hidden rounded-[2rem] bg-brand-900 p-1.5 shadow-2xl shadow-brand-900/25 ring-1 ring-brand-200/60 dark:ring-brand-800/60 sm:aspect-[4/3]">
            <div className="relative h-full w-full overflow-hidden rounded-[1.6rem]">
              <SchoolPhoto />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-900/90 via-brand-900/25 to-transparent" />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-brand-700 shadow">نظام إدارة مدرسي رسمي</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                <div className="mb-2 h-0.5 w-12 rounded-full bg-amber-300" />
                <p className="text-base font-bold leading-snug sm:text-lg">مدرسة طرفا البحرية الثانوية المشتركة</p>
                <p className="mt-1 text-xs text-white/80">مركز سمالوط · المنيا</p>
              </div>
            </div>
          </div>
        </div>

        <div className="animate-fade-up space-y-5" style={{ animationDelay: '0.1s' }}>
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-primary">تسجيل الدخول</h2>
            <p className="mb-6 mt-1 text-sm text-muted">استخدم البريد الإلكتروني وكلمة السر الخاصة بك</p>
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <span className="text-sm font-medium">نوع الحساب</span>
                <div className="grid grid-cols-4 gap-2">
                  {ACCOUNT_TYPES.map((t) => {
                    const active = accountType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => { setAccountType(t.value); setErrors((x) => ({ ...x, accountType: undefined })); setError(''); }}
                        aria-pressed={active}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-xs font-semibold transition sm:text-sm ${
                          active
                            ? 'border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-600/25'
                            : 'border-line bg-surface text-muted hover:border-brand-300 hover:text-ink'
                        }`}
                      >
                        <t.icon className="h-5 w-5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {errors.accountType && <span className="block text-xs text-red-600 dark:text-red-400">{errors.accountType}</span>}
              </div>
              <div className="relative">
                <Input
                  label="البريد الإلكتروني"
                  type="email"
                  dir="ltr"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                  autoComplete="email"
                  className="pl-10 text-left"
                />
                <Mail className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-muted" />
              </div>
              <div className="relative">
                <Input
                  label="كلمة السر"
                  type={show ? 'text' : 'password'}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  autoComplete="current-password"
                  className="pl-10 text-left"
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute bottom-3 left-3 text-muted hover:text-ink" aria-label="إظهار كلمة السر">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <ErrorBox message={error} />
              <Button type="submit" loading={loading} icon={LogIn} className="w-full py-3">
                دخول
              </Button>
            </form>
          </div>

        </div>
      </div>
      <p className="pb-6 text-center text-xs text-muted">
        تم تطوير هذا النظام بواسطة {devs.length ? devs.join(' و') : 'فريق التطوير'} - {schoolName}
      </p>
    </div>
  );
}
