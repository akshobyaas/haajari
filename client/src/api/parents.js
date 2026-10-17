import { api } from './client';
import { keys } from './keys';

// The parent's side: their children, month views, pickup passes, replies to absences.
export const parentsApi = {
  children: () => api.get('/me/children').then((r) => r.data.children),
  month: (studentId, month) => api.get(`/me/children/${studentId}/attendance`, { params: month ? { month } : {} }).then((r) => r.data),
  pickupPass: (studentId, guardianId) => api.get(`/me/children/${studentId}/pickup-pass`, { params: { guardianId } }).then((r) => r.data),
  setGuardians: (studentId, guardians) => api.put(`/me/children/${studentId}/guardians`, { guardians }).then((r) => r.data),
  giveReason: (attendanceId, reason) => api.post(`/me/absences/${attendanceId}/reason`, { reason }).then((r) => r.data),
};

export const childrenQuery = () => ({ queryKey: keys.children, queryFn: parentsApi.children });
export const childMonthQuery = (studentId, month) => ({ queryKey: keys.childMonthFor(studentId, month), queryFn: () => parentsApi.month(studentId, month) });
