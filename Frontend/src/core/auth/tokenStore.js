import {
  AUTH_MODULES,
  getAccessTokenLegacyKey,
  getAuthenticatedKey,
  getPersistentAccessTokenKey,
  getPersistentRefreshTokenKey,
  getRefreshTokenLegacyKey,
  getSessionAccessTokenKey,
  getUserKey,
  LEGACY_AUTH_TOKEN_KEYS,
} from "./storageKeys.js";

const ACCESS_TOKEN_KEYS = new Set(['accessToken']);
const REFRESH_TOKEN_KEYS = new Set(['refreshToken']);
const accessTokenStore = new Map();
const refreshTokenStore = new Map();
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
      return accessTokenStore.get(moduleName) || originalGetItem(key);
    }
    if (isRefreshTokenKey(key)) {
      const moduleName = getModuleFromStorageKey(key);
      return refreshTokenStore.get(moduleName) || originalGetItem(key);
    }
    return originalGetItem(key);
  };

  localStorageRef.setItem = (key, value) => {
    if (isAccessTokenKey(key)) {
      const moduleName = getModuleFromStorageKey(key);
      if (value) accessTokenStore.set(moduleName, String(value));
      else accessTokenStore.delete(moduleName);
      return originalSetItem(key, value);
    }
    if (isRefreshTokenKey(key)) {
      const moduleName = getModuleFromStorageKey(key);
      if (value) refreshTokenStore.set(moduleName, String(value));
      else refreshTokenStore.delete(moduleName);
      return originalSetItem(key, value);
    }
    return originalSetItem(key, value);
  };

  localStorageRef.removeItem = (key) => {
    if (isAccessTokenKey(key)) {
      accessTokenStore.delete(getModuleFromStorageKey(key));
      return originalRemoveItem(key);
    }
    if (isRefreshTokenKey(key)) {
      refreshTokenStore.delete(getModuleFromStorageKey(key));
      return originalRemoveItem(key);
    }
    return originalRemoveItem(key);
  };

  try {
    LEGACY_AUTH_TOKEN_KEYS.forEach((key) => originalRemoveItem(key));
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
      window.sessionStorage?.removeItem(getSessionAccessTokenKey(safeModule));
      window.localStorage?.removeItem(getPersistentAccessTokenKey(safeModule));
    } catch {
    }
    return;
  }
  const normalizedToken = String(token);
  accessTokenStore.set(safeModule, normalizedToken);
  try {
    window.sessionStorage?.setItem(getSessionAccessTokenKey(safeModule), normalizedToken);
    window.localStorage?.setItem(getPersistentAccessTokenKey(safeModule), normalizedToken);
  } catch {
  }
};

export const getAccessToken = (moduleName) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  const inMemoryToken = accessTokenStore.get(safeModule);
  if (inMemoryToken) return inMemoryToken;

  try {
    const sessionToken = window.sessionStorage?.getItem(getSessionAccessTokenKey(safeModule)) || null;
    if (sessionToken) {
      accessTokenStore.set(safeModule, sessionToken);
      return sessionToken;
    }
  } catch {
  }

  try {
    const persistedToken = window.localStorage?.getItem(getPersistentAccessTokenKey(safeModule)) || null;
    if (persistedToken) {
      accessTokenStore.set(safeModule, persistedToken);
      try {
        window.sessionStorage?.setItem(getSessionAccessTokenKey(safeModule), persistedToken);
      } catch {
      }
      return persistedToken;
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
    window.sessionStorage?.removeItem(getSessionAccessTokenKey(safeModule));
    window.localStorage?.removeItem(getPersistentAccessTokenKey(safeModule));
  } catch {
  }
};

export const clearAllAccessTokens = () => {
  installStoragePatch();
  const modules = Array.from(accessTokenStore.keys());
  accessTokenStore.clear();
  try {
    modules.forEach((moduleName) => {
      window.sessionStorage?.removeItem(getSessionAccessTokenKey(moduleName));
      window.localStorage?.removeItem(getPersistentAccessTokenKey(moduleName));
    });
  } catch {
  }
};

export const setRefreshToken = (moduleName, token) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  if (!token) {
    refreshTokenStore.delete(safeModule);
    try {
      window.localStorage?.removeItem(getPersistentRefreshTokenKey(safeModule));
    } catch {
    }
    return;
  }

  const normalizedToken = String(token);
  refreshTokenStore.set(safeModule, normalizedToken);
  try {
    window.localStorage?.setItem(getPersistentRefreshTokenKey(safeModule), normalizedToken);
  } catch {
  }
};

export const getRefreshToken = (moduleName) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  const inMemoryToken = refreshTokenStore.get(safeModule);
  if (inMemoryToken) return inMemoryToken;

  try {
    const persistedToken = window.localStorage?.getItem(getPersistentRefreshTokenKey(safeModule)) || null;
    if (persistedToken) {
      refreshTokenStore.set(safeModule, persistedToken);
      return persistedToken;
    }
  } catch {
  }

  return null;
};

export const clearRefreshToken = (moduleName) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  refreshTokenStore.delete(safeModule);
  try {
    window.localStorage?.removeItem(getPersistentRefreshTokenKey(safeModule));
  } catch {
  }
};

export const clearAllRefreshTokens = () => {
  installStoragePatch();
  const modules = Array.from(refreshTokenStore.keys());
  refreshTokenStore.clear();
  try {
    modules.forEach((moduleName) => {
      window.localStorage?.removeItem(getPersistentRefreshTokenKey(moduleName));
    });
  } catch {
  }
};

export const hasStoredSession = (moduleName) => {
  installStoragePatch();
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const safeModule = String(moduleName || 'user').trim() || 'user';
  return (
    window.localStorage.getItem(getAuthenticatedKey(safeModule)) === 'true' ||
    Boolean(window.localStorage.getItem(getUserKey(safeModule)))
  );
};

export const removeLegacyStoredTokens = (moduleName) => {
  installStoragePatch();
  if (typeof window === 'undefined' || !window.localStorage) return;
  const safeModule = String(moduleName || 'user').trim() || 'user';
  const legacyKeys = [getAccessTokenLegacyKey(safeModule), getRefreshTokenLegacyKey(safeModule)];
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
    AUTH_MODULES.forEach((moduleName) => {
      const token =
        window.sessionStorage.getItem(getSessionAccessTokenKey(moduleName)) ||
        window.localStorage?.getItem(getPersistentAccessTokenKey(moduleName));
      if (token) {
        accessTokenStore.set(moduleName, token);
        try {
          window.sessionStorage.setItem(getSessionAccessTokenKey(moduleName), token);
        } catch {
        }
      }

      const refreshToken =
        window.localStorage?.getItem(getPersistentRefreshTokenKey(moduleName));
      if (refreshToken) {
        refreshTokenStore.set(moduleName, refreshToken);
      }
    });
  } catch {
  }
};
