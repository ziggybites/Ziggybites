import dns from "node:dns/promises";
import mongoose from "mongoose";

import { connectDB, disconnectDB } from "../src/config/db.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const COLLECTION_RENAMES = [
    ["payments", "payment_payments"],
    ["transactions", "payment_transactions"],
    ["settlements", "payment_settlements"],
    ["refunds", "payment_refunds"],
    ["food_transactions", "payment_food_transactions"],
    ["food_user_wallets", "payment_user_wallets"],
    ["food_restaurant_wallets", "payment_restaurant_wallets"],
    ["food_delivery_wallets", "payment_delivery_wallets"],
    ["food_admin_wallets", "payment_admin_wallets"],
    ["food_restaurant_withdrawals", "payment_restaurant_withdrawals"],
    ["food_delivery_withdrawals", "payment_delivery_withdrawals"],
    ["food_delivery_cash_deposits", "payment_delivery_cash_deposits"],
    ["food_delivery_bonus_transactions", "payment_delivery_bonus_transactions"],
    ["food_delivery_cash_limits", "payment_delivery_cash_limits"],
    ["food_restaurant_commissions", "payment_restaurant_commissions"],
    ["food_delivery_commission_rules", "payment_delivery_commission_rules"],
    ["food_fee_settings", "payment_fee_settings"],
    ["payment_webhook_events", "payment_webhook_events"],
];

function parseArgs(argv = []) {
    return {
        apply: argv.includes("--apply"),
    };
}

async function collectionExists(db, name) {
    const rows = await db.listCollections({ name }, { nameOnly: true }).toArray();
    return rows.length > 0;
}

async function getCount(db, name) {
    if (!(await collectionExists(db, name))) return 0;
    return db.collection(name).estimatedDocumentCount();
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    await connectDB();
    const db = mongoose.connection.db;

    const plan = [];
    for (const [source, target] of COLLECTION_RENAMES) {
        const sourceExists = await collectionExists(db, source);
        const targetExists = await collectionExists(db, target);
        const sourceCount = sourceExists ? await getCount(db, source) : 0;
        const targetCount = targetExists ? await getCount(db, target) : 0;

        let action = "skip";
        let note = "already aligned";

        if (source === target) {
            action = targetExists ? "keep" : "skip";
            note = targetExists ? "already uses payment_ prefix" : "collection not present";
        } else if (sourceExists && !targetExists) {
            action = "rename";
            note = "safe rename";
        } else if (!sourceExists && targetExists) {
            action = "keep";
            note = "target already exists";
        } else if (sourceExists && targetExists) {
            if (sourceCount === 0) {
                action = "drop-empty-source";
                note = "target exists; source empty and can be dropped";
            } else if (targetCount === 0) {
                action = "replace-empty-target";
                note = "target exists but is empty; drop target and rename source";
            } else {
                action = "conflict";
                note = "both source and target contain data; manual merge required";
            }
        } else {
            action = "skip";
            note = "source not present";
        }

        plan.push({ source, target, sourceExists, targetExists, sourceCount, targetCount, action, note });
    }

    console.log("\nPayment collection prefix migration plan\n");
    console.table(plan.map((row) => ({
        source: row.source,
        target: row.target,
        sourceCount: row.sourceCount,
        targetCount: row.targetCount,
        action: row.action,
        note: row.note,
    })));

    const conflicts = plan.filter((row) => row.action === "conflict");
    if (conflicts.length > 0) {
        throw new Error(`Found ${conflicts.length} collection conflicts. Resolve them before applying migration.`);
    }

    if (!args.apply) {
        console.log("\nDry run only. Re-run with --apply to rename/drop source collections.");
        return;
    }

    for (const row of plan) {
        if (row.action === "rename") {
            await db.collection(row.source).rename(row.target);
            console.log(`Renamed ${row.source} -> ${row.target}`);
        } else if (row.action === "replace-empty-target") {
            await db.collection(row.target).drop().catch((error) => {
                if (error?.codeName === "NamespaceNotFound") return;
                throw error;
            });
            await db.collection(row.source).rename(row.target);
            console.log(`Dropped empty target ${row.target} and renamed ${row.source} -> ${row.target}`);
        } else if (row.action === "drop-empty-source") {
            await db.collection(row.source).drop().catch((error) => {
                if (error?.codeName === "NamespaceNotFound") return;
                throw error;
            });
            console.log(`Dropped empty legacy source ${row.source}`);
        }
    }

    console.log("\nPayment collection prefix migration complete.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await disconnectDB().catch(() => {});
    });
