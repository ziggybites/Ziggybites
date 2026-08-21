import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import mongoose from 'mongoose';

import { connectDB, disconnectDB } from '../src/config/db.js';
import { logger } from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_ROOT = path.join(__dirname, '..', 'cleanup-output', 'legacy-collections');

const ACTIVE_COLLECTIONS = new Set([
    'account_deletions',
    'appconfigs',
    'food_addons',
    'food_admin_reset_otps',
    'payment_admin_wallets',
    'food_admins',
    'food_categories',
    'payment_delivery_bonus_transactions',
    'payment_delivery_cash_deposits',
    'payment_delivery_cash_limits',
    'payment_delivery_commission_rules',
    'food_delivery_emergency_help',
    'food_delivery_partners',
    'food_delivery_support_tickets',
    'food_delivery_wallets',
    'food_delivery_withdrawals',
    'food_dining_banners',
    'food_dining_bookings',
    'food_dining_categories',
    'food_dining_requests',
    'food_dining_restaurants',
    'food_earning_addon_history',
    'food_earning_addons',
    'food_explore_icons',
    'payment_fee_settings',
    'food_feedback_experiences',
    'food_gourmet_restaurants',
    'food_hero_banners',
    'food_items',
    'food_landing_settings',
    'food_meal_slots',
    'food_notification_broadcasts',
    'food_notifications',
    'food_offer_usages',
    'food_offers',
    'food_orders',
    'food_otps',
    'food_page_contents',
    'food_referral_logs',
    'food_referral_settings',
    'food_refresh_tokens',
    'payment_restaurant_commissions',
    'food_restaurant_menus',
    'food_restaurant_outlet_timings',
    'food_restaurant_support_tickets',
    'payment_restaurant_wallets',
    'payment_restaurant_withdrawals',
    'food_restaurants',
    'food_safety_emergency_reports',
    'food_settings',
    'food_subscription_plans',
    'food_subscription_schedules',
    'food_subscriptions',
    'food_support_tickets',
    'payment_food_transactions',
    'food_under250_banners',
    'payment_user_wallets',
    'food_users',
    'food_zones',
    'foodbusinesssettings',
    'payment_webhook_events',
    'payment_payments',
    'promocodes',
    'payment_refunds',
    'payment_settlements',
    'payment_transactions',
    'payment_delivery_wallets',
]);

const NON_EMPTY_LEGACY_DROP_ALLOWLIST = new Set([
    'businesssettings',
    'environmentvariables',
    'landingpagesettings',
    'subscriptionsettings',
    'users',
]);

const SYSTEM_COLLECTIONS = new Set([
    'system.indexes',
    'system.profile',
]);

function parseArgs(argv = []) {
    return {
        apply: argv.includes('--apply'),
        includeNonEmpty: argv.includes('--include-non-empty'),
    };
}

function stampNow() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function backupCollection(db, collectionName, outputDir) {
    const docs = await db.collection(collectionName).find({}).toArray();
    const filePath = path.join(outputDir, `${collectionName}.json`);
    await fs.writeFile(filePath, `${JSON.stringify(docs, null, 2)}\n`, 'utf8');
    return { filePath, count: docs.length };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    await connectDB();
    const db = mongoose.connection.db;
    const backupDir = path.join(BACKUP_ROOT, stampNow());
    await ensureDir(backupDir);

    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const liveNames = collections
        .map((entry) => String(entry?.name || '').trim())
        .filter(Boolean)
        .sort();

    const candidates = [];
    for (const name of liveNames) {
        if (ACTIVE_COLLECTIONS.has(name) || SYSTEM_COLLECTIONS.has(name)) continue;
        const count = await db.collection(name).estimatedDocumentCount();
        const nonEmptyAllowed = NON_EMPTY_LEGACY_DROP_ALLOWLIST.has(name);
        candidates.push({
            name,
            count,
            canDrop:
                count === 0 ||
                (args.includeNonEmpty && nonEmptyAllowed),
            reason:
                count === 0
                    ? 'empty legacy collection'
                    : nonEmptyAllowed
                        ? 'legacy collection with data eligible when --include-non-empty is passed'
                        : 'non-empty collection skipped for safety',
        });
    }

    console.log('\nLegacy collection cleanup report\n');
    console.table(
        candidates.map((item) => ({
            collection: item.name,
            count: item.count,
            canDrop: item.canDrop,
            reason: item.reason,
        }))
    );

    if (!args.apply) {
        console.log('\nDry run only. Re-run with --apply to drop candidates.');
        console.log('Use --include-non-empty along with --apply to also drop approved non-empty legacy collections after JSON backup.');
        return;
    }

    const dropped = [];
    const skipped = [];

    for (const item of candidates) {
        if (!item.canDrop) {
            skipped.push(item.name);
            continue;
        }

        if (item.count > 0) {
            const backup = await backupCollection(db, item.name, backupDir);
            logger.info(`Backed up ${item.name} (${backup.count} docs) to ${backup.filePath}`);
        }

        await db.collection(item.name).drop().catch((error) => {
            if (error?.codeName === 'NamespaceNotFound') return;
            throw error;
        });

        dropped.push(item.name);
        logger.info(`Dropped legacy collection ${item.name}`);
    }

    console.log('\nCleanup complete.');
    console.log(`Dropped (${dropped.length}): ${dropped.join(', ') || 'none'}`);
    console.log(`Skipped (${skipped.length}): ${skipped.join(', ') || 'none'}`);
    console.log(`Backups saved under: ${backupDir}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await disconnectDB().catch(() => {});
    });
