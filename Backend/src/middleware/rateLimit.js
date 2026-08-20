import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { verifyAccessToken } from '../core/auth/token.util.js';

const windowMs = config.rateLimitWindowMinutes * 60 * 1000;
const authWindowMs = config.authRateLimitWindowMinutes * 60 * 1000;

const authOnlyPaths = [
    '/v1/food/auth/user/request-otp',
    '/v1/food/auth/user/verify-otp',
    '/v1/food/auth/restaurant/request-otp',
    '/v1/food/auth/restaurant/verify-otp',
    '/v1/food/auth/delivery/request-otp',
    '/v1/food/auth/delivery/verify-otp',
    '/v1/food/auth/admin/login',
    '/v1/food/auth/admin/forgot-password/request-otp',
    '/v1/food/auth/admin/forgot-password/reset',
    '/v1/food/auth/refresh-token',
    '/v1/food/auth/logout',
    '/v1/auth/user/request-otp',
    '/v1/auth/user/verify-otp',
    '/v1/auth/restaurant/request-otp',
    '/v1/auth/restaurant/verify-otp',
    '/v1/auth/delivery/request-otp',
    '/v1/auth/delivery/verify-otp',
    '/v1/auth/admin/login',
    '/v1/auth/admin/forgot-password/request-otp',
    '/v1/auth/admin/forgot-password/reset',
    '/v1/auth/refresh-token',
    '/v1/auth/logout'
];

const publicPathMatchers = [
    /^\/v1\/health$/,
    /^\/v1\/app-config(?:\/|$)/,
    /^\/v1\/uploads(?:\/|$)/,
    /^\/v1\/payments\/webhook(?:\/|$)/,
    /^\/v1\/food\/search(?:\/|$)/,
    /^\/v1\/food\/admin\/business-settings\/public$/,
    /^\/v1\/food\/dining\/categories\/public$/,
    /^\/v1\/food\/dining\/restaurants\/public$/,
    /^\/v1\/food\/dining\/restaurants\/[^/]+\/occupied-seats\/public$/,
    /^\/v1\/food\/promocodes\/restaurant\/[^/]+$/,
    /^\/v1\/food\/promocodes\/validate$/,
    /^\/v1\/food\/delivery\/register$/,
    /^\/v1\/food\/restaurant\/register$/,
    /^\/v1\/food\/restaurant\/restaurants(?:\/[^/]+(?:\/menu|\/outlet-timings|\/addons)?)?$/,
    /^\/v1\/food\/restaurant\/offers$/,
    /^\/v1\/food\/restaurant\/categories\/public$/,
    /^\/v1\/food\/pages\/[^/]+$/,
    /^\/v1\/food\/referral-settings$/,
    /^\/v1\/food\/app-customization\/public$/,
    /^\/v1\/food\/meal-slots\/public$/,
    /^\/v1\/food\/subscription-plans\/public$/,
    /^\/v1\/food\/hero-banners\/public$/,
    /^\/v1\/food\/hero-banners\/under-250\/public$/,
    /^\/v1\/food\/hero-banners\/ads\/public$/,
    /^\/v1\/food\/explore-icons\/public$/,
    /^\/v1\/food\/hero-banners\/gourmet\/public$/,
    /^\/v1\/food\/landing\/settings\/public$/,
    /^\/v1\/food\/zones\/detect$/,
    /^\/v1\/food\/zones\/nearby$/,
    /^\/v1\/food\/zones\/public$/,
    /^\/v1\/food\/public\/env$/,
    /^\/v1\/fcm-tokens\/check$/,
    /^\/fcm-tokens\/check$/
];

const getRequestPath = (req) => req.path;
const getAuthenticatedRateLimitKey = (req) => {
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
        return null;
    }

    try {
        const decoded = verifyAccessToken(token);
        if (decoded?.userId && decoded?.role) {
            return `user:${decoded.role}:${decoded.userId}`;
        }
    } catch (_error) {
        // Ignore invalid tokens here and fall back to IP-based limiting.
    }

    return null;
};

const isAuthOnlyPath = (req) => authOnlyPaths.includes(getRequestPath(req));
const isPublicPath = (req) => publicPathMatchers.some((pattern) => pattern.test(getRequestPath(req)));
const isRateLimitDisabled = () => !config.rateLimitEnabled;
const getPrivateMax = () => config.nodeEnv === 'development'
    ? config.rateLimitDevMaxRequests
    : config.rateLimitMaxRequests;

export const privateRateLimiter = rateLimit({
    windowMs,
    max: getPrivateMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getAuthenticatedRateLimitKey(req) || `ip:${req.ip}`,
    skip: (req) => isRateLimitDisabled() || isPublicPath(req) || isAuthOnlyPath(req),
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});

export const authRateLimiter = rateLimit({
    windowMs: authWindowMs,
    max: () => config.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isRateLimitDisabled(),
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again later.'
    }
});

export const uploadRateLimiter = rateLimit({
    windowMs,
    max: getPrivateMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isRateLimitDisabled(),
    keyGenerator: (req) => {
        if (req.user?.userId) {
            return `user:${req.user.userId}`;
        }

        return `ip:${req.ip}`;
    },
    message: {
        success: false,
        message: 'Too many upload requests, please try again later.'
    }
});
