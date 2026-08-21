import { connectDB, disconnectDB } from '../src/config/db.js';
import { Transaction } from '../src/core/payments/models/transaction.model.js';
import { summarizeOrderDistribution } from '../src/core/payments/reconciliation.service.js';
import { FoodTransaction } from '../src/modules/food/orders/models/foodTransaction.model.js';

function parseArgs(argv = []) {
    const args = { limit: 50, capturedOnly: false };

    for (const rawArg of argv) {
        const arg = String(rawArg || '').trim();
        if (!arg) continue;

        if (arg === '--captured-only') {
            args.capturedOnly = true;
        } else if (arg.startsWith('--limit=')) {
            args.limit = Math.max(1, Number(arg.slice('--limit='.length).trim()) || 50);
        }
    }

    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    await connectDB();

    try {
        const query = args.capturedOnly ? { status: 'captured' } : {};
        const foodTransactions = await FoodTransaction.find(query)
            .sort({ createdAt: -1 })
            .limit(args.limit)
            .lean();

        const orderIds = foodTransactions.map((row) => row.orderId).filter(Boolean);
        const ledgerRows = await Transaction.find({ orderId: { $in: orderIds } }).lean();
        const ledgerByOrder = new Map();

        for (const row of ledgerRows) {
            const key = String(row.orderId || '');
            if (!ledgerByOrder.has(key)) {
                ledgerByOrder.set(key, []);
            }
            ledgerByOrder.get(key).push(row);
        }

        const issues = foodTransactions
            .map((row) => summarizeOrderDistribution(row, ledgerByOrder.get(String(row.orderId || '')) || []))
            .filter((row) => row.missingRestaurantLedger || row.missingDeliveryLedger || row.missingPlatformLedger || !row.hasDistributionHistory);

        console.log(JSON.stringify({
            generatedAt: new Date().toISOString(),
            scanned: foodTransactions.length,
            issueCount: issues.length,
            issues
        }, null, 2));
    } finally {
        await disconnectDB();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
