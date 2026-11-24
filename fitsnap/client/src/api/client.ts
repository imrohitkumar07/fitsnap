import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT & normalize endpoint URLs
apiClient.interceptors.request.use(
  (config) => {
    // Strip redundant leading /api if baseURL already has /api
    if (config.url && config.url.startsWith('/api/')) {
      config.url = config.url.replace(/^\/api/, '');
    }
    const token = localStorage.getItem('fitsnap_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Response interceptor: handle 401 gracefully with automatic silent refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';
    const isAuthRoute =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/demo');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      const refreshToken = localStorage.getItem('fitsnap_refresh_token');

      if (!refreshToken) {
        localStorage.removeItem('fitsnap_token');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${apiBaseUrl}/auth/refresh`, { refreshToken });
        const data = response.data?.data || response.data;
        const newToken = data.token;
        const newRefreshToken = data.refreshToken;

        localStorage.setItem('fitsnap_token', newToken);
        if (newRefreshToken) {
          localStorage.setItem('fitsnap_refresh_token', newRefreshToken);
        }

        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('fitsnap_token');
        localStorage.removeItem('fitsnap_refresh_token');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/** Typed GET request */
export async function get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response: AxiosResponse<T> = await apiClient.get(url, config);
  return response.data;
}

/** Typed POST request */
export async function post<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response: AxiosResponse<T> = await apiClient.post(url, data, config);
  return response.data;
}

/** Typed PUT request */
export async function put<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response: AxiosResponse<T> = await apiClient.put(url, data, config);
  return response.data;
}

/** Typed DELETE request */
export async function del<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response: AxiosResponse<T> = await apiClient.delete(url, config);
  return response.data;
}

export { apiClient as api };
export default apiClient;
