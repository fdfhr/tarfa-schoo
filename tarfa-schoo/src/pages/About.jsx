import { Shield, Code2, GraduationCap, MapPin } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SCHOOL_LOCATION, DEVELOPERS, STAFF } from '../../lib/fixed.js';
import { Card, PageHeader, Logo } from '../components/ui';
import { DEFAULT_SCHOOL } from '../lib/utils';

export default function About() {
  const { settings } = useApp();
  const schoolName = settings.school_name || DEFAULT_SCHOOL;
  const trainers = STAFF;
  const devs = DEVELOPERS;
  return (
    <div>
      <PageHeader title="عن المدرسة والمطورين" />
      <Card className="mb-6 overflow-hidden p-0">
        <div className="relative h-40 sm:h-52">
          <img src="/school.webp" alt="مدرسة طرفا البحرية الثانوية المشتركة" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-900/80 to-transparent" />
        </div>
        <div className="-mt-12 flex flex-col items-center gap-4 px-8 pb-8 text-center sm:flex-row sm:-mt-10 sm:text-right">
          <div className="rounded-full border-4 border-surface bg-surface"><Logo className="h-24 w-24 shrink-0" /></div>
        <div>
          <h2 className="text-xl font-bold">{schoolName}</h2>
          <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted sm:justify-start">
            <MapPin className="h-4 w-4" /> {SCHOOL_LOCATION}
          </p>
        </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h2 className="font-bold">المدربون والمشرفون على النظام</h2>
          </div>
          <ul className="space-y-3">
            {trainers.map((t) => (
              <li key={t.name} className="rounded-xl bg-soft p-4">
                <p className="text-xs text-muted">{t.title}</p>
                <p className="font-bold">{t.name}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <h2 className="font-bold">مطورو الموقع والنظام الإلكتروني</h2>
          </div>
          <ul className="space-y-3">
            {devs.map((d) => (
              <li key={d.name} className="rounded-xl bg-soft p-4 font-bold">{d.name}</li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="mt-6 flex items-start gap-3 p-5 text-sm text-muted">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p>تم تطوير هذا النظام بواسطة {devs.map((d) => d.name).join(' و')} - {schoolName}</p>
      </Card>
    </div>
  );
}
