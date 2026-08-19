export const AUTH_MODULES = ["user", "restaurant", "delivery", "admin"];

export const SESSION_ACCESS_TOKEN_SUFFIX = "_accessToken_session";

export const getAuthenticatedKey = (moduleName) =>
  `${String(moduleName || "user").trim() || "user"}_authenticated`;

export const getUserKey = (moduleName) =>
  `${String(moduleName || "user").trim() || "user"}_user`;

export const getRefreshTokenLegacyKey = (moduleName) =>
  `${String(moduleName || "user").trim() || "user"}_refreshToken`;

export const getAccessTokenLegacyKey = (moduleName) =>
  `${String(moduleName || "user").trim() || "user"}_accessToken`;

export const getSessionAccessTokenKey = (moduleName) =>
  `${String(moduleName || "user").trim() || "user"}${SESSION_ACCESS_TOKEN_SUFFIX}`;

export const getFcmTokenKey = (moduleName) =>
  `fcm_web_registered_token_${String(moduleName || "user").trim() || "user"}`;

export const DELIVERY_AUTH_FLOW_KEY = "deliveryAuthData";
export const DELIVERY_SIGNUP_DETAILS_KEY = "deliverySignupDetails";
export const DELIVERY_SIGNUP_DOCS_KEY = "deliverySignupDocs";
export const DELIVERY_NEEDS_REGISTRATION_KEY = "deliveryNeedsRegistration";
export const USER_PROFILE_STORAGE_KEY = getUserKey("user");
export const LEGACY_USER_PROFILE_STORAGE_KEYS = [
  "userProfile",
  "appzeto_user_profile",
];

export const LEGACY_AUTH_TOKEN_KEYS = [
  "accessToken",
  "refreshToken",
  ...AUTH_MODULES.flatMap((moduleName) => [
    getAccessTokenLegacyKey(moduleName),
    getRefreshTokenLegacyKey(moduleName),
  ]),
];

const readJsonFromStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearUserProfileStorage = () => {
  if (typeof localStorage === "undefined") return;

  localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
  LEGACY_USER_PROFILE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const writeUserProfileToStorage = (profile) => {
  if (typeof localStorage === "undefined" || !profile) return;

  localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  LEGACY_USER_PROFILE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const readUserProfileFromStorage = ({ migrate = true } = {}) => {
  if (typeof localStorage === "undefined") return null;

  const canonicalProfile = readJsonFromStorage(USER_PROFILE_STORAGE_KEY);
  if (canonicalProfile) {
    return canonicalProfile;
  }

  for (const key of LEGACY_USER_PROFILE_STORAGE_KEYS) {
    const legacyProfile = readJsonFromStorage(key);
    if (!legacyProfile) continue;

    if (migrate) {
      writeUserProfileToStorage(legacyProfile);
    }

    return legacyProfile;
  }

  return null;
};
