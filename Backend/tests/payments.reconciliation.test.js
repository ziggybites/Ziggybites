import test from 'node:test';
import assert from 'node:assert/strict';

import { compareWalletToLedger, summarizeOrderDistribution } from '../src/core/payments/reconciliation.service.js';

test('compareWalletToLedger flags mismatched balances and embedded legacy entries', () => {
    const result = compareWalletToLedger({
        entityType: 'user',
        entityId: 'abc123',
        walletBalance: 150,
        ledgerBalance: 100,
        ledgerTransactionCount: 3,
        embeddedTransactionCount: 2
    });

    assert.equal(result.hasMismatch, true);
    assert.equal(result.delta, 50);
    assert.equal(result.hasLegacyEmbeddedTransactions, true);
});

test('summarizeOrderDistribution detects missing ledger legs', () => {
    const result = summarizeOrderDistribution(
        {
            orderId: 'order-1',
            status: 'captured',
            paymentMethod: 'subscription',
            amounts: {
                restaurantShare: 220,
                riderShare: 45,
                platformNetProfit: 35
            },
            history: [{ kind: 'captured' }]
        },
        [
            { category: 'restaurant_earning', amount: 220 },
            { category: 'platform_profit', amount: 35 }
        ]
    );

    assert.equal(result.hasDistributionHistory, false);
    assert.equal(result.missingRestaurantLedger, false);
    assert.equal(result.missingDeliveryLedger, true);
    assert.equal(result.missingPlatformLedger, false);
});
