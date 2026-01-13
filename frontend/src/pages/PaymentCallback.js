import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import { getStore } from '../lib/api';

const PaymentCallback = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get store information
        const storeRes = await getStore(storeId);
        setStore(storeRes.data);

        // Check payment status from URL parameters
        const razorpay_payment_link_id = searchParams.get('razorpay_payment_link_id');
        const razorpay_payment_id = searchParams.get('razorpay_payment_id');
        const razorpay_payment_link_reference_id = searchParams.get('razorpay_payment_link_reference_id');
        const razorpay_payment_link_status = searchParams.get('razorpay_payment_link_status');

        console.log('Payment callback params:', {
          razorpay_payment_link_id,
          razorpay_payment_id,
          razorpay_payment_link_reference_id,
          razorpay_payment_link_status
        });

        if (razorpay_payment_link_status === 'paid') {
          setPaymentStatus('success');
          toast.success('Payment successful!');

          // Redirect to order details or portal after a short delay
          setTimeout(() => {
            navigate(`/store/${storeId}/portal?tab=orders`);
          }, 3000);
        } else if (razorpay_payment_link_status === 'cancelled') {
          setPaymentStatus('cancelled');
          toast.error('Payment was cancelled');
        } else {
          setPaymentStatus('failed');
          toast.error('Payment failed');
        }

      } catch (error) {
        console.error('Error loading payment callback:', error);
        toast.error('Error processing payment result');
        setPaymentStatus('error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [storeId, searchParams, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <StoreHeader store={store} storeId={storeId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-lg">Processing payment...</p>
          </div>
        </div>
        <StoreFooter store={store} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StoreHeader store={store} storeId={storeId} />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              {paymentStatus === 'success' && <CheckCircle className="h-6 w-6 text-green-500" />}
              {paymentStatus === 'cancelled' && <XCircle className="h-6 w-6 text-yellow-500" />}
              {paymentStatus === 'failed' && <XCircle className="h-6 w-6 text-red-500" />}
              {paymentStatus === 'error' && <XCircle className="h-6 w-6 text-red-500" />}
              Payment {paymentStatus === 'success' ? 'Successful' :
                      paymentStatus === 'cancelled' ? 'Cancelled' :
                      paymentStatus === 'failed' ? 'Failed' : 'Error'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {paymentStatus === 'success' && (
              <>
                <p className="text-green-600">Your payment has been processed successfully!</p>
                <p className="text-sm text-muted-foreground">
                  You will be redirected to your orders page shortly...
                </p>
              </>
            )}

            {paymentStatus === 'cancelled' && (
              <>
                <p className="text-yellow-600">Your payment was cancelled.</p>
                <p className="text-sm text-muted-foreground">
                  You can try again or contact support if you need help.
                </p>
              </>
            )}

            {paymentStatus === 'failed' && (
              <>
                <p className="text-red-600">Your payment could not be processed.</p>
                <p className="text-sm text-muted-foreground">
                  Please try again or contact support for assistance.
                </p>
              </>
            )}

            {paymentStatus === 'error' && (
              <>
                <p className="text-red-600">There was an error processing your payment.</p>
                <p className="text-sm text-muted-foreground">
                  Please contact support for assistance.
                </p>
              </>
            )}

            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => navigate(`/store/${storeId}`)}
                variant="outline"
              >
                Back to Store
              </Button>
              {paymentStatus !== 'success' && (
                <Button
                  onClick={() => navigate(`/store/${storeId}/cart`)}
                >
                  Try Again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <StoreFooter store={store} />
    </div>
  );
};

export default PaymentCallback;