import { useEffect, useState } from 'react';
import { api, uploadFile } from '../lib/api';
import { Input, Select, Button, Modal, Avatar } from './ui';
import { isValidNationalId, isValidEmail } from '../lib/utils';
import { useApp } from '../contexts/AppContext';
import { toUploadableJpeg } from '../lib/imageConvert';

const EMPTY = {
  full_name: '', national_id: '', phone: '', birth_date: '', class_id: '', guardian_ids: [],
  email: '', password: '', photo_url: '',
};

export default function StudentForm({ open, student, classes, onClose, onSaved }) {
  const { toast } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [guardians, setGuardians] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const isEdit = !!student;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(student ? {
      full_name: student.full_name || '',
      national_id: student.national_id || '',
      phone: student.phone || '',
      birth_date: student.birth_date || '',
      class_id: String(student.class_id || ''),
      guardian_ids: (student.guardians || []).map((g) => g.id),
      email: student.email || '',
      password: '',
      photo_url: student.photo_url || '',
    } : { ...EMPTY, class_id: classes[0] ? String(classes[0].id) : '' });
    api('/api/guardians').then(setGuardians).catch(() => setGuardians([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'الاسم الكامل مطلوب';
    if (!isValidNationalId(form.national_id)) e.national_id = 'الرقم القومي يتكون من 14 رقماً';
    if (!form.class_id) e.class_id = 'اختر الفصل';
    if (!isValidEmail(form.email)) e.email = 'بريد إلكتروني صحيح مطلوب لحساب الدخول';
    if (!isEdit && form.password.length < 8) e.password = 'كلمة السر 8 أحرف على الأقل';
    if (isEdit && form.password && form.password.length < 8) e.password = 'كلمة السر 8 أحرف على الأقل';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onPhoto = async (file) => {
    if (!file) return;
    setPhotoError('');
    setUploading(true);
    try {
      const jpg = await toUploadableJpeg(file);
      set('photo_url', await uploadFile(jpg, 'avatars'));
    } catch (e) {
      const msg = e.message || 'تعذر رفع الصورة، حاول مرة أخرى';
      setPhotoError(msg);
      toast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    const body = {
      ...form,
      class_id: Number(form.class_id),
      guardian_ids: form.guardian_ids.map(Number),
      birth_date: form.birth_date || null,
      password: form.password || undefined,
    };
    try {
      if (isEdit) await api('/api/students', { method: 'PUT', body: { ...body, id: student.id } });
      else await api('/api/students', { method: 'POST', body });
      toast(isEdit ? 'تم حفظ بيانات الطالب' : 'تمت إضافة الطالب وحسابه');
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      wide
      title={isEdit ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>إلغاء</Button>
        <Button loading={saving} onClick={submit}>{isEdit ? 'حفظ التعديل' : 'إضافة الطالب'}</Button>
      </>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 sm:col-span-2">
          <Avatar src={form.photo_url} name={form.full_name} size="lg" />
          <label className="cursor-pointer rounded-xl border border-dashed border-line px-4 py-2.5 text-sm font-semibold text-primary hover:bg-soft">
            {uploading ? 'جاري الرفع...' : 'اختيار صورة شخصية (اختياري)'}
            <input type="file" accept="image/*,.heic,.heif,.bmp,.tif,.tiff,.avif" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {photoError && <p className="w-full text-xs text-red-600 dark:text-red-400">{photoError}</p>}
          {!photoError && <p className="w-full text-xs text-muted">الصيغ المقبولة: JPG، PNG، WebP، GIF، BMP، HEIC، AVIF، وتُحوَّل تلقائياً إلى JPG</p>}
        </div>
        <div className="sm:col-span-2">
          <Input label="الاسم الكامل" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} error={errors.full_name} />
        </div>
        <Input label="الرقم القومي (14 رقماً)" dir="ltr" inputMode="numeric" maxLength={14} value={form.national_id} onChange={(e) => set('national_id', e.target.value.replace(/\D/g, ''))} error={errors.national_id} className="text-left" />
        <Input label="الهاتف" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="text-left" />
        <Input label="تاريخ الميلاد" type="date" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
        <Select label="الفصل" value={form.class_id} onChange={(e) => set('class_id', e.target.value)} error={errors.class_id}>
          <option value="">اختر الفصل</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">أولياء الأمور المرتبطون</span>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-line bg-surface p-2">
            {guardians.length === 0 && <p className="p-2 text-xs text-muted">لا يوجد أولياء أمور بعد</p>}
            {guardians.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-soft">
                <input
                  type="checkbox"
                  checked={form.guardian_ids.includes(g.id)}
                  onChange={(e) => set('guardian_ids', e.target.checked ? [...form.guardian_ids, g.id] : form.guardian_ids.filter((x) => x !== g.id))}
                  className="accent-brand-600"
                />
                {g.full_name} <span className="text-xs text-muted">({g.relation})</span>
              </label>
            ))}
          </div>
        </div>
        <Input label="البريد الإلكتروني للحساب" dir="ltr" type="email" value={form.email} onChange={(e) => set('email', e.target.value.trim())} error={errors.email} className="text-left" />
        <Input
          label={isEdit ? 'كلمة سر جديدة (اختياري)' : 'كلمة السر'}
          dir="ltr"
          type="text"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          error={errors.password}
          hint={isEdit ? 'اتركها فارغة لعدم التغيير' : undefined}
          className="text-left"
        />
      </div>
    </Modal>
  );
}
