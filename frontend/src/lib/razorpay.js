import { createPaymentOrder, verifyPayment } from './api';

/**
 * Modern Razorpay Payment Integration
 * Handles order creation, checkout initialization, and payment verification
 */
class RazorpayPayment {
    constructor() {
        this.razorpay = null;
        this.isLoaded = false;
    }

    /**
     * Load Razorpay checkout script if not already loaded
     */
    async loadRazorpay() {
        return new Promise((resolve, reject) => {
            if (this.isLoaded && window.Razorpay) {
                resolve();
                return;
            }

            if (document.querySelector('script[src*="checkout.razorpay.com"]')) {
                // Script is already in DOM, wait for it to load
                const checkLoaded = setInterval(() => {
                    if (window.Razorpay) {
                        clearInterval(checkLoaded);
                        this.isLoaded = true;
                        resolve();
                    }
                }, 100);

                setTimeout(() => {
                    clearInterval(checkLoaded);
                    reject(new Error('Razorpay script failed to load'));
                }, 10000);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => {
                this.isLoaded = true;
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load Razorpay checkout script'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Create a payment order and initialize Razorpay checkout
     * @param {Object} paymentData - Payment data
     * @param {Object} options - Razorpay checkout options
     * @returns {Promise} - Resolves when payment is completed or cancelled
     */
    async createPayment(paymentData, checkoutOptions = {}) {
        try {
            // Ensure Razorpay is loaded
            await this.loadRazorpay();

            // Create payment order on backend
            console.log('[RazorpayPayment] Creating payment order:', paymentData);
            const paymentResponse = await createPaymentOrder(paymentData);

            if (!paymentResponse.data || !paymentResponse.data.razorpay_order_id) {
                throw new Error('Invalid payment order response');
            }

            const orderData = paymentResponse.data;
            console.log('[RazorpayPayment] Payment order created:', orderData);

            // Prepare Razorpay checkout options
            const defaultOptions = {
                key: orderData.razorpay_key_id,
                amount: orderData.razorpay_amount,
                currency: 'INR',
                name: checkoutOptions.name || 'Store Payment',
                description: checkoutOptions.description || orderData.description || 'Payment',
                order_id: orderData.razorpay_order_id,
                prefill: {
                    name: checkoutOptions.prefill?.name || '',
                    email: checkoutOptions.prefill?.email || '',
                    contact: checkoutOptions.prefill?.contact || '',
                    ...checkoutOptions.prefill
                },
                theme: {
                    color: checkoutOptions.theme?.color || '#D4AF37',
                    ...checkoutOptions.theme
                },
                method: {
                    netbanking: true,
                    card: true,
                    upi: true,
                    wallet: true,
                    paylater: false,
                    banktransfer: false,
                    ...checkoutOptions.method
                },
                config: {
                    display: {
                        language: 'en',
                        hide: [
                            { method: 'paylater' },
                            { method: 'banktransfer' },
                            ...(checkoutOptions.config?.display?.hide || [])
                        ],
                        ...checkoutOptions.config?.display
                    },
                    ...checkoutOptions.config
                },
                modal: {
                    backdropclose: false,
                    escape: false,
                    ondismiss: () => {
                        console.log('[RazorpayPayment] Payment cancelled by user');
                        if (checkoutOptions.onCancel) {
                            checkoutOptions.onCancel();
                        }
                    },
                    ...checkoutOptions.modal
                },
                handler: async (response) => {
                    try {
                        console.log('[RazorpayPayment] Payment successful:', response);

                        // Verify payment on backend
                        const verifyData = {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            payment_id: orderData.id
                        };

                        await verifyPayment(verifyData);

                        if (checkoutOptions.onSuccess) {
                            checkoutOptions.onSuccess(response, orderData);
                        }
                    } catch (error) {
                        console.error('[RazorpayPayment] Payment verification failed:', error);
                        if (checkoutOptions.onError) {
                            checkoutOptions.onError(error);
                        }
                    }
                }
            };

            // Merge with any additional options
            const finalOptions = { ...defaultOptions, ...checkoutOptions };

            // Remove our custom handlers from final options to avoid conflicts
            delete finalOptions.onSuccess;
            delete finalOptions.onError;
            delete finalOptions.onCancel;

            console.log('[RazorpayPayment] Opening Razorpay checkout with options:', {
                ...finalOptions,
                key: finalOptions.key ? '***' + finalOptions.key.slice(-4) : 'MISSING'
            });

            // Initialize and open Razorpay checkout
            this.razorpay = new window.Razorpay(finalOptions);

            // Handle payment failure
            this.razorpay.on('payment.failed', (response) => {
                console.error('[RazorpayPayment] Payment failed:', response.error);
                if (checkoutOptions.onError) {
                    checkoutOptions.onError(response.error);
                }
            });

            // Open checkout
            this.razorpay.open();

        } catch (error) {
            console.error('[RazorpayPayment] Payment creation failed:', error);
            if (checkoutOptions.onError) {
                checkoutOptions.onError(error);
            }
            throw error;
        }
    }

    /**
     * Close the current Razorpay checkout
     */
    close() {
        if (this.razorpay) {
            this.razorpay.close();
            this.razorpay = null;
        }
    }
}

// Export singleton instance
export const razorpayPayment = new RazorpayPayment();

// Export convenience functions
export const createRazorpayPayment = (paymentData, options) =>
    razorpayPayment.createPayment(paymentData, options);

export const closeRazorpayPayment = () =>
    razorpayPayment.close();