/**
 * Central API client for backend (auth and future APIs).
 */

import axios from 'axios';
import {
  bootstrapTokenStore,
  getAccessToken,
  getRefreshToken,
  hasStoredSession,
  setAccessToken,
  setRefreshToken,
} from '../../core/auth/tokenStore.js';
import { clearModuleAuth } from '../../modules/Food/utils/auth.js';

bootstrapTokenStore();

function getStoredRequestLocation() {
  let location = null;

  try {
    const rawLocation = localStorage.getItem('userLocation');
    if (rawLocation) {
      location = JSON.parse(rawLocation);
    }
  } catch {
    location = null;
  }

  const zoneId = localStorage.getItem('userZoneId');
  const latFromLocation = Number(location?.latitude ?? location?.lat);
  const lngFromLocation = Number(location?.longitude ?? location?.lng);
  const fallbackLat = Number(localStorage.getItem('userLat'));
  const fallbackLng = Number(localStorage.getItem('userLng'));

  const lat = Number.isFinite(latFromLocation) ? latFromLocation : fallbackLat;
  const lng = Number.isFinite(lngFromLocation) ? lngFromLocation : fallbackLng;

  return { zoneId, lat, lng };
}

const baseURL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
    : '/api/v1';

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
    try {
      clearModuleAuth(moduleName);
    } catch {
    }
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
        const { zoneId, lat, lng } = getStoredRequestLocation();
        if (zoneId) config.headers['X-Zone-Id'] = zoneId;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          config.headers['X-User-Lat'] = String(lat);
          config.headers['X-User-Lng'] = String(lng);
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
        const storedRefreshToken = getRefreshToken(moduleName);
        const refreshPayload = storedRefreshToken ? { refreshToken: storedRefreshToken } : {};
        const { data } = await axios.post(refreshUrl, refreshPayload, { timeout: 10000, withCredentials: true });
        const newAccessToken = data?.data?.accessToken || data?.accessToken;
        const newRefreshToken = data?.data?.refreshToken || data?.refreshToken || storedRefreshToken;

        if (newAccessToken) {
          setAccessToken(moduleName, newAccessToken);
          if (newRefreshToken) {
            setRefreshToken(moduleName, newRefreshToken);
          }
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

const apiRefreshState = new Map();

function getRefreshState(moduleName) {
  const key = String(moduleName || 'user');
  if (!apiRefreshState.has(key)) {
    apiRefreshState.set(key, {
      isRefreshing: false,
      subscribers: [],
    });
  }
  return apiRefreshState.get(key);
}

function subscribeToApiRefresh(moduleName, cb) {
  const state = getRefreshState(moduleName);
  state.subscribers.push(cb);
}

function publishApiRefreshSuccess(moduleName, newToken) {
  const state = getRefreshState(moduleName);
  state.subscribers.forEach((cb) => cb(newToken));
  state.subscribers = [];
}

function publishApiRefreshFailure(moduleName) {
  const state = getRefreshState(moduleName);
  state.subscribers.forEach((cb) => cb(null));
  state.subscribers = [];
}

async function tryRefreshForModule(moduleName) {
  const refreshUrl = baseURL ? `${baseURL}/food/auth/refresh-token` : '/api/v1/food/auth/refresh-token';
  const storedRefreshToken = getRefreshToken(moduleName);
  const refreshPayload = storedRefreshToken ? { refreshToken: storedRefreshToken } : {};
  const { data } = await axios.post(refreshUrl, refreshPayload, { timeout: 10000, withCredentials: true });
  const newAccessToken = data?.data?.accessToken || data?.accessToken;
  const newRefreshToken = data?.data?.refreshToken || data?.refreshToken || storedRefreshToken;

  if (!newAccessToken) {
    throw new Error(`Refresh token flow did not return access token for module ${moduleName}`);
  }

  setAccessToken(moduleName, newAccessToken);
  if (newRefreshToken) {
    setRefreshToken(moduleName, newRefreshToken);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('authRefreshed', {
      detail: { module: moduleName, token: newAccessToken },
    }));
  }
  return newAccessToken;
}

function getModuleFromUrl(url = '') {
  const u = typeof url === 'string' ? url : url?.url || '';
  if (!u) return 'user';
  const normalized = u.toLowerCase();
  if (normalized.includes('/admin/') || normalized.includes('/food/admin/')) return 'admin';
  if (normalized.includes('/food/delivery') || normalized.includes('/delivery/')) return 'delivery';
  if (normalized.includes('/food/restaurant/') || normalized.includes('/restaurant/')) return 'restaurant';
  return 'user';
}

function clearStaleSessionForModule(moduleName) {
  try {
    clearModuleAuth(moduleName);
  } catch {
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('authRefreshFailed', { detail: { module: moduleName } }));
    window.dispatchEvent(new CustomEvent('userAuthChanged', { detail: { module: moduleName, authenticated: false } }));
  }
}

function isUserAuthCriticalRequest(config = {}) {
  const method = String(config?.method || 'get').trim().toLowerCase();
  const url = String(config?.url || '').trim().toLowerCase();
  if (method !== 'get') return false;
  return url.startsWith('/food/orders');
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
      const { zoneId, lat, lng } = getStoredRequestLocation();
      if (zoneId) config.headers['X-Zone-Id'] = zoneId;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        config.headers['X-User-Lat'] = String(lat);
        config.headers['X-User-Lng'] = String(lng);
      }
    }

    return config;
  },
  (err) => Promise.reject(err),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (err) => {
    const status = err?.response?.status;
    const requestConfig = err?.config || {};
    const moduleName = requestConfig.contextModule || getModuleFromUrl(requestConfig.url);
    const token = getAccessToken(moduleName);
    const hasSession = hasStoredSession(moduleName);

    const shouldAttemptRefresh =
      status === 401 &&
      hasSession &&
      !requestConfig._retry &&
      moduleName !== 'public';

    if (shouldAttemptRefresh) {
      const refreshState = getRefreshState(moduleName);

      if (refreshState.isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeToApiRefresh(moduleName, (newToken) => {
            if (newToken) {
              requestConfig._retry = true;
              requestConfig.headers = requestConfig.headers || {};
              requestConfig.headers.Authorization = `Bearer ${newToken}`;
              resolve(apiClient(requestConfig));
            } else {
              reject(err);
            }
          });
        });
      }

      refreshState.isRefreshing = true;
      requestConfig._retry = true;

      try {
        const newToken = await tryRefreshForModule(moduleName);
        publishApiRefreshSuccess(moduleName, newToken);
        requestConfig.headers = requestConfig.headers || {};
        requestConfig.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(requestConfig);
      } catch (refreshError) {
        publishApiRefreshFailure(moduleName);
        clearStaleSessionForModule(moduleName);
        return Promise.reject(refreshError);
      } finally {
        refreshState.isRefreshing = false;
      }
    }

    if (status === 401 && hasSession && !token) {
      clearStaleSessionForModule(moduleName);
    } else if (status === 403 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('accessDenied', { detail: { module: moduleName } }));
    }

    return Promise.reject(err);
  },
);

export default apiClient;
