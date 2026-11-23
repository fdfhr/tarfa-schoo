import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, LogIn } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Button, Input, Logo, ErrorBox, Card, Spinner } from '../components/ui';
import { isValidEmail, DEFAULT_SCHOOL } from '../lib/utils';

const EMPTY = { code: '', full_name: '', phone: '', email: '', password: '', password2: '' };

export default function Setup() {
  const { settings, toast } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const schoolName = settings.school_name || DEFAULT_SCHOOL;

  useEffect(() => {
    api('/api/setup').then((r) => setStatus(r.needed)).catch((e) => setError(e.message));
  }, []);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.code.trim()) errs.code = 'أدخل رمز الإعداد';
    if (!f.full_name.trim()) errs.full_name = 'الاسم الكامل مطلوب';
    if (!f.phone.trim()) errs.phone = 'رقم الهاتف مطلوب';
    if (!isValidEmail(f.email)) errs.email = 'بريد إلكتروني صحيح مطلوب';
    if (f.password.length < 8) errs.password = 'كلمة السر 8 أحرف على الأقل';
    if (f.password !== f.password2) errs.password2 = 'كلمتا السر غير متطابقتين';
    setErrors(errs);
    setError('');
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await api('/api/setup', {
        method: 'POST',
        body: { code: f.code, full_name: f.full_name, phone: f.phone, email: f.email.trim(), password: f.password },
      });
      toast('تم إنشاء حساب المدير بنجاح، سجّل الدخول الآن');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo className="h-16 w-16 shadow-lg shadow-brand-600/20" />
          <h1 className="text-xl font-bold">{schoolName}</h1>
          <p className="text-sm text-muted">إعداد حساب مدير النظام الأول</p>
        </div>

        {status === null && !error ? <Spinner /> : status === false ? (
          <Card className="space-y-4 p-6 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
            <p className="font-semibold">تم إعداد النظام مسبقاً</p>
            <p className="text-sm text-muted">يدخل المدير بحسابه من صفحة تسجيل الدخول، وينشئ بقية الحسابات.</p>
            <Link to="/login"><Button icon={LogIn} className="w-full">الذهاب إلى تسجيل الدخول</Button></Link>
          </Card>
        ) : status ? (
          <Card className="p-6">
            <p className="mb-5 text-sm leading-relaxed text-muted">
              أدخل رمز الإعداد لمرة واحدة الذي زوّدك به مطوّر النظام، ثم أنشئ حساب المدير. يُلغى الرمز بعد الاستخدام.
            </p>
            <form onSubmit={submit} className="space-y-4" noValidate>
              <Input label="رمز الإعداد" dir="ltr" value={f.code} onChange={(e) => set('code', e.target.value)} error={errors.code} autoComplete="off" className="text-left font-mono tracking-widest" />
              <Input label="الاسم الكامل للمدير" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} error={errors.full_name} />
              <Input label="رقم الهاتف" dir="ltr" value={f.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} className="text-left" />
              <Input label="البريد الإلكتروني" dir="ltr" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} error={errors.email} className="text-left" autoComplete="off" />
              <Input label="كلمة السر" dir="ltr" type="password" value={f.password} onChange={(e) => set('password', e.target.value)} error={errors.password} hint="8 أحرف على الأقل" className="text-left" autoComplete="new-password" />
              <Input label="تأكيد كلمة السر" dir="ltr" type="password" value={f.password2} onChange={(e) => set('password2', e.target.value)} error={errors.password2} className="text-left" autoComplete="new-password" />
              <ErrorBox message={error} />
              <Button type="submit" loading={saving} icon={ShieldCheck} className="w-full py-3">إنشاء حساب المدير</Button>
            </form>
          </Card>
        ) : (
          <ErrorBox message={error} />
        )}
      </div>
    </div>
  );
}
