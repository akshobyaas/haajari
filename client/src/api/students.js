import { api } from './client';
import { keys } from './keys';

export const studentsApi = {
  list: ({ classId, search } = {}) => api.get('/students', { params: { classId: classId || undefined, search: search || undefined } }).then((r) => r.data.students),
  create: (body) => api.post('/students', body).then((r) => r.data),
  update: (studentId, body) => api.patch(`/students/${studentId}`, body).then((r) => r.data),
  remove: (studentId, reason) => api.delete(`/students/${studentId}`, { data: { reason } }).then((r) => r.data),
  // dryRun: check the sheet and list problems without saving anything.
  import: (body, { dryRun = false } = {}) => api.post(`/students/import${dryRun ? '?dryRun=true' : ''}`, body).then((r) => r.data),
  template: () => api.get('/students/import/template', { responseType: 'blob' }).then((r) => r.data),
};

export const studentsQuery = ({ classId, search } = {}) => ({
  queryKey: keys.studentsFor(classId, search),
  queryFn: () => studentsApi.list({ classId, search }),
});
