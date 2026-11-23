import { useEffect, useState } from 'react';
import { Save, Bot, GraduationCap, Users, Download, School } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { Card, PageHeader, Button, Input, Textarea, Modal } from '../components/ui';
import { DEFAULT_SCALE, DEFAULT_SCHOOL, exportExcel, cx } from '../lib/utils';

const SCALE_LABELS = [
  ['excellent', 'ممتاز إذا بلغت النسبة %'],
  ['very_good', 'جيد جداً إذا بلغت %'],
  ['good', 'جيد إذا بلغت %'],
  ['acceptable', 'مقبول إذا بلغت %'],
];

export default function Settings() {
  const { settings, refreshSettings, toast } = useApp();
  const [schoolName, setSchoolName] = useState(DEFAULT_SCHOOL);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [ai, setAi] = useState({ enabled: true, message: '', disabled_classes: [] });
  const [classes, setClasses] = useState([]);
  const [busy, setBusy] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setSchoolName(settings.school_name || DEFAULT_SCHOOL);
    setScale({ ...DEFAULT_SCALE, ...(settings.grading_scale || {}) });
    setAi({ enabled: true, message: 'الشات متوقف مؤقتاً بقرار من إدارة المدرسة', disabled_classes: [], ...(settings.ai_config || {}) });
  }, [settings]);

  useEffect(() => {
    api('/api/classes').then(setClasses).catch(() => {});
  }, []);

  const save = async (key, value, label) => {
    setBusy(key);
    try {
      await api('/api/settings', { method: 'PUT', body: { key, value } });
      await refreshSettings();
      toast(`${label} تم حفظه`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const toggleClass = (id) =>
    setAi((a) => ({ ...a, disabled_classes: a.disabled_classes.includes(id) ? a.disabled_classes.filter((x) => x !== id) : [...a.disabled_classes, id] }));

  const exportAll = async () => {
    setExporting(true);
    try {
      const [students, teachers, guardians, exams] = await Promise.all([
        api('/api/students'), api('/api/teachers'), api('/api/guardians'), api('/api/exams'),
      ]);
      exportExcel('الطلاب', ['الاسم', 'الرقم القومي', 'الفصل', 'الهاتف', 'البريد', 'الغياب', 'المتوسط'],
        students.map((s) => [s.full_name, s.national_id, s.class_name, s.phone, s.email, s.stats?.absent ?? 0, s.stats?.avg ?? '']));
      exportExcel('المدرسون', ['الاسم', 'المادة', 'الهاتف', 'البريد', 'الفصول'],
        teachers.teachers.map((t) => [t.full_name, t.subject, t.phone, t.email, t.classes.map((c) => c.name).join(' / ')]));
      exportExcel('أولياء-الأمور', ['الاسم', 'الصلة', 'الهاتف', 'البريد', 'الأبناء'],
        guardians.map((g) => [g.full_name, g.relation, g.phone, g.email, g.students.map((s) => s.full_name).join(' / ')]));
      exportExcel('الاختبارات', ['الاختبار', 'الفصل', 'التاريخ', 'الدرجة النهائية', 'متوسط %'],
        exams.map((e) => [e.title, e.class_name, e.exam_date, e.max_score, e.average ?? '']));
      toast('تم تصدير الملفات (Excel)');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setExporting(false);
    }
  };


  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="متاحة لمدير المدرسة فقط" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2"><School className="h-5 w-5 text-primary" /><h2 className="font-bold">اسم المدرسة</h2></div>
          <Input label="اسم المدرسة الظاهر في الموقع" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          <div className="mt-4 flex justify-end"><Button icon={Save} loading={busy === 'school_name'} onClick={() => save('school_name', schoolName.trim(), 'اسم المدرسة')}>حفظ</Button></div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /><h2 className="font-bold">شات الذكاء الاصطناعي</h2></div>
          <label className="mb-4 flex cursor-pointer items-center justify-between rounded-xl bg-soft p-4">
            <span className="font-semibold">تشغيل الشات للمدرسة كلها</span>
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={ai.enabled} onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} />
          </label>
          <Textarea label="رسالة التعطيل" rows={2} value={ai.message} onChange={(e) => setAi({ ...ai, message: e.target.value })} />
          <div className="mt-4 space-y-2">
            <span className="text-sm font-medium">تعطيل الشات لفصل معين</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {classes.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line p-2.5 text-sm">
                  <input type="checkbox" className="accent-brand-600" checked={ai.disabled_classes.includes(c.id)} onChange={() => toggleClass(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button icon={Save} loading={busy === 'ai_config'} onClick={() => save('ai_config', { ...ai, message: ai.message.trim() || undefined }, 'إعدادات الشات')}>حفظ إعدادات الشات</Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /><h2 className="font-bold">سلم التقديرات</h2></div>
          <div className="space-y-3">
            {SCALE_LABELS.map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{label}</span>
                <input type="number" min="0" max="100" value={scale[k]} onChange={(e) => setScale({ ...scale, [k]: Number(e.target.value) })} className="w-24 rounded-xl border border-line bg-surface px-3 py-2 text-center outline-none focus:border-brand-500" />
              </label>
            ))}
            <p className="text-sm text-muted">ضعيف: أقل من المقبول</p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button icon={Save} loading={busy === 'grading_scale'} onClick={() => save('grading_scale', scale, 'سلم التقديرات')}>حفظ السلم</Button>
          </div>
        </Card>


        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h2 className="font-bold">تصدير البيانات</h2></div>
          <p className="mb-4 text-sm text-muted">يُصدّر الطلاب والمدرسين وأولياء الأمور والاختبارات إلى ملفات Excel (CSV بترميز عربي).</p>
          <Button icon={Download} variant="secondary" loading={exporting} onClick={exportAll}>تصدير البيانات إلى Excel</Button>
        </Card>
      </div>
    </div>
  );
}
