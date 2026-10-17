import { api } from './client';
import { keys } from './keys';

// Headmaster's live picture of the school.
export const dashboardApi = {
  today: () => api.get('/dashboard/today').then((r) => r.data),
  trend: () => api.get('/dashboard/trend').then((r) => r.data.days),
  summary: () => api.get('/dashboard/summary').then((r) => r.data),
};

export const todayQuery = () => ({ queryKey: keys.today, queryFn: dashboardApi.today });
export const trendQuery = () => ({ queryKey: keys.trend, queryFn: dashboardApi.trend });
export const summaryQuery = () => ({ queryKey: keys.summary, queryFn: dashboardApi.summary });
