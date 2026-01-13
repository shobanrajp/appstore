import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import LoadingOverlay from '../components/LoadingOverlay';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Minus, Plus, X, ShoppingCart, AlertTriangle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatCurrency, setPageTitle, getImageUrl } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { getAddresses, createAddress, createOrder, createPaymentOrder, verifyPayment, getStore, getProducts, estimateShipping } from '../lib/api';

const CartPage = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, removeFromCart, updateCartItemQty, cartTotal, cartCount } = useCart(storeId);
  const taxAmount = cart?.total_tax || 0;
  
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState({});
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [shipping, setShipping] = useState(null);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [updatingCart, setUpdatingCart] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '',
    city: '', state: '', postal_code: '', country: 'India', special_instructions: '', is_default: false
  });

  const finalTotal = cartTotal + taxAmount + (shipping?.shipping_charges || 0);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Load store details for Razorpay key and currency
  useEffect(() => {
    const loadStore = async () => {
      try {
        const res = await getStore(storeId);
        setStore(res.data);
        setPageTitle(res.data, 'Cart');
      } catch (error) {
        console.error('Failed to load store:', error);
      }
    };
    if (storeId) loadStore();
  }, [storeId]);

  // Load products to display cart item details
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await getProducts(storeId);
        const productMap = {};
        (res.data || []).forEach(p => {
          productMap[p.id] = p;
        });
        setProducts(productMap);
      } catch (error) {
        console.error('Failed to load products:', error);
      }
    };
    if (storeId) loadProducts();
  }, [storeId]);

  useEffect(() => {
    // Optionally load store details for currency/name in header
    // Keep lightweight: reuse lastVisitedStore if needed
    try {
      const lastStore = localStorage.getItem('lastVisitedStore');
      if (!storeId && lastStore) navigate(`/store/${lastStore}/cart`, { replace: true });
    } catch {}
  }, [storeId, navigate]);

  useEffect(() => {
    const loadAddresses = async () => {
      if (!user) return;
      try {
        const res = await getAddresses();
        setAddresses(res.data);
        if (res.data.length > 0) {
          const def = res.data.find(a => a.is_default) || res.data[0];
          setSelectedAddress(def.id);
        }
      } catch (e) {}
    };
    loadAddresses();
  }, [user]);

  // Auto-calculate shipping when address changes
  useEffect(() => {
    const handler = setTimeout(() => {
        const checkShipping = async () => {
            if (!selectedAddress || !cart?.items?.length) {
                setShipping(null);
                return;
            }
            
            const addr = addresses.find(a => a.id === selectedAddress);
            if (!addr || !addr.postal_code) return;

            setCalculatingShipping(true);
            try {
                const res = await estimateShipping(storeId, {
                    items: cart.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
                    postal_code: addr.postal_code
                });
                setShipping(res.data);
            } catch (error) {
                console.error("Shipping calc error", error);
                setShipping({ shipping_charges: 0, error: true });
            } finally {
                setCalculatingShipping(false);
            }
        };
        checkShipping();
    }, 800); // Debounce for 800ms

    return () => clearTimeout(handler);
  }, [selectedAddress, cart?.items, addresses, storeId]);

  const updateQuantity = async (itemId, delta) => {
    setUpdatingCart(true);
    try {
      const items = cart.items || [];
      const item = items.find(it => it.id === itemId);
      if (item) {
        const newQty = item.quantity + delta;
        if (newQty > 0) {
          await updateCartItemQty(itemId, newQty);
        } else {
          // useCart hook's removeFromCart expects product_id, not item_id
          await removeFromCart(item.product_id);
        }
      }
    } catch (error) {
      console.error("Failed to update cart", error);
    } finally {
      setUpdatingCart(false);
    }
  };

  const handleRemoveItem = async (productId) => {
      setUpdatingCart(true);
      try {
          await removeFromCart(productId);
      } catch (error) {
          console.error("Failed to remove item", error);
      } finally {
          setUpdatingCart(false);
      }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      const res = await createAddress(newAddress);
      setAddresses([...addresses, res.data]);
      setSelectedAddress(res.data.id);
      setShowNewAddress(false);
      setNewAddress({
        label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '',
        city: '', state: '', postal_code: '', country: 'India', special_instructions: '', is_default: false
      });
      toast.success('Address added');
    } catch (error) {
      toast.error('Failed to add address');
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Please login to proceed to checkout');
      navigate(`/store/${storeId}/login`);
      return;
    }
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }
    if (!store || !store.razorpay_key_id) {
      toast.error('Payment gateway not configured for this store');
      return;
    }

    setProcessingPayment(true);

    try {
      // Create order first
      const orderRes = await createOrder(storeId, {
        items: (cart.items || []).map(item => ({ product_id: item.product_id, quantity: item.quantity, price: item.price })),
        shipping_address_id: selectedAddress,
      });

      // Create Razorpay payment order
      const paymentRes = await createPaymentOrder({
        amount: finalTotal,
        currency: store.currency || 'INR',
        description: `Order ${orderRes.data.id}`,
        store_id: storeId,
        order_id: orderRes.data.id,
      });

      // Open Razorpay checkout
      const options = {
        key: store.razorpay_key_id,
        amount: Math.round(finalTotal * 100), // Amount in paise
        currency: store.currency || 'INR',
        name: store.name || 'Store',
        description: `Order ${orderRes.data.id}`,
        order_id: paymentRes.data.razorpay_order_id,
        handler: async function (response) {
          try {
            // Verify payment on backend
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              payment_id: paymentRes.data.id,
            });
            toast.success('Payment successful! Order placed.');
            setCart([]);
            // Ensure lastVisitedStore is saved for customer portal redirect
            localStorage.setItem('lastVisitedStore', storeId);
            // Redirect to order detail page with order ID
            const orderDetailUrl = `/store/${storeId}/portal?tab=orders&order=${orderRes.data.id}`;
            console.log('Redirecting to:', orderDetailUrl);
            navigate(orderDetailUrl);
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed');
          } finally {
            setProcessingPayment(false);
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: {
          color: '#D4AF37',
        },
        modal: {
          ondismiss: function() {
            setProcessingPayment(false);
            toast.info('Payment cancelled');
          },
          escape: false,
          backdropclose: false
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        console.error('Razorpay payment failed:', response.error);
        setProcessingPayment(false);
        toast.error(response.error.description || 'Payment failed');
      });
      rzp.open();
    } catch (error) {
      setProcessingPayment(false);
      toast.error(error.response?.data?.detail || 'Checkout failed');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col w-full overflow-x-hidden">
      <StoreHeader store={store} storeId={storeId} cartTotal={cartCount} activeTab="" />
      <LoadingOverlay isLoading={processingPayment || updatingCart || calculatingShipping} message={processingPayment ? "Processing Payment..." : updatingCart ? "Updating Cart..." : "Calculating Shipping..."} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <h1 className="text-3xl font-serif mb-6 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6" /> Your Cart
        </h1>

        {(!cart?.items || cart.items.length === 0) ? (
          <Card className="border">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Your cart is empty</p>
              <div className="mt-4">
                <Link to={`/store/${storeId}/products`}>
                  <Button variant="outline">Browse Products</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {(cart.items || []).map((item) => {
                const product = products[item.product_id];
                return (
                  <Card key={item.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                          <Link to={`/store/${storeId}/product/${item.product_id}`} className="shrink-0">
                            <div className="w-16 h-16 rounded bg-muted overflow-hidden hover:opacity-90">
                              {product?.images?.[0] ? (
                                <img src={getImageUrl(product.images[0])} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full gold-gradient opacity-20" />
                              )}
                            </div>
                          </Link>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{product?.name || 'Product'}</p>
                            <p className="text-sm text-muted-foreground">{formatCurrency(item.price)} × {item.quantity}</p>
                            {item.tax_info && (item.tax_info.cgst > 0 || item.tax_info.igst > 0) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                + Tax: {formatCurrency(item.tax_info.cgst + item.tax_info.igst)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, -1)} disabled={updatingCart}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, 1)} disabled={updatingCart}>
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(item.product_id)} disabled={updatingCart}>
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div>
              <Card className="border">
                <CardContent className="p-6 space-y-4 relative">
                  <div className="space-y-2 pb-4 border-b">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    {taxAmount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tax</span>
                        <span>{formatCurrency(taxAmount)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-muted-foreground">
                        <span>Shipping</span>
                        {calculatingShipping ? (
                            <span>Calculating...</span>
                        ) : shipping ? (
                            shipping.error ? <span className="text-destructive text-xs">Unavailable</span> :
                            <span>{shipping.shipping_charges === 0 ? 'Free' : formatCurrency(shipping.shipping_charges)}</span>
                        ) : (
                            <span>-</span>
                        )}
                    </div>

                    <div className="flex justify-between text-lg font-semibold pt-2">
                      <span>Total</span>
                      <span className="gold-text">{formatCurrency(finalTotal)}</span>
                    </div>
                    {shipping && shipping.etd && !shipping.error && (
                      <div className="flex justify-between text-sm text-green-600 mt-1">
                        <span>Estimated Delivery</span>
                        <span>{shipping.etd}</span>
                      </div>
                    )}
                  </div>

                  {user ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Delivery Address</Label>
                        {addresses.length > 0 ? (
                          <Select value={selectedAddress} onValueChange={setSelectedAddress}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select address" />
                            </SelectTrigger>
                            <SelectContent>
                              {addresses.map((addr) => (
                                <SelectItem key={addr.id} value={addr.id}>
                                  {addr.label}: {addr.full_name} ({addr.phone}) - {addr.address_line1}, {addr.city}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-muted-foreground">No addresses saved</p>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setShowNewAddress(v => !v)}>
                          {showNewAddress ? 'Cancel' : 'Add New Address'}
                        </Button>
                      </div>

                      {showNewAddress && (
                        <form onSubmit={handleAddAddress} className="space-y-3 p-3 border rounded">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label>Label</Label>
                              <Select value={newAddress.label} onValueChange={(v) => setNewAddress({ ...newAddress, label: v })}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Home">Home</SelectItem>
                                  <SelectItem value="Work">Work</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label>Full Name</Label>
                              <Input value={newAddress.full_name} onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })} required />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label>Phone</Label>
                            <Input value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} required />
                          </div>
                          <div className="space-y-1">
                            <Label>Address Line 1</Label>
                            <Input value={newAddress.address_line1} onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })} required />
                          </div>
                          <div className="space-y-1">
                            <Label>Address Line 2</Label>
                            <Input value={newAddress.address_line2} onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label>City</Label>
                              <Input value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} required />
                            </div>
                            <div className="space-y-1">
                              <Label>State</Label>
                              <Input value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} required />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label>Postal Code</Label>
                              <Input value={newAddress.postal_code} onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })} required />
                            </div>
                            <div className="space-y-1">
                              <Label>Country</Label>
                              <Input value={newAddress.country} disabled />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label>Special Instructions (Optional)</Label>
                            <Input placeholder="e.g., Ring doorbell twice, leave at gate" value={newAddress.special_instructions} onChange={(e) => setNewAddress({ ...newAddress, special_instructions: e.target.value })} />
                          </div>
                          <Button type="submit" className="w-full gold-gradient text-white">Save Address</Button>
                        </form>
                      )}

                      <Button className="w-full gold-gradient text-white" onClick={handleCheckout} disabled={!selectedAddress || cart.length === 0 || processingPayment || calculatingShipping || !shipping || (shipping && shipping.error)}>
                        {processingPayment ? 'Processing...' : 'Proceed to Payment'}
                      </Button>
                      <p className="text-xs text-muted-foreground">Secure payment powered by Razorpay</p>
                      
                      {shipping && shipping.error && (
                          <div className="p-2 text-xs text-red-600 bg-red-50 rounded border border-red-100 flex items-center gap-2">
                              <AlertTriangle className="w-3 h-3" />
                              Shipping unavailable for this address
                          </div>
                      )}
                    </div>
                  ) : (
                    <Button className="w-full gold-gradient text-white" onClick={() => navigate(`/store/${storeId}/login`)}>
                      Login to Checkout
                    </Button>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Taxes added as applicable.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <StoreFooter store={store} storeId={storeId} />
      <LoadingOverlay isLoading={processingPayment} />
    </div>
  );
};

export default CartPage;
