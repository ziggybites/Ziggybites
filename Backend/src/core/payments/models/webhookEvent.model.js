import mongoose from 'mongoose';

const webhookEventSchema = new mongoose.Schema(
    {
        provider: { type: String, required: true, trim: true, index: true },
        eventType: { type: String, required: true, trim: true, index: true },
        fingerprint: { type: String, required: true, trim: true },
        resourceId: { type: String, default: '', trim: true, index: true },
        status: {
            type: String,
            enum: ['processing', 'processed', 'failed'],
            default: 'processing',
            index: true
        },
        processedAt: { type: Date, default: null },
        payloadHash: { type: String, default: '', trim: true },
        metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
    },
    {
        collection: 'payment_webhook_events',
        timestamps: true,
    }
);

webhookEventSchema.index({ provider: 1, fingerprint: 1 }, { unique: true });

export const PaymentWebhookEvent = mongoose.model('PaymentWebhookEvent', webhookEventSchema);
