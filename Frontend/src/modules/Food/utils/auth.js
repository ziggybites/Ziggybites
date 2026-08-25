import {
  bootstrapTokenStore,
  clearAccessToken,
  clearAllAccessTokens,
  clearAllRefreshTokens,
  clearRefreshToken,
  getAccessToken,
  getRefreshToken,
  hasStoredSession,
  removeLegacyStoredTokens,
  setAccessToken,
  setRefreshToken,
} from '../../../core/auth/tokenStore.js';
import {
  clearUserProfileStorage,
  DELIVERY_AUTH_FLOW_KEY,
  DELIVERY_NEEDS_REGISTRATION_KEY,
  DELIVERY_SIGNUP_DETAILS_KEY,
  DELIVERY_SIGNUP_DOCS_KEY,
  getAuthenticatedKey,
  getFcmTokenKey,
  getRefreshTokenLegacyKey,
  getUserKey,
} from '../../../core/auth/storageKeys.js';

bootstrapTokenStore();

export function decodeToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

export function getRoleFromToken(token) {
  const decoded = decodeToken(token);
  return decoded?.role || null;
}

export function isTokenExpired(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now();
}

export function getUserIdFromToken(token) {
  const decoded = decodeToken(token);
  return decoded?.userId || decoded?.id || null;
}

export function hasModuleAccess(role, module) {
  const roleModuleMap = {
    admin: 'admin',
    restaurant: 'restaurant',
    delivery: 'delivery',
    user: 'user',
  };
  return roleModuleMap[role] === module;
}

export function getModuleToken(module) {
  return getAccessToken(module);
}

export function getModuleRefreshToken(_module) {
  return getRefreshToken(_module);
}

export function getCurrentUserRole(module = null) {
  if (module) {
    const token = getModuleToken(module);
    if (token && !isTokenExpired(token)) {
      return getRoleFromToken(token);
    }
    const userStr = localStorage.getItem(`${module}_user`);
    if (!userStr) return null;
    try {
      const user = JSON.parse(userStr);
      return user.role || module;
    } catch {
      return module;
    }
  }

  const modules = ['user', 'restaurant', 'delivery', 'admin'];
  for (const mod of modules) {
    const token = getModuleToken(mod);
    if (token && !isTokenExpired(token)) return getRoleFromToken(token);
  }

  for (const mod of modules) {
    if (hasStoredSession(mod)) return mod === 'delivery' ? 'delivery' : mod;
  }

  return null;
}

export function getCurrentUser(module) {
  if (!module) return null;
  const userStr = localStorage.getItem(getUserKey(module));
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function isModuleAuthenticated(module) {
  const token = getModuleToken(module);
  if (token && !isTokenExpired(token)) return true;
  return hasStoredSession(module);
}

export function clearUserSession() {
  if (typeof localStorage === 'undefined') return;
  clearUserProfileStorage();
  localStorage.removeItem('user_edit_profile_draft');
}

export function clearRestaurantSessionCache() {
  [
    'restaurant_owner_contact',
    'restaurant_onboarding',
    'restaurant_onboarding_data',
    'restaurant_invited_users',
    'restaurant_schedule_off',
    'restaurant_online_status',
    'restaurant_outlet_timings',
    'restaurant_hub_menu_active_tab',
    'restaurant_name',
    'restaurantName',
    'restaurant_pendingPhone',
  ].forEach((key) => localStorage.removeItem(key));
}

export function setRestaurantPendingPhone(phone) {
  if (typeof localStorage === 'undefined') return;
  if (!phone) {
    localStorage.removeItem('restaurant_pendingPhone');
    return;
  }
  localStorage.setItem('restaurant_pendingPhone', phone);
}

export function getRestaurantPendingPhone() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('restaurant_pendingPhone');
}

export function clearRestaurantPendingPhone() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('restaurant_pendingPhone');
}

export function clearModuleAuth(module) {
  clearAccessToken(module);
  clearRefreshToken(module);
  removeLegacyStoredTokens(module);
  localStorage.removeItem(getAuthenticatedKey(module));
  localStorage.removeItem(getUserKey(module));
  localStorage.removeItem(getFcmTokenKey(module));
  localStorage.removeItem(getRefreshTokenLegacyKey(module));
  if (module === 'user') clearUserSession();
  if (module === 'restaurant') clearRestaurantSessionCache();
  sessionStorage.removeItem(`${module}AuthData`);
  if (module === 'delivery') {
    sessionStorage.removeItem(DELIVERY_AUTH_FLOW_KEY);
    sessionStorage.removeItem(DELIVERY_SIGNUP_DETAILS_KEY);
    sessionStorage.removeItem(DELIVERY_SIGNUP_DOCS_KEY);
    sessionStorage.removeItem(DELIVERY_NEEDS_REGISTRATION_KEY);
    localStorage.removeItem(DELIVERY_AUTH_FLOW_KEY);
    localStorage.removeItem(DELIVERY_SIGNUP_DETAILS_KEY);
    localStorage.removeItem(DELIVERY_SIGNUP_DOCS_KEY);
    localStorage.removeItem(DELIVERY_NEEDS_REGISTRATION_KEY);
  }
}

export function clearAuthData() {
  ['admin', 'restaurant', 'delivery', 'user'].forEach((module) => clearModuleAuth(module));
  clearAllAccessTokens();
  clearAllRefreshTokens();
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

export function setAuthData(module, token, user, refreshToken = null) {
  try {
    if (typeof Storage === 'undefined' || !localStorage) {
      throw new Error('localStorage is not available');
    }
    if (!module || !token) {
      throw new Error(`Invalid parameters: module=${module}, token=${!!token}`);
    }

    const userKey = getUserKey(module);

    if (module === 'user') clearUserSession();
    if (module === 'restaurant') clearRestaurantSessionCache();

    removeLegacyStoredTokens(module);
    setAccessToken(module, token);
    setRefreshToken(module, refreshToken);
    localStorage.setItem(getAuthenticatedKey(module), 'true');
    if (user) {
      localStorage.setItem(userKey, JSON.stringify(user));
    }

    const storedToken = getModuleToken(module);
    const storedAuth = localStorage.getItem(getAuthenticatedKey(module));
    if (storedToken !== token) {
      throw new Error(`Token storage verification failed for module: ${module}`);
    }
    if (storedAuth !== 'true') {
      throw new Error(`Authentication flag storage failed for module: ${module}`);
    }

    window.dispatchEvent(new CustomEvent('userAuthChanged', { detail: { module, authenticated: true } }));
  } catch (error) {
    console.error('[setAuthData] Error storing auth data:', error);
    throw error;
  }
}
