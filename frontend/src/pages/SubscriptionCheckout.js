import React, { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';

const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load script'));
        document.body.appendChild(s);
    });
};

const SubscriptionCheckout = () => {
    const { storeId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const payment_id = params.get('payment_id');
        const order_id = params.get('order_id');
        const key_id = params.get('key_id');
        const amount = params.get('amount');

        if (!payment_id || !order_id || !key_id) {
            toast.error('Invalid payment link');
            navigate(-1);
            return;
        }

        (async () => {
            try {
                console.log('[SubscriptionCheckout] params', { payment_id, order_id, key_id, amount });
                toast.info('Starting payment...');

                await loadScript('https://checkout.razorpay.com/v1/checkout.js');

                if (!window.Razorpay) {
                    throw new Error('Razorpay script did not load');
                }

                const options = {
                    key: key_id,
                    order_id: order_id,
                    amount: amount ? Number(amount) : undefined,
                    currency: 'INR',
                    name: 'Store Payment',
                    description: 'Subscription payment',
                    handler: async function (response) {
                        try {
                            // Notify backend that payment completed (marks subscription payment)
                            const completeRes = await api.post(`/payments/${payment_id}/complete`);
                            const createdSubId = completeRes?.data?.subscription_id;
                            if (createdSubId) {
                                navigate(`/store/${storeId}/portal?tab=subscriptions&subscription_id=${createdSubId}`);
                                return;
                            }
                        } catch (e) {
                            console.error('Failed to mark payment complete', e);
                        }
                        navigate(`/store/${storeId}/payment/callback`);
                    },
                    modal: {
                        ondismiss: function () {
                            toast.error('Payment cancelled');
                            navigate(-1);
                        }
                    }
                };

                // Open checkout
                const rzp = new window.Razorpay(options);
                try {
                    rzp.open();
                    console.log('[SubscriptionCheckout] Razorpay.open called');
                } catch (openErr) {
                    console.error('[SubscriptionCheckout] rzp.open error', openErr);
                    throw openErr;
                }
            } catch (err) {
                console.error('[SubscriptionCheckout] Error opening checkout', err);
                toast.error('Failed to start payment. Please try again.');
                navigate(-1);
            }
        })();

        // Cleanup not required
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
        </div>
    );
};

export default SubscriptionCheckout;
