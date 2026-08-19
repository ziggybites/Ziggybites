import apiClient, { userClient, restaurantClient, deliveryClient, adminClient } from './axios.js';
import { EMAIL_REGEX } from '@/shared/utils/emailValidation';
import { hasStoredSession } from '../../core/auth/tokenStore.js';

const AUTH = {
  USER_REQUEST_OTP: '/food/auth/user/request-otp',
  USER_VERIFY_OTP: '/food/auth/user/verify-otp',
  ADMIN_LOGIN: '/food/auth/admin/login',
  RESTAURANT_REQUEST_OTP: '/food/auth/restaurant/request-otp',
  RESTAURANT_VERIFY_OTP: '/food/auth/restaurant/verify-otp',
  DELIVERY_REQUEST_OTP: '/food/auth/delivery/request-otp',
  DELIVERY_VERIFY_OTP: '/food/auth/delivery/verify-otp',
  REFRESH_TOKEN: '/food/auth/refresh-token',
  LOGOUT: '/food/auth/logout',
  ME: '/food/auth/me',
};

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.slice(-15);
}

const USER_PHONE_LENGTH = 10;

export function requestUserOtp(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return Promise.reject(new Error('Phone number is required'));
  if (!/^\d+$/.test(digits)) return Promise.reject(new Error('Phone must contain only digits'));
  const normalized = digits.length > USER_PHONE_LENGTH ? digits.slice(-USER_PHONE_LENGTH) : digits;
  if (normalized.length !== USER_PHONE_LENGTH) {
    return Promise.reject(new Error('Phone number must be exactly 10 digits'));
  }
  return userClient.post(AUTH.USER_REQUEST_OTP, { phone: normalized });
}

export function verifyUserOtp(phone, otp, ref, name = null, fcmToken = null, platform = 'web') {
  const digits = normalizePhone(phone);
  if (!digits) return Promise.reject(new Error('Phone number is required'));
  const normalized = digits.length > USER_PHONE_LENGTH ? digits.slice(-USER_PHONE_LENGTH) : digits;
  if (normalized.length !== USER_PHONE_LENGTH) {
    return Promise.reject(new Error('Phone number must be exactly 10 digits'));
  }
  const otpStr = String(otp ?? '').replace(/\D/g, '').slice(0, 4);
  if (!otpStr) return Promise.reject(new Error('OTP is required'));
  if (otpStr.length !== 4) return Promise.reject(new Error('OTP must be exactly 4 digits'));
  const refValue = typeof ref === 'string' ? ref.trim() : '';
  return apiClient.post(AUTH.USER_VERIFY_OTP, {
    phone: normalized,
    otp: otpStr,
    ...(refValue ? { ref: refValue } : {}),
    ...(name ? { name } : {}),
    ...(fcmToken ? { fcmToken, platform } : {}),
  });
}

export function adminLogin(email, password) {
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  if (!trimmedEmail) return Promise.reject(new Error('Email is required'));
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return Promise.reject(new Error('Please enter a valid email address'));
  }
  const passwordStr = String(password ?? '');
  if (!passwordStr) return Promise.reject(new Error('Password is required'));
  if (passwordStr.length < 6) return Promise.reject(new Error('Password must be at least 6 characters'));
  return adminClient.post(AUTH.ADMIN_LOGIN, { email: trimmedEmail, password: passwordStr });
}

export function refreshToken(refreshToken = null) {
  return apiClient.post(AUTH.REFRESH_TOKEN, refreshToken ? { refreshToken } : {});
}

export function logout(refreshToken = null, fcmToken = null, platform = 'web') {
  const payload = {};
  if (refreshToken) payload.refreshToken = refreshToken;
  if (fcmToken) {
    payload.fcmToken = fcmToken;
    payload.platform = platform;
  }
  clearMeCache();
  return apiClient.post(AUTH.LOGOUT, payload);
}

export function clearMeCache() {
  meCache.clear();
  meInFlight.clear();
}

export function getMe(module = 'user') {
  return getMeOnce(String(module || 'user'));
}

const ME_CACHE_MS = 3000;
const meCache = new Map();
const meInFlight = new Map();
const meBackoff = new Map();
const BACKOFF_MS = 10000;

function hasModuleSession(module) {
  try {
    return hasStoredSession(module);
  } catch {
    return false;
  }
}

function getMeOnce(module) {
  const now = Date.now();
  const backoff = meBackoff.get(module);
  if (backoff && now < backoff) {
    return Promise.reject(new Error('Rate limited. Retrying too soon.'));
  }

  const cached = meCache.get(module);
  if (cached && now - cached.at < ME_CACHE_MS) {
    return Promise.resolve(cached.res);
  }

  if (!hasModuleSession(module)) {
    return Promise.reject(new Error('Not authenticated'));
  }

  const existing = meInFlight.get(module);
  if (existing) return existing;

  const clients = { user: userClient, restaurant: restaurantClient, delivery: deliveryClient, admin: adminClient };
  const client = clients[module] || apiClient;

  const p = client
    .get(AUTH.ME)
    .then((res) => {
      meCache.set(module, { at: Date.now(), res });
      return res;
    })
    .catch((err) => {
      if (err?.response?.status === 429) {
        meBackoff.set(module, Date.now() + BACKOFF_MS);
      }
      throw err;
    })
    .finally(() => {
      meInFlight.delete(module);
    });

  meInFlight.set(module, p);
  return p;
}

export function requestRestaurantOtp(phone) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 8) return Promise.reject(new Error('Phone must be at least 8 digits'));
  return restaurantClient.post(AUTH.RESTAURANT_REQUEST_OTP, { phone: normalized });
}

export function verifyRestaurantOtp(phone, otp, fcmToken = null, platform = 'web') {
  const normalized = normalizePhone(phone);
  const otpStr = String(otp).replace(/\D/g, '').slice(0, 4);
  if (!normalized || otpStr.length !== 4) {
    return Promise.reject(new Error('Phone and 4-digit OTP are required'));
  }
  return restaurantClient.post(AUTH.RESTAURANT_VERIFY_OTP, {
    phone: normalized,
    otp: otpStr,
    ...(fcmToken ? { fcmToken, platform } : {}),
  });
}

export function requestDeliveryOtp(phone) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 8) return Promise.reject(new Error('Phone must be at least 8 digits'));
  return deliveryClient.post(AUTH.DELIVERY_REQUEST_OTP, { phone: normalized });
}

export function verifyDeliveryOtp(phone, otp, fcmToken = null, platform = 'web') {
  const normalized = normalizePhone(phone);
  const otpStr = String(otp).replace(/\D/g, '').slice(0, 4);
  if (!normalized || otpStr.length !== 4) {
    return Promise.reject(new Error('Phone and 4-digit OTP are required'));
  }
  return deliveryClient.post(AUTH.DELIVERY_VERIFY_OTP, {
    phone: normalized,
    otp: otpStr,
    ...(fcmToken ? { fcmToken, platform } : {}),
  });
}
