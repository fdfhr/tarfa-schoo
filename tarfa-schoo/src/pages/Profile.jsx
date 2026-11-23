import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import supabase from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Input, Button, Avatar, Badge } from '../components/ui';
import { ROLE_LABELS } from '../lib/utils';

export default function Profile() {
  const { profile, role, entity, toast } = useApp();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (pw.length < 8) errs.pw = 'كلمة السر يجب ألا تقل عن 8 أحرف';
    if (pw !== pw2) errs.pw2 = 'كلمتا السر غير متطابقتين';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) return toast(error.message, 'error');
    setPw('');
    setPw2('');
    toast('تم تغيير كلمة السر بنجاح');
  };

  const rows = [
    ['الاسم', profile?.full_name],
    ['البريد الإلكتروني', profile?.email],
    ['الهاتف', profile?.phone || entity?.phone],
    ['المادة', entity?.subject],
    ['الصلة', entity?.relation],
    ['الفصل', entity?.class?.name],
  ].filter(([, v]) => v);

  return (
    <div>
      <PageHeader title="حسابي" subtitle="بياناتك وتغيير كلمة السر" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-4">
            <Avatar src={entity?.photo_url} name={profile?.full_name} size="lg" />
            <div>
              <p className="text-lg font-bold">{profile?.full_name}</p>
              <Badge tone="brand" className="mt-1">{ROLE_LABELS[role]}</Badge>
            </div>
          </div>
          <dl className="divide-y divide-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium" dir="auto">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="font-bold">تغيير كلمة السر</h2>
          </div>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Input label="كلمة السر الجديدة" type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} error={errors.pw} className="text-left" />
            <Input label="تأكيد كلمة السر" type="password" dir="ltr" value={pw2} onChange={(e) => setPw2(e.target.value)} error={errors.pw2} className="text-left" />
            <Button type="submit" loading={saving}>حفظ كلمة السر</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
