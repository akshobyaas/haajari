import { api } from './client';
import { keys } from './keys';

// Children flagged for follow-up (absent several days in a row, or low attendance).
export const riskApi = {
  list: () => api.get('/risk').then((r) => r.data),
  refresh: () => api.post('/risk/refresh').then((r) => r.data),
  followUp: (flagId, body) => api.post(`/risk/${flagId}/follow-up`, body).then((r) => r.data),
};

export const riskQuery = () => ({ queryKey: keys.risk, queryFn: riskApi.list });
