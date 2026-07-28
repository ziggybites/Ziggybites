import 'dotenv/config';
import { logger } from '../../utils/logger.js';

import './otp.worker.js';
import './notification.worker.js';
import './order.worker.js';
import './payment.worker.js';
import './tracking.worker.js';
import './menuImage.worker.js';

logger.info('All BullMQ workers bootstrapped in a single process');
