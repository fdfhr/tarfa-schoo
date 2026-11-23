export const ROLE_LABELS = {
  admin: 'مدير المدرسة',
  assistant: 'مساعد المدير (وكيل المدرسة)',
  teacher: 'مدرس',
  student: 'طالب',
  guardian: 'ولي أمر',
};

export const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export const STATUS_LABEL = { present: 'حاضر', absent: 'غائب', late: 'متأخر' };

export const DEFAULT_SCALE = { excellent: 90, very_good: 80, good: 70, acceptable: 60 };

export const DEFAULT_SCHOOL = 'مدرسة طرفا الثانوية المشتركة';

export function gradeLabel(p, scale = DEFAULT_SCALE) {
  if (p === null || p === undefined || Number.isNaN(p)) return null;
  if (p >= scale.excellent) return 'ممتاز';
  if (p >= scale.very_good) return 'جيد جداً';
  if (p >= scale.good) return 'جيد';
  if (p >= scale.acceptable) return 'مقبول';
  return 'ضعيف';
}

export function gradeClass(label) {
  if (label === 'ضعيف') return 'bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30';
  if (label === 'ممتاز') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30';
  if (label === 'جيد جداً') return 'bg-brand-500/15 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500/30';
  if (label === 'جيد') return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/30';
  return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30';
}

export function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}

export function fmtDate(str) {
  if (!str) return '-';
  const d = new Date(str.length <= 10 ? str + 'T12:00:00' : str);
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Cairo' });
}

export function fmtDateTime(str) {
  if (!str) return '-';
  return new Date(str).toLocaleString('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
  });
}

export function isValidNationalId(v) {
  return /^\d{14}$/.test(String(v || '').trim());
}

export function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function downloadFile(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Excel-compatible CSV (UTF-8 BOM so Arabic displays correctly).
export function exportExcel(filename, headers, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  downloadFile(filename.endsWith('.csv') ? filename : `${filename}.csv`, '\uFEFF' + csv);
}

// Opens a print-ready page; the browser's "Save as PDF" produces the PDF file.
export function exportPdf(title, headers, rows, meta = '') {
  const w = window.open('', '_blank');
  if (!w) return false;
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;padding:24px;color:#12263f}
h1{color:#1f5fa8;font-size:22px;margin:0 0 4px}.meta{color:#5a6f88;font-size:13px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #d9e4f1;padding:7px 9px;text-align:right}
th{background:#e7f0fa}@media print{button{display:none}}</style></head><body>
<h1>${esc(title)}</h1><div class="meta">${esc(meta)}</div>
<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
  return true;
}

export function whatsappLink(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// Printable results sheet for one student: grades, attendance and behavior summary.
// Opens a print-ready page; the browser's "Save as PDF" produces the file.
export function printStudentResults(d, schoolName = DEFAULT_SCHOOL) {
  const w = window.open('', '_blank');
  if (!w) return false;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const st = d.stats || {};
  const total = (st.present || 0) + (st.absent || 0) + (st.late || 0);
  const rate = total ? Math.round((((st.present || 0) + (st.late || 0)) / total) * 100) : null;
  const scores = d.scores || [];
  const gradeRows = scores.map((s) => `<tr><td>${esc(s.title)}</td><td>${esc(s.subject || '-')}</td><td>${esc(fmtDate(s.exam_date))}</td><td>${esc(s.score)} / ${esc(s.max_score)}</td><td>${esc(s.pct)}%</td><td class="${s.label === 'ضعيف' ? 'weak' : ''}">${esc(s.label)}</td></tr>`).join('');
  const attRows = (d.attendance || []).map((a) => `<tr><td>${esc(fmtDate(a.date))}</td><td>${esc(STATUS_LABEL[a.status] || a.status)}</td></tr>`).join('');
  const avg = st.avg == null ? '-' : `${st.avg}%`;
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>نتيجة ${esc(d.full_name)}</title>
<style>
body{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;padding:28px;color:#12263f;font-size:13px}
.head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1f5fa8;padding-bottom:12px;margin-bottom:18px}
.head h1{color:#1f5fa8;font-size:20px;margin:0 0 4px}.head p{margin:0;color:#5a6f88}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.stat{border:1px solid #d9e4f1;border-radius:10px;padding:10px;text-align:center}
.stat b{display:block;font-size:17px;color:#1f5fa8;margin-top:4px}
h2{font-size:15px;color:#184b87;margin:18px 0 8px}
table{width:100%;border-collapse:collapse;font-size:12.5px}th,td{border:1px solid #d9e4f1;padding:7px 9px;text-align:right}
th{background:#e7f0fa}.weak{color:#b91c1c;font-weight:700}
.foot{margin-top:28px;color:#5a6f88;font-size:11px;text-align:center}
@media print{button{display:none}}
</style></head><body>
<div class="head"><div><h1>${esc(schoolName)}</h1><p>كشف نتيجة الطالب</p></div><div style="text-align:left"><p>${esc(new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' }))}</p></div></div>
<p><b>اسم الطالب:</b> ${esc(d.full_name)} &nbsp; <b>الفصل:</b> ${esc(d.class_name || d.class?.name || '-')}</p>
<div class="stats">
<div class="stat">متوسط الدرجات<b>${esc(avg)}</b></div>
<div class="stat">نسبة الحضور<b>${rate === null ? '-' : esc(rate + '%')}</b></div>
<div class="stat">أيام الغياب<b>${esc(st.absent || 0)}</b></div>
<div class="stat">الترتيب في الفصل<b>${d.rank ? esc(d.rank + ' / ' + d.class_size) : '-'}</b></div>
</div>
<h2>الدرجات</h2>
${scores.length ? `<table><thead><tr><th>الاختبار</th><th>المادة</th><th>التاريخ</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th></tr></thead><tbody>${gradeRows}</tbody></table>` : '<p>لا توجد درجات مسجلة</p>'}
<h2>سجل الحضور</h2>
${attRows ? `<table><thead><tr><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>${attRows}</tbody></table>` : '<p>لا توجد سجلات حضور</p>'}
<h2>نقاط السلوك</h2><p>المجموع: <b>${esc(st.behavior || 0)}</b> نقطة</p>
<div class="foot">تم إنشاء هذا الكشف من نظام ${esc(schoolName)}</div>
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
  return true;
}

// Comprehensive printable file for one student: personal data, guardians, teacher notes,
// grades, full attendance and behavior logs. Admin only (the caller enforces the role).
export function printFullStudentReport(d, schoolName = DEFAULT_SCHOOL) {
  const w = window.open('', '_blank');
  if (!w) return false;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const st = d.stats || {};
  const total = (st.present || 0) + (st.absent || 0) + (st.late || 0);
  const rate = total ? Math.round((((st.present || 0) + (st.late || 0)) / total) * 100) : null;
  const scores = d.scores || [];
  const att = d.attendance || [];
  const beh = d.behavior || [];
  const guardians = d.guardians || [];
  const info = [
    ['الاسم الكامل', d.full_name],
    ['الرقم القومي', d.national_id],
    ['تاريخ الميلاد', d.birth_date ? fmtDate(d.birth_date) : '-'],
    ['الفصل', d.class_name || d.class?.name],
    ['الهاتف', d.phone],
    ['البريد الإلكتروني', d.email],
    ['ترتيب الطالب في الفصل', d.rank ? `${d.rank} من ${d.class_size}` : '-'],
  ];
  const infoRows = info.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v || '-')}</td></tr>`).join('');
  const guardRows = guardians.length
    ? guardians.map((g) => `<tr><td>${esc(g.full_name)}</td><td>${esc(g.relation)}</td><td dir="ltr">${esc(g.phone)}</td></tr>`).join('')
    : '<tr><td colspan="3">لا يوجد ولي أمر مرتبط</td></tr>';
  const gradeRows = scores.length
    ? scores.map((s) => `<tr><td>${esc(s.title)}</td><td>${esc(s.subject || '-')}</td><td>${esc(fmtDate(s.exam_date))}</td><td>${esc(s.score)} / ${esc(s.max_score)}</td><td>${esc(s.pct)}%</td><td class="${s.label === 'ضعيف' ? 'weak' : ''}">${esc(s.label)}</td></tr>`).join('')
    : '<tr><td colspan="6">لا توجد درجات مسجلة</td></tr>';
  const attRows = att.length
    ? att.map((a) => `<tr><td>${esc(fmtDate(a.date))}</td><td class="${a.status === 'absent' ? 'weak' : ''}">${esc(STATUS_LABEL[a.status] || a.status)}</td></tr>`).join('')
    : '<tr><td colspan="2">لا توجد سجلات حضور</td></tr>';
  const behRows = beh.length
    ? beh.map((b) => `<tr><td>${esc(fmtDate(b.created_at))}</td><td>${esc(b.reason || '-')}</td><td class="${b.points < 0 ? 'weak' : ''}">${b.points > 0 ? '+' : ''}${esc(b.points)}</td></tr>`).join('')
    : '<tr><td colspan="3">لا توجد سجلات سلوك</td></tr>';
  const now = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير شامل - ${esc(d.full_name)}</title>
<style>
body{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;padding:28px;color:#12263f;font-size:12.5px}
.head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1f5fa8;padding-bottom:12px;margin-bottom:16px}
.head h1{color:#1f5fa8;font-size:20px;margin:0 0 4px}.head p{margin:0;color:#5a6f88}
.title{font-size:16px;font-weight:700;color:#184b87;margin:0 0 12px}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}
.stat{border:1px solid #d9e4f1;border-radius:10px;padding:8px;text-align:center;font-size:11px;color:#5a6f88}
.stat b{display:block;font-size:16px;color:#1f5fa8;margin-top:3px}
h2{font-size:14px;color:#184b87;margin:18px 0 8px;border-bottom:1px solid #d9e4f1;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px}
th,td{border:1px solid #d9e4f1;padding:6px 8px;text-align:right;vertical-align:top}
th{background:#e7f0fa;font-weight:600}
.kv th{width:32%}
.weak{color:#b91c1c;font-weight:700}
.notes{border:1px solid #d9e4f1;border-radius:10px;padding:10px;background:#f7faff;min-height:36px;white-space:pre-line}
.foot{margin-top:24px;color:#5a6f88;font-size:10.5px;text-align:center}
.pb{page-break-before:always}
@media print{button{display:none}}
</style></head><body>
<div class="head"><div><h1>${esc(schoolName)}</h1><p>التقرير الشامل للطالب</p></div><div style="text-align:left"><p>تاريخ الإصدار: ${esc(now)}</p></div></div>
<p class="title">أولاً: البيانات الشخصية</p>
<table class="kv"><tbody>${infoRows}</tbody></table>
<div class="stats">
<div class="stat">متوسط الدرجات<b>${esc(st.avg == null ? '-' : st.avg + '%')}</b></div>
<div class="stat">نسبة الحضور<b>${esc(rate === null ? '-' : rate + '%')}</b></div>
<div class="stat">أيام الغياب<b>${esc(st.absent || 0)}</b></div>
<div class="stat">أيام التأخر<b>${esc(st.late || 0)}</b></div>
<div class="stat">نقاط السلوك<b>${esc(st.behavior || 0)}</b></div>
</div>
<h2>ثانياً: أولياء الأمور</h2>
<table><thead><tr><th>الاسم</th><th>صلة القرابة</th><th>الهاتف</th></tr></thead><tbody>${guardRows}</tbody></table>
<h2>ثالثاً: ملاحظات المدرس</h2>
<div class="notes">${esc(d.teacher_notes || 'لا توجد ملاحظات')}</div>
<h2>رابعاً: الدرجات والتقديرات</h2>
<table><thead><tr><th>الاختبار</th><th>المادة</th><th>التاريخ</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th></tr></thead><tbody>${gradeRows}</tbody></table>
<h2>خامساً: سجل الحضور والغياب (${esc(att.length)} يوم)</h2>
<table><thead><tr><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>${attRows}</tbody></table>
<h2>سادساً: سجل السلوك والنقاط</h2>
<table><thead><tr><th>التاريخ</th><th>السبب</th><th>النقاط</th></tr></thead><tbody>${behRows}</tbody></table>
<div class="foot">وثيقة سرية للاستخدام الإداري، صادرة من نظام ${esc(schoolName)}</div>
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
  return true;
}
