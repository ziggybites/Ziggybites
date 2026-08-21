export function compareWalletToLedger({
    entityType,
    entityId,
    walletBalance = 0,
    ledgerBalance = 0,
    ledgerTransactionCount = 0,
    embeddedTransactionCount = 0
}) {
    const normalizedWalletBalance = Number(walletBalance || 0);
    const normalizedLedgerBalance = Number(ledgerBalance || 0);
    const delta = normalizedWalletBalance - normalizedLedgerBalance;

    return {
        entityType,
        entityId: String(entityId || ''),
        walletBalance: normalizedWalletBalance,
        ledgerBalance: normalizedLedgerBalance,
        delta,
        ledgerTransactionCount: Number(ledgerTransactionCount || 0),
        embeddedTransactionCount: Number(embeddedTransactionCount || 0),
        hasMismatch: Math.abs(delta) > 0.0001,
        hasLegacyEmbeddedTransactions: Number(embeddedTransactionCount || 0) > 0
    };
}

function hasLedgerCategory(transactions, category, amount) {
    const targetAmount = Number(amount || 0);
    if (targetAmount <= 0) {
        return true;
    }

    return transactions.some((txn) => {
        return txn?.category === category && Math.abs(Number(txn?.amount || 0) - targetAmount) < 0.0001;
    });
}

export function summarizeOrderDistribution(foodTransaction, ledgerTransactions = []) {
    const tx = foodTransaction || {};
    const amounts = tx.amounts || {};
    const history = Array.isArray(tx.history) ? tx.history : [];
    const hasDistributionHistory = history.some((entry) => entry?.kind === 'wallet_distribution_completed');

    return {
        orderId: String(tx.orderId || ''),
        status: tx.status || 'pending',
        paymentMethod: tx.paymentMethod || '',
        hasDistributionHistory,
        missingRestaurantLedger: !hasLedgerCategory(ledgerTransactions, 'restaurant_earning', amounts.restaurantShare),
        missingDeliveryLedger: !hasLedgerCategory(ledgerTransactions, 'delivery_earning', amounts.riderShare),
        missingPlatformLedger: !hasLedgerCategory(ledgerTransactions, 'platform_profit', amounts.platformNetProfit)
    };
}
