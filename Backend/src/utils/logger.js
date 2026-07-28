let loggerEnabled = true;

export function setLoggerEnabled(enabled) {
    loggerEnabled = enabled !== false;
}

export const logger = {
    info: (msg) => {
        if (loggerEnabled) {
            console.log(`[INFO] ${new Date().toLocaleTimeString()}: ${msg}`);
        }
    },
    error: (msg) => console.error(`[ERROR] ${new Date().toLocaleTimeString()}: ${msg}`),
    warn: (msg) => {
        if (loggerEnabled) {
            console.warn(`[WARN] ${new Date().toLocaleTimeString()}: ${msg}`);
        }
    }
};
