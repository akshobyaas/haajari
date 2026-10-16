import { api } from './api';

// Downloads a file from an authenticated API route (a plain link would not carry the login).
export async function download(url, params, fallbackName) {
  const r = await api.get(url, { params, responseType: 'blob' });
  const name = /filename="([^"]+)"/.exec(r.headers['content-disposition'] || '')?.[1] || fallbackName;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(r.data), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
