import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import LoadingOverlay from '../components/LoadingOverlay';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { getAddresses, createAddress, createOrder, createPaymentOrder, verifyPayment, getStore, estimateShipping, deleteOrder } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { useRef } from 'react';

const CheckoutPage = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, loadCart } = useCart(storeId);

  const [store, setStore] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(location.state?.selectedAddress || '');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: 'India', special_instructions: '', is_default: false
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [shipping, setShipping] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const pendingEstimateRef = useRef(false);
  const rzpWaitingRef = useRef(false);
  const skipEstimateRef = useRef(false);
  const paymentCompletedRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await getStore(storeId);
        setStore(res.data);
      } catch (e) {}

      // ensure cart is fresh (server may compute shipping)
      // If backend computed a fresh shipping estimate, reuse it and skip local estimate.
      try {
        const c = await loadCart(true);
        const se = (c && c.shipping_estimate) ? c.shipping_estimate : null;
        if (se && se.fetched_at) {
          // if estimate is recent (within 60 seconds), reuse it
          const fetched = Date.parse(se.fetched_at);
          if (!isNaN(fetched) && (Date.now() - fetched) < 60000) {
            setShipping(se);
            skipEstimateRef.current = true;
          }
        }
      } catch (e) {
        // ignore
      }
    };

    init();
    // avoid depending on `loadCart` (it can change identity) to prevent effect loops
  }, [storeId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadAddresses = async () => {
      if (!user) return;
      try {
        const res = await getAddresses();
        setAddresses(res.data);
        if (!selectedAddress && res.data.length > 0) {
          const def = res.data.find(a => a.is_default) || res.data[0];
          setSelectedAddress(def.id);
        }
      } catch (e) {}
    };
    loadAddresses();
  }, [user]);

  // When the user selects an address, compute shipping via API and show full address
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = setTimeout(() => {
      const compute = async () => {
        if (!selectedAddress || !cart) {
          setShipping(null);
          return;
        }
        // If backend already provided a fresh estimate while loading the cart, skip
        if (skipEstimateRef.current) {
          // clear the flag so subsequent address changes will compute
          skipEstimateRef.current = false;
          return;
        }
        const addr = addresses.find(a => a.id === selectedAddress);
        if (!addr || !addr.postal_code) {
          setShipping(null);
          return;
        }

        try {
          if (pendingEstimateRef.current) return;
          pendingEstimateRef.current = true;
          setShippingLoading(true);
          const items = (cart.items || []).map(it => ({ product_id: it.product_id, quantity: it.quantity }));
          const res = await estimateShipping(storeId, { items, postal_code: addr.postal_code });
          setShipping(res.data);
        } catch (err) {
          console.warn('estimateShipping failed', err);
          setShipping(null);
        } finally {
          pendingEstimateRef.current = false;
          setShippingLoading(false);
        }
      };
      compute();
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedAddress, cart, addresses, storeId]);

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      const res = await createAddress(newAddress);
      setAddresses([...addresses, res.data]);
      setSelectedAddress(res.data.id);
      setShowNewAddress(false);
      toast.success('Address added');
    } catch (err) {
      toast.error('Failed to add address');
    }
  };

  const taxAmount = cart?.total_tax || 0;
  const subtotal = (cart?.items || []).reduce((s, it) => s + (it.price * it.quantity), 0);
  const shippingCharges = shipping && !shipping.error ? (shipping.shipping_charges || 0) : 0;
  const finalTotal = subtotal + taxAmount + shippingCharges;

  // Load Razorpay script if needed
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const handlePay = async () => {
    if (!user) {
      toast.error('Please login to continue');
      navigate(`/store/${storeId}/login`);
      return;
    }
    if (!selectedAddress) {
      toast.error('Select a shipping address');
      return;
    }
    paymentCompletedRef.current = false;
    rzpWaitingRef.current = false;

    setProcessingPayment(true);

    // Ensure cart is fresh
    await loadCart(true);
    if (!cart || !cart.items || cart.items.length === 0) {
      toast.error('Cart is empty');
      setProcessingPayment(false);
      return;
    }
    if (!shipping || shipping.error) {
      toast.error('Shipping not available for selected address');
      setProcessingPayment(false);
      return;
    }
    let currentOrder = null;
    try {
      // Create order on server (will snapshot cart tax etc)
      const orderPayload = {
        items: (cart.items || []).map(it => ({ product_id: it.product_id, quantity: it.quantity, price: it.price })),
        shipping_address_id: selectedAddress,
        shipping_charges: shipping.shipping_charges,
        total_tax: taxAmount
      };

      const { data: createdOrder } = await createOrder(storeId, orderPayload);
      currentOrder = createdOrder;

      let cancellationHandled = false;

      function onWindowFocus() {
        if (paymentCompletedRef.current) {
          try { window.removeEventListener('focus', onWindowFocus); } catch (e) {}
          return;
        }
        if (rzpWaitingRef.current) {
          setProcessingPayment(true);
          rzpWaitingRef.current = false;
          try { window.removeEventListener('focus', onWindowFocus); } catch (e) {}
        }
      }

      async function cleanupPendingOrder(message, { showToast = true, reloadCart = true } = {}) {
        if (paymentCompletedRef.current || cancellationHandled) return;
        cancellationHandled = true;
        try {
          if (currentOrder?.id) {
            await deleteOrder(storeId, currentOrder.id);
          }
        } catch (delErr) {
          console.warn('Failed to delete pending order', delErr);
        } finally {
          rzpWaitingRef.current = false;
          try { window.removeEventListener('focus', onWindowFocus); } catch (e) {}
          setProcessingPayment(false);
          if (reloadCart) {
            try {
              await loadCart(true);
            } catch (cartErr) {
              console.warn('Failed to reload cart after cancellation', cartErr);
            }
          }
          if (showToast && message) {
            toast.error(message);
          }
        }
      }

      // Create Razorpay order
      const paymentData = {
        amount: currentOrder.total_amount,
        description: `Order ${currentOrder.id}`,
        order_id: currentOrder.id,
        store_id: storeId
      };
      const { data: paymentOrder } = await createPaymentOrder(paymentData);

      const options = {
        key: paymentOrder.razorpay_key_id,
        amount: paymentOrder.amount * 100,
        currency: 'INR',
        name: store?.name || 'Store Payment',
        description: paymentOrder.description,
        order_id: paymentOrder.razorpay_order_id,
        handler: async function (response) {
          paymentCompletedRef.current = true;
          // Ensure overlay is visible during server-side verification
          setProcessingPayment(true);
          try {
            const verifyData = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              payment_id: paymentOrder.id
            };
            await verifyPayment(verifyData);
            // Refresh cart from server so frontend reflects cleared cart
            try {
              await loadCart(true);
            } catch (e) {
              console.warn('Failed to reload cart after payment', e);
            }
            toast.success('Payment successful');
            navigate(`/store/${storeId}/portal?tab=orders`);
          } catch (verifyErr) {
            console.error(verifyErr);
            toast.error(verifyErr.response?.data?.detail || 'Payment verification failed');
          } finally {
            rzpWaitingRef.current = false;
            try { window.removeEventListener('focus', onWindowFocus); } catch(e) {}
            setProcessingPayment(false);
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone
        },
        theme: { color: store?.settings?.primary_color || '#3399cc' },
        modal: {
          ondismiss: () => {
            cleanupPendingOrder('Payment cancelled');
          }
        }
      };

      const rzp = new window.Razorpay(options);

      window.addEventListener('focus', onWindowFocus);
      // Mark that we are waiting for the popup to close
      rzpWaitingRef.current = true;

      rzp.on('payment.failed', async function (resp) {
        toast.error(resp.error.description || 'Payment failed');
        await cleanupPendingOrder(null, { showToast: false });
      });

      try {
        rzp.open();
      } finally {
        // Hide overlay once Razorpay modal is launched unless payment already completed
        if (!paymentCompletedRef.current) {
          setProcessingPayment(false);
        }
      }

    } catch (err) {
      console.error(err);
      if (currentOrder?.id && !paymentCompletedRef.current) {
        try {
          await deleteOrder(storeId, currentOrder.id);
        } catch (cleanupErr) {
          console.warn('Failed to rollback pending order after initiation error', cleanupErr);
        }
      }
      toast.error(err.response?.data?.detail || 'Payment initiation failed');
      setProcessingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col w-full overflow-x-hidden">
      <StoreHeader store={store} storeId={storeId} cartTotal={cart?.items?.length || 0} activeTab="" />
      <LoadingOverlay isLoading={processingPayment || shippingLoading} message={processingPayment ? 'Processing Payment...' : (shippingLoading ? 'Calculating shipping...' : '')} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <h1 className="text-2xl font-serif mb-4">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <Label>Delivery Address</Label>
                  {addresses.length > 0 ? (
                    <div>
                      <Select value={selectedAddress} onValueChange={setSelectedAddress}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select address" />
                        </SelectTrigger>
                        <SelectContent>
                          {addresses.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.label}: {a.full_name} - {a.address_line1}, {a.city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedAddress && (() => {
                        const addr = addresses.find(a => a.id === selectedAddress);
                        if (!addr) return null;
                        return (
                          <div className="mt-3 p-3 border rounded bg-muted/5">
                            <div className="text-sm font-medium">{addr.label} — {addr.full_name}</div>
                            <div className="text-sm">{addr.address_line1}{addr.address_line2 ? ', ' + addr.address_line2 : ''}</div>
                            <div className="text-sm">{addr.city}, {addr.state} - {addr.postal_code}</div>
                            <div className="text-sm">{addr.phone}</div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No addresses saved</p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowNewAddress(v => !v)}>{showNewAddress ? 'Cancel' : 'Add New Address'}</Button>
                  </div>

                  {showNewAddress && (
                    <form onSubmit={handleAddAddress} className="space-y-3 p-3 border rounded mt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Label</Label>
                          <Input value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} />
                        </div>
                        <div>
                          <Label>Full Name</Label>
                          <Input value={newAddress.full_name} onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })} required />
                        </div>
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} required />
                      </div>
                      <div>
                        <Label>Address Line 1</Label>
                        <Input value={newAddress.address_line1} onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })} required />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>City</Label>
                          <Input value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} required />
                        </div>
                        <div>
                          <Label>State</Label>
                          <Input value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} required />
                        </div>
                      </div>
                      <Button type="submit" className="gold-gradient text-white">Save Address</Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Order items removed from checkout page per request */}
          </div>

          <div>
            <Card className="border">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>{shipping ? (shipping.error ? 'Unavailable' : (shipping.shipping_charges === 0 ? 'Free' : formatCurrency(shipping.shipping_charges))) : '-'}</span>
                </div>
                {shipping && shipping.etd && !shipping.error && (
                  <div className="text-sm gold-text">Est. delivery: {String(shipping.etd)}</div>
                )}

                <div className="flex justify-between text-lg font-semibold pt-2">
                  <span>Total</span>
                  <span className="gold-text">{formatCurrency(finalTotal)}</span>
                </div>

                <Button className="w-full gold-gradient text-white" onClick={handlePay} disabled={!shipping || shipping.error || processingPayment}>
                  {processingPayment ? 'Processing...' : 'Pay Now'}
                </Button>
                <div className="text-xs text-muted-foreground">You will be redirected to a secure Razorpay checkout.</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <StoreFooter store={store} storeId={storeId} />
    </div>
  );
};

export default CheckoutPage;
