import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach Auth Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bc_token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Don't auto clear if we're attempting login
      if (!error.config.url.includes('/auth/login/')) {
        localStorage.removeItem('bc_token');
        localStorage.removeItem('bc_user');
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
