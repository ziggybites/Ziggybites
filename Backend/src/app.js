import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'mongo-sanitize';
import xssClean from 'xss-clean';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import { privateRateLimiter } from './middleware/rateLimit.js';
import { responseTimeLogger } from './middleware/responseTimeLogger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { healthCheck } from './config/health.js';
import { config } from './config/env.js';
import compression from 'compression';

const app = express();

const allowedOrigins = String(process.env.FRONTEND_URL || config.socketCorsOrigin || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOriginHandler = (origin, callback) => {
    if (!origin) {
        callback(null, true);
        return;
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
    }

    const err = new Error('CORS origin not allowed');
    err.statusCode = 403;
    callback(err);
};

app.use(compression());
app.set('trust proxy', 1);
app.use(requestIdMiddleware);

app.get('/health', async (_req, res) => {
    try {
        const data = await healthCheck();
        res.status(200).json(data);
    } catch (_err) {
        res.status(503).json({ status: 'DOWN', error: 'Health check failed' });
    }
});
app.get('/ready', (_req, res) => {
    res.status(200).json({ status: 'ready' });
});

app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
    hsts: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
    origin: corsOriginHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Zone-Id', 'X-User-Lat', 'X-User-Lng'],
}));
app.use(morgan('dev'));
app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
        if (req.originalUrl && req.originalUrl.includes('/webhook/razorpay')) {
            req.rawBody = buf;
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use((req, _res, next) => {
    req.body = mongoSanitize(req.body);
    req.query = mongoSanitize(req.query);
    req.params = mongoSanitize(req.params);
    next();
});
app.use(xssClean());

app.use('/api', privateRateLimiter);
app.use('/api', responseTimeLogger);
app.use('/api', routes);
app.use(errorHandler);

export default app;
