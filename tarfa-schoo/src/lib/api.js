import supabase from './supabase';

export async function api(path, { method = 'GET', body, query } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let url = path;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ).toString();
    if (qs) url += `?${qs}`;
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('تعذر الاتصال بالخادم، تحقق من الإنترنت');
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) throw new Error(json?.error || 'حدث خطأ غير متوقع');
  return json;
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

// Uploads a file to a storage bucket through the API and returns its public URL.
export async function uploadFile(file, bucket) {
  const fileBase64 = await readFileAsBase64(file);
  const r = await api('/api/upload', {
    method: 'POST',
    body: { bucket, fileName: file.name, fileBase64, contentType: file.type },
  });
  return r.url;
}
