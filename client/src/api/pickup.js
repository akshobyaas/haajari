import { api } from './client';
import { keys } from './keys';

// Pre-primary arrival and hand-over.
export const pickupApi = {
  today: (classId) => api.get(`/pickup/class/${classId}/today`).then((r) => r.data),
  // Either { passToken, studentId } from a scanned QR pass, or { studentId, guardianId }.
  checkout: (body) => api.post('/pickup/checkout', body).then((r) => r.data),
  undo: (studentId) => api.post('/pickup/undo', { studentId }).then((r) => r.data),
};

export const pickupQuery = (classId) => ({ queryKey: keys.pickup(classId), queryFn: () => pickupApi.today(classId) });
