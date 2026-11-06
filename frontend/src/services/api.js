import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Endpoints where a 401 means "wrong credentials", not "session expired".
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => url.endsWith(p));
    if (error.response?.status === 401 && !isPublicAuth && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      sessionStorage.setItem('authNotice', 'Your session has expired. Please sign in again.');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ERR_NETWORK' || (!error?.response && error?.request)) {
    return 'Cannot reach the server. Check your connection and that the backend is running.';
  }
  return fallback;
};

export const authService = {
  login: (email, password, role) => api.post('/auth/login', { email, password, role }),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  getProfile: () => api.get('/auth/profile'),
};

export const scanService = {
  uploadImage: (formData, onUploadProgress) => api.post('/scan/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  }),
  getResults: (scanId) => api.get(`/scan/results/${scanId}`),
  getHistory: (params) => api.get('/scan/history', { params }),
  getScanById: (id) => api.get(`/scan/${id}`),
  // Images are private: fetched with the auth header and shown via a blob URL.
  getImageBlob: (scanId) => api.get(`/scan/results/${scanId}/image`, { responseType: 'blob' }),
  deleteScan: (id) => api.delete(`/scan/${id}`),
};

export const consultationService = {
  createAppointment: (data) => api.post('/consultation/appointment', data),
  getDoctors: () => api.get('/consultation/doctors'),
  getConsultations: (params) => api.get('/consultation/list', { params }),
  reportPreview: (data) => api.post('/consultation/report-preview', data),
  withdrawReport: (id) => api.post(`/consultation/${id}/withdraw-report`),
  events: (id) => api.get(`/consultation/${id}/events`),
  getSlots: (doctorId, date) => api.get(`/consultation/doctors/${doctorId}/slots`, { params: { date } }),
  cancel: (id) => api.post(`/consultation/${id}/cancel`),
  reschedule: (id, appointmentDate) => api.post(`/consultation/${id}/reschedule`, { appointment_date: appointmentDate }),
  sendMessage: (data) => api.post('/consultation/message', data),
};

export const doctorService = {
  getProfile: () => api.get('/doctor/profile'),
  saveProfile: (data) => api.put('/doctor/profile', data),
  appointments: (status) => api.get('/doctor/appointments', { params: status ? { status } : {} }),
  confirm: (id, note) => api.post(`/doctor/appointments/${id}/confirm`, { note }),
  decline: (id, reason) => api.post(`/doctor/appointments/${id}/decline`, { reason }),
  complete: (id, note) => api.post(`/doctor/appointments/${id}/complete`, { note }),
  report: (id) => api.get(`/doctor/appointments/${id}/report`),
};

export const adminService = {
  getUsers: () => api.get('/admin/users'),
  getAnalytics: () => api.get('/admin/analytics'),
  getDiseaseTrends: () => api.get('/admin/disease-trends'),
  getConsultations: () => api.get('/admin/consultations'),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getDoctorAccounts: (status) => api.get('/admin/doctors', { params: status ? { status } : {} }),
  approveDoctor: (id, data) => api.post(`/admin/doctors/${id}/approve`, data),
  rejectDoctor: (id, reason) => api.post(`/admin/doctors/${id}/reject`, { reason }),
};

export default api;
