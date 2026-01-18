// Razorpay helper - creates a server-side payment order and returns a client checkout URL
import { createPaymentOrder } from './api';

export async function createRazorpayPaymentLink(options = {}, customerInfo = {}) {
    // Build payload expected by backend
    const payload = {
        amount: options.amount,
        description: options.description,
        subscription_id: options.subscription_id,
        order_id: options.order_id,
        store_id: options.store_id
    };
    if (options.subscription_payload) payload.subscription_payload = options.subscription_payload;

    // Call backend to create a Razorpay order (and store a payment record)
    const res = await createPaymentOrder(payload);
    const data = res.data;

    // Construct a client-side checkout URL that will open Razorpay checkout using returned order id
    const shortUrl = `/store/${options.store_id}/payment/checkout?payment_id=${encodeURIComponent(data.id)}&order_id=${encodeURIComponent(data.razorpay_order_id)}&key_id=${encodeURIComponent(data.razorpay_key_id || '')}&amount=${encodeURIComponent(data.razorpay_amount || '')}`;

    return {
        ...data,
        shortUrl,
        url: shortUrl
    };
}
