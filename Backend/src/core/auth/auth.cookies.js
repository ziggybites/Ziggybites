export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

const normalizeSameSite = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'strict') return 'Strict';
  if (normalized === 'none') return 'None';
  return 'Lax';
};

const isSecureRequest = (req) => {
  if (req?.secure) return true;
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').toLowerCase();
  return forwardedProto.includes('https');
};

export const getRefreshCookieOptions = (req) => {
  const secure = isSecureRequest(req) || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? normalizeSameSite(process.env.AUTH_COOKIE_SAMESITE || 'lax') : 'Lax',
    path: '/api/v1/food/auth',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  };
};

export const attachRefreshTokenCookie = (req, res, refreshToken) => {
  if (!refreshToken) return;
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshCookieOptions(req));
};

export const clearRefreshTokenCookie = (req, res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getRefreshCookieOptions(req));
};

export const getRefreshTokenFromRequest = (req) => {
  const fromBody = typeof req?.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
  if (fromBody) return fromBody;

  const cookieHeader = String(req?.headers?.cookie || '');
  if (!cookieHeader) return '';

  const cookies = cookieHeader.split(';').map((part) => part.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name === REFRESH_TOKEN_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return '';
};
