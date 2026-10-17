import { api } from './client';
import { keys } from './keys';

export const attendanceApi = {
  // A whole class in one request; replayed safely by the offline queue (src/offline/sync.js).
  saveBulk: (body) => api.post('/attendance/bulk', body).then((r) => r.data),
  history: (classId) => api.get(`/attendance/class/${classId}/history`).then((r) => r.data.days),
  audit: (studentId, date) => api.get('/attendance/audit', { params: { studentId, date } }).then((r) => r.data.logs),
};

export const historyQuery = (classId) => ({ queryKey: keys.history(classId), queryFn: () => attendanceApi.history(classId) });
export const auditQuery = (studentId, date) => ({ queryKey: keys.audit(studentId, date), queryFn: () => attendanceApi.audit(studentId, date) });
