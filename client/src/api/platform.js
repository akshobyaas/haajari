import { api } from './client';
import { keys } from './keys';

// Schools joining Haajari: the public request form and the block office's console.
export const platformApi = {
  requestSchool: (body) => api.post('/public/school-requests', body).then((r) => r.data.school),
  schools: () => api.get('/platform/schools').then((r) => r.data.schools),
  addSchool: (body) => api.post('/platform/schools', body).then((r) => r.data.school),
  decide: (schoolId, decision, reason) => api.post(`/platform/schools/${schoolId}/decision`, { decision, reason }).then((r) => r.data.school),
};

export const schoolsQuery = () => ({ queryKey: keys.schools, queryFn: platformApi.schools });
