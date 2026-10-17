import { api } from './client';
import { keys } from './keys';

// Classes and their rosters. The marking screen reads rosters through src/offline/roster.js,
// which falls back to the copy saved on the phone.
export const classesApi = {
  // { date, closed, classes } — today's date and whether the school is closed, with the classes.
  overview: () => api.get('/classes').then((r) => r.data),
  list: () => api.get('/classes').then((r) => r.data.classes),
  roster: (classId, date) => api.get(`/classes/${classId}/roster`, { params: date ? { date } : {} }).then((r) => r.data),
  create: (body) => api.post('/classes', body).then((r) => r.data),
  update: (classId, body) => api.patch(`/classes/${classId}`, body).then((r) => r.data),
};

export const classesQuery = () => ({ queryKey: keys.classList, queryFn: classesApi.list });
