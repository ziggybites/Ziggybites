const ACCESS_TOKEN_KEYS = new Set(['accessToken']);
const REFRESH_TOKEN_KEYS = new Set(['refreshToken']);
const accessTokenStore = new Map();
let storagePatched = false;
const SESSION_TOKEN_SUFFIX = '_accessToken_session';

const getSessionTokenKey = (moduleName) =>
  `${String(moduleName || 'user').trim() || 'user'}${SESSION_TOKEN_SUFFIX}`;

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
    try {
      window.sessionStorage?.removeItem(getSessionTokenKey(safeModule));
    } catch {
    }
    return;
  }
  const normalizedToken = String(token);
  accessTokenStore.set(safeModule, normalizedToken);
  try {
    window.sessionStorage?.setItem(getSessionTokenKey(safeModule), normalizedToken);
  } catch {
  }
};

export const getAccessToken = (moduleName) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  const inMemoryToken = accessTokenStore.get(safeModule);
  if (inMemoryToken) return inMemoryToken;

  try {
    const sessionToken = window.sessionStorage?.getItem(getSessionTokenKey(safeModule)) || null;
    if (sessionToken) {
      accessTokenStore.set(safeModule, sessionToken);
      return sessionToken;
    }
  } catch {
  }

  return null;
};

export const clearAccessToken = (moduleName) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  accessTokenStore.delete(safeModule);
  try {
    window.sessionStorage?.removeItem(getSessionTokenKey(safeModule));
  } catch {
  }
};

export const clearAllAccessTokens = () => {
  installStoragePatch();
  const modules = Array.from(accessTokenStore.keys());
  accessTokenStore.clear();
  try {
    modules.forEach((moduleName) => {
      window.sessionStorage?.removeItem(getSessionTokenKey(moduleName));
    });
  } catch {
  }
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
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    ['user', 'restaurant', 'delivery', 'admin'].forEach((moduleName) => {
      const token = window.sessionStorage.getItem(getSessionTokenKey(moduleName));
      if (token) {
        accessTokenStore.set(moduleName, token);
      }
    });
  } catch {
  }
};
