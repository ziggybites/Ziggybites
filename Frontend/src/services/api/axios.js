/**
 * Central API client for backend (auth and future APIs).
 */

import axios from 'axios';
import { bootstrapTokenStore, getAccessToken, hasStoredSession, setAccessToken } from '../../core/auth/tokenStore.js';

bootstrapTokenStore();

const baseURL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
    : '/api/v1';

function clearModuleAuth(module) {
  try {
    localStorage.removeItem(`${module}_accessToken`);
    localStorage.removeItem(`${module}_refreshToken`);
    localStorage.removeItem(`${module}_authenticated`);
    localStorage.removeItem(`${module}_user`);
  } catch {
  }
}

function createModuleClient(moduleName) {
  const client = axios.create({
    baseURL: baseURL || undefined,
    timeout: 30000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
  });

  let isRefreshing = false;
  let subscribers = [];

  const subscribeToRefresh = (cb) => subscribers.push(cb);
  const onRefreshed = (newToken) => {
    subscribers.forEach((cb) => cb(newToken));
    subscribers = [];
  };

  const onRefreshFailed = () => {
    clearModuleAuth(moduleName);
    subscribers.forEach((cb) => cb(null));
    subscribers = [];
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('authRefreshFailed', { detail: { module: moduleName } }));
      window.dispatchEvent(new CustomEvent('userAuthChanged', { detail: { module: moduleName, authenticated: false } }));
    }
  };

  client.interceptors.request.use(
    (config) => {
      config.contextModule = moduleName;

      if (config.data instanceof FormData && config.headers?.['Content-Type']) {
        delete config.headers['Content-Type'];
      }

      const token = getAccessToken(moduleName);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (moduleName === 'user' || moduleName === 'public' || moduleName === 'delivery') {
        const zoneId = localStorage.getItem('userZoneId');
        const lat = localStorage.getItem('userLat');
        const lng = localStorage.getItem('userLng');
        if (zoneId) config.headers['X-Zone-Id'] = zoneId;
        if (lat && lng) {
          config.headers['X-User-Lat'] = lat;
          config.headers['X-User-Lng'] = lng;
        }
      }

      return config;
    },
    (err) => Promise.reject(err),
  );

  client.interceptors.response.use(
    (response) => response,
    async (err) => {
      const original = err?.config;

      if (err?.response?.status === 429) return Promise.reject(err);
      if (err?.response?.status === 403) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('accessDenied', { detail: { module: moduleName } }));
        }
        return Promise.reject(err);
      }
      if (err?.response?.status !== 401 || !original || original._retry) {
        return Promise.reject(err);
      }
      if (!hasStoredSession(moduleName)) {
        onRefreshFailed();
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeToRefresh((newToken) => {
            if (newToken) {
              original.headers.Authorization = `Bearer ${newToken}`;
              resolve(client(original));
            } else {
              reject(err);
            }
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshUrl = baseURL ? `${baseURL}/food/auth/refresh-token` : '/api/v1/food/auth/refresh-token';
        const { data } = await axios.post(refreshUrl, {}, { timeout: 10000, withCredentials: true });
        const newAccessToken = data?.data?.accessToken || data?.accessToken;

        if (newAccessToken) {
          setAccessToken(moduleName, newAccessToken);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('authRefreshed', {
              detail: { module: moduleName, token: newAccessToken },
            }));
          }
          onRefreshed(newAccessToken);
          original.headers.Authorization = `Bearer ${newAccessToken}`;
          return client(original);
        }
      } catch {
        onRefreshFailed();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }

      onRefreshFailed();
      return Promise.reject(err);
    },
  );

  return client;
}

export const userClient = createModuleClient('user');
export const restaurantClient = createModuleClient('restaurant');
export const deliveryClient = createModuleClient('delivery');
export const adminClient = createModuleClient('admin');

const apiClient = axios.create({
  baseURL: baseURL || undefined,
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

function getModuleFromUrl(url = '') {
  const u = typeof url === 'string' ? url : url?.url || '';
  if (!u) return 'user';
  const normalized = u.toLowerCase();
  if (normalized.includes('/admin/') || normalized.includes('/food/admin/')) return 'admin';
  if (normalized.includes('/food/delivery') || normalized.includes('/delivery/')) return 'delivery';
  if (normalized.includes('/food/restaurant/') || normalized.includes('/restaurant/')) return 'restaurant';
  return 'user';
}

apiClient.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData && config.headers?.['Content-Type']) {
      delete config.headers['Content-Type'];
    }

    const moduleName = config.contextModule || getModuleFromUrl(config.url);
    const token = getAccessToken(moduleName);
    if (token) config.headers.Authorization = `Bearer ${token}`;

    if (moduleName === 'user' || moduleName === 'public' || moduleName === 'delivery') {
      const zoneId = localStorage.getItem('userZoneId');
      const lat = localStorage.getItem('userLat');
      const lng = localStorage.getItem('userLng');
      if (zoneId) config.headers['X-Zone-Id'] = zoneId;
      if (lat && lng) {
        config.headers['X-User-Lat'] = lat;
        config.headers['X-User-Lng'] = lng;
      }
    }

    return config;
  },
  (err) => Promise.reject(err),
);

export default apiClient;
