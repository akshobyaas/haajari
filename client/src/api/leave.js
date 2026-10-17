import { api } from './client';
import { keys } from './keys';

export const leaveApi = {
  list: (params) => api.get('/leave', { params }).then((r) => r.data.leaves),
  apply: (body) => api.post('/leave', body).then((r) => r.data),
  decide: (leaveId, decision) => api.patch(`/leave/${leaveId}`, { decision }).then((r) => r.data),
  cancel: (leaveId) => api.delete(`/leave/${leaveId}`).then((r) => r.data),
};

export const leaveQuery = (status) => ({ queryKey: keys.leaveFor(status), queryFn: () => leaveApi.list(status ? { status } : undefined) });
