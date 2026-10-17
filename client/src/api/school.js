import { api } from './client';
import { keys } from './keys';

export const schoolApi = {
  get: () => api.get('/school').then((r) => r.data.school),
  update: (changes) => api.patch('/school', changes).then((r) => r.data.school),
};

export const schoolQuery = () => ({ queryKey: keys.school, queryFn: schoolApi.get });
