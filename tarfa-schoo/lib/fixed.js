// Fixed school and credits information. These values are part of the application code:
// they are not stored in the database, cannot be changed from the settings page,
// and the settings API rejects any attempt to write them.
export const SCHOOL_LOCATION = 'طرفا الثانوية · مركز سمالوط · المنيا';

export const DEVELOPERS = [
  { name: 'يوسف ماجد عواد' },
  { name: 'ريان جمعة رمضان' },
];

export const STAFF = [
  { title: 'مدير المدرسة', name: 'أ. ضاحي خيري رجب' },
  { title: 'وكيل المدرسة', name: 'أ. شريف أبو ليل محمد' },
  { title: 'المشرف العام', name: 'أ. ناجي عبد الجواد محمد' },
];

export const DEVELOPER_NAMES = DEVELOPERS.map((d) => d.name);
