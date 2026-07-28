import { logger } from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
    // Record start time
    const start = Date.now();

    // After response is finished, log the details
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userId: req.user ? req.user.id : undefined,
            requestId: req.requestId || '-'
        };

        const message = `[${logData.requestId}] ${req.method} ${req.originalUrl} ${statusCode} - ${duration}ms`;

        // Don't log health checks as info to avoid spam, use debug
        if (req.originalUrl.includes('/health') || req.originalUrl.includes('/ready')) {
            logger.debug(message, logData);
        } else if (statusCode >= 500) {
            logger.error(message, logData);
        } else if (statusCode >= 400) {
            logger.warn(message, logData);
        } else {
            logger.info(message, logData);
        }
    });

    next();
};
