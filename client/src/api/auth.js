import { api } from './client';

// Login and PIN setup. Each returns { token, user } on success, or throws.
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }).then((r) => r.data),
  pinLogin: (phone, pin) => api.post('/auth/pin-login', { phone, pin }).then((r) => r.data),
  requestOtp: (phone) => api.post('/auth/otp/request', { phone }).then((r) => r.data),
  verifyOtp: (phone, code) => api.post('/auth/otp/verify', { phone, code }).then((r) => r.data),
  setupPin: (setupToken, pin) => api.post('/auth/pin/setup', { setupToken, pin }).then((r) => r.data),
  updateMe: (changes) => api.patch('/auth/me', changes).then((r) => r.data.user),
};
