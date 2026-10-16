import axios from 'axios';
import i18n from '../i18n';
import { useAuth } from './auth';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 30000 }); // generous: 2G/3G links in rural schools

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && useAuth.getState().token && !err.config.url.startsWith('/auth/')) {
      useAuth.getState().logout();
    }
    return Promise.reject(err);
  }
);

// The server writes user-facing messages; fall back to a translated one.
export function errorMessage(err) {
  if (!err?.response) return i18n.t('errors.network');
  return err.response.data?.error?.message || i18n.t('errors.generic');
}

export const errorDetails = (err) => err?.response?.data?.error?.details || {};
