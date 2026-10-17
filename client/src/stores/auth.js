import { create } from 'zustand';

const KEY = 'haajari.session';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

export const useAuth = create((set) => ({
  token: load().token || null,
  user: load().user || null,
  setSession: ({ token, user }) => {
    try { localStorage.setItem(KEY, JSON.stringify({ token, user })); } catch { /* ignore */ }
    set({ token, user });
  },
  setUser: (user) => set((s) => {
    try { localStorage.setItem(KEY, JSON.stringify({ token: s.token, user })); } catch { /* ignore */ }
    return { user };
  }),
  logout: () => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    set({ token: null, user: null });
  },
}));

export const homeFor = (role) => ({ admin: '/a', teacher: '/t', parent: '/p', superadmin: '/o' }[role] || '/login');
