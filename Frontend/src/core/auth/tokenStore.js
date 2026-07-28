const ACCESS_TOKEN_KEYS = new Set(['accessToken']);
const REFRESH_TOKEN_KEYS = new Set(['refreshToken']);
const accessTokenStore = new Map();
let storagePatched = false;

const isAccessTokenKey = (key) => {
  const normalized = String(key || '').trim();
  return ACCESS_TOKEN_KEYS.has(normalized) || normalized.endsWith('_accessToken');
};

const isRefreshTokenKey = (key) => {
  const normalized = String(key || '').trim();
  return REFRESH_TOKEN_KEYS.has(normalized) || normalized.endsWith('_refreshToken');
};

const getModuleFromStorageKey = (key) => {
  const normalized = String(key || '').trim();
  if (normalized === 'accessToken' || normalized === 'refreshToken') return 'user';
  const tokenIndex = normalized.lastIndexOf('_');
  return tokenIndex > 0 ? normalized.slice(0, tokenIndex) : normalized;
};

const installStoragePatch = () => {
  if (storagePatched || typeof window === 'undefined' || !window.localStorage) return;

  const localStorageRef = window.localStorage;
  const originalGetItem = localStorageRef.getItem.bind(localStorageRef);
  const originalSetItem = localStorageRef.setItem.bind(localStorageRef);
  const originalRemoveItem = localStorageRef.removeItem.bind(localStorageRef);

  localStorageRef.getItem = (key) => {
    if (isAccessTokenKey(key)) {
      const moduleName = getModuleFromStorageKey(key);
      return accessTokenStore.get(moduleName) || null;
    }
    if (isRefreshTokenKey(key)) {
      return null;
    }
    return originalGetItem(key);
  };

  localStorageRef.setItem = (key, value) => {
    if (isAccessTokenKey(key)) {
      const moduleName = getModuleFromStorageKey(key);
      if (value) accessTokenStore.set(moduleName, String(value));
      else accessTokenStore.delete(moduleName);
      return;
    }
    if (isRefreshTokenKey(key)) {
      return;
    }
    return originalSetItem(key, value);
  };

  localStorageRef.removeItem = (key) => {
    if (isAccessTokenKey(key)) {
      accessTokenStore.delete(getModuleFromStorageKey(key));
      return;
    }
    if (isRefreshTokenKey(key)) {
      return;
    }
    return originalRemoveItem(key);
  };

  try {
    ['accessToken', 'refreshToken', 'user_accessToken', 'user_refreshToken', 'admin_accessToken', 'admin_refreshToken', 'restaurant_accessToken', 'restaurant_refreshToken', 'delivery_accessToken', 'delivery_refreshToken'].forEach((key) => originalRemoveItem(key));
  } catch {
  }

  storagePatched = true;
};

installStoragePatch();

export const setAccessToken = (moduleName, token) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  if (!token) {
    accessTokenStore.delete(safeModule);
    return;
  }
  accessTokenStore.set(safeModule, String(token));
};

export const getAccessToken = (moduleName) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  return accessTokenStore.get(safeModule) || null;
};

export const clearAccessToken = (moduleName) => {
  installStoragePatch();
  accessTokenStore.delete(String(moduleName || 'user').trim() || 'user');
};

export const clearAllAccessTokens = () => {
  installStoragePatch();
  accessTokenStore.clear();
};

export const hasStoredSession = (moduleName) => {
  installStoragePatch();
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const safeModule = String(moduleName || 'user').trim() || 'user';
  return (
    window.localStorage.getItem(`${safeModule}_authenticated`) === 'true' ||
    Boolean(window.localStorage.getItem(`${safeModule}_user`))
  );
};

export const removeLegacyStoredTokens = (moduleName) => {
  installStoragePatch();
  if (typeof window === 'undefined' || !window.localStorage) return;
  const safeModule = String(moduleName || 'user').trim() || 'user';
  const legacyKeys = [`${safeModule}_accessToken`, `${safeModule}_refreshToken`];
  if (safeModule === 'user') {
    legacyKeys.push('accessToken', 'refreshToken');
  }
  legacyKeys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
    }
  });
};

export const bootstrapTokenStore = () => {
  installStoragePatch();
};
