import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

// This is a placeholder for payment callback handling. Adjust as needed for your payment provider.
const PaymentCallback = () => {
    const navigate = useNavigate();
    const { storeId } = useParams();

    useEffect(() => {
        // Minimal callback: redirect to subscriptions tab (no toast)
        const params = new URLSearchParams(window.location.search);
        const subscriptionId = params.get('subscription_id');
        const target = subscriptionId ? `/store/${storeId}/portal?tab=subscriptions&subscription_id=${subscriptionId}` : `/store/${storeId}/portal?tab=subscriptions`;
        // Short delay to allow UI to show processing state momentarily
        const timer = setTimeout(() => navigate(target), 800);
        return () => clearTimeout(timer);
    }, [navigate, storeId]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center">
            <h1 className="text-2xl font-bold mb-4">Processing Payment...</h1>
            <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
        </div>
    );
};

export default PaymentCallback;
