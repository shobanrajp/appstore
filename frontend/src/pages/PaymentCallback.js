import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

// This is a placeholder for payment callback handling. Adjust as needed for your payment provider.
const PaymentCallback = () => {
    const navigate = useNavigate();
    const { storeId } = useParams();

    useEffect(() => {
        // Example: parse query params, verify payment, show result, then redirect
        // You may want to call your backend here to verify payment
        toast.success('Payment callback received!');
        // Redirect to portal or order page after a short delay
        const timer = setTimeout(() => {
            navigate(`/store/${storeId}/portal`);
        }, 2000);
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
