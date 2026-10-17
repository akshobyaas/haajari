import { api } from './client';
import { keys } from './keys';

// Staff accounts (headmaster only).
export const usersApi = {
  teachers: () => api.get('/users', { params: { role: 'teacher' } }).then((r) => r.data.users),
  createTeacher: (body) => api.post('/users', { role: 'teacher', ...body }).then((r) => r.data),
  resetPin: (userId) => api.post(`/users/${userId}/reset-pin`).then((r) => r.data),
};

export const teachersQuery = () => ({ queryKey: keys.teachers, queryFn: usersApi.teachers });
