import mongoose from 'mongoose';

import { connectDB, disconnectDB } from '../src/config/db.js';
import { Transaction } from '../src/core/payments/models/transaction.model.js';
import { compareWalletToLedger } from '../src/core/payments/reconciliation.service.js';
import { FoodUserWallet } from '../src/modules/food/user/models/userWallet.model.js';
import { FoodRestaurantWallet } from '../src/modules/food/restaurant/models/restaurantWallet.model.js';
import { FoodDeliveryWallet } from '../src/modules/food/delivery/models/deliveryWallet.model.js';
import { FoodAdminWallet } from '../src/modules/food/admin/models/adminWallet.model.js';

const ENTITY_CONFIG = {
    user: {
        walletModel: FoodUserWallet,
        walletIdField: 'userId',
        getEmbeddedCount: (wallet) => Array.isArray(wallet?.transactions) ? wallet.transactions.length : 0
    },
    restaurant: {
        walletModel: FoodRestaurantWallet,
        walletIdField: 'restaurantId',
        getEmbeddedCount: () => 0
    },
    deliveryBoy: {
        walletModel: FoodDeliveryWallet,
        walletIdField: 'deliveryPartnerId',
        getEmbeddedCount: () => 0
    },
    admin: {
        walletModel: FoodAdminWallet,
        walletIdField: 'key',
        getWalletKey: () => 'platform',
        getEmbeddedCount: () => 0
    }
};

function parseArgs(argv = []) {
    const args = { entity: 'all', limit: 20 };

    for (const rawArg of argv) {
        const arg = String(rawArg || '').trim();
        if (!arg) continue;

        if (arg.startsWith('--entity=')) {
            args.entity = arg.slice('--entity='.length).trim() || 'all';
        } else if (arg.startsWith('--limit=')) {
            args.limit = Math.max(1, Number(arg.slice('--limit='.length).trim()) || 20);
        }
    }

    return args;
}

async function getLedgerSnapshot(entityType) {
    const adminEntityId = new mongoose.Types.ObjectId('000000000000000000000001');
    const rows = await Transaction.aggregate([
        { $match: { entityType } },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$entityId',
                ledgerBalance: { $first: '$balanceAfter' },
                ledgerTransactionCount: { $sum: 1 }
            }
        }
    ]);

    return new Map(
        rows.map((row) => {
            const key = entityType === 'admin' && String(row._id) === String(adminEntityId) ? 'platform' : String(row._id);
            return [key, row];
        })
    );
}

async function reconcileEntity(entityType, limit) {
    const config = ENTITY_CONFIG[entityType];
    const ledgerSnapshot = await getLedgerSnapshot(entityType);
    const wallets = await config.walletModel.find({}).lean();

    const comparisons = wallets.map((wallet) => {
        const entityId = config.getWalletKey ? config.getWalletKey(wallet) : String(wallet?.[config.walletIdField] || '');
        const ledger = ledgerSnapshot.get(entityId) || {};

        return compareWalletToLedger({
            entityType,
            entityId,
            walletBalance: wallet?.balance || 0,
            ledgerBalance: ledger.ledgerBalance || 0,
            ledgerTransactionCount: ledger.ledgerTransactionCount || 0,
            embeddedTransactionCount: config.getEmbeddedCount(wallet)
        });
    });

    const mismatches = comparisons.filter((row) => row.hasMismatch || row.hasLegacyEmbeddedTransactions);

    return {
        entityType,
        walletCount: comparisons.length,
        issueCount: mismatches.length,
        issues: mismatches.slice(0, limit)
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const entityTypes = args.entity === 'all' ? Object.keys(ENTITY_CONFIG) : [args.entity];

    await connectDB();

    try {
        const results = [];
        for (const entityType of entityTypes) {
            if (!ENTITY_CONFIG[entityType]) {
                throw new Error(`Unsupported entity type: ${entityType}`);
            }
            results.push(await reconcileEntity(entityType, args.limit));
        }

        console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
    } finally {
        await disconnectDB();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
