import { api } from './client';
import { keys } from './keys';

export const reportsApi = {
  register: (classId, month) => api.get('/reports/register', { params: { classId, month } }).then((r) => r.data),
  shortage: (threshold) => api.get('/reports/shortage', { params: { threshold } }).then((r) => r.data),
};

export const registerQuery = (classId, month) => ({ queryKey: keys.register(classId, month), queryFn: () => reportsApi.register(classId, month) });
export const shortageQuery = (threshold) => ({ queryKey: keys.shortage(threshold), queryFn: () => reportsApi.shortage(threshold) });

// Downloads a file from a signed-in API route (a plain link would not carry the login).
export async function download(url, params, fallbackName) {
  const r = await api.get(url, { params, responseType: 'blob' });
  const name = /filename="([^"]+)"/.exec(r.headers['content-disposition'] || '')?.[1] || fallbackName;
  saveBlob(r.data, name);
}

export function saveBlob(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
