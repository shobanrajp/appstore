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
import { getStore, getProducts } from '../lib/api';

const CartPage = () => {
  // Shipping is handled on the checkout page now
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, setCart, removeFromCart, updateCartItemQty, cartTotal, cartCount, loadCart, loading: cartLoading } = useCart(storeId);
  const taxAmount = cart?.total_tax || 0;
  
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState({});
  const [processingPayment, setProcessingPayment] = useState(false);
  const [updatingCart, setUpdatingCart] = useState(false);

  const finalTotal = cartTotal + taxAmount;

  useEffect(() => {
    // Cart changes handled; shipping handled on checkout page
  }, [cart]);

  // Load product details for items in cart so images and names render
  useEffect(() => {
    const loadProductsForCart = async () => {
      try {
        const ids = Array.from(new Set((cart.items || []).map(i => i.product_id).filter(Boolean)));
        if (ids.length === 0) {
          setProducts({});
          return;
        }
        const promises = ids.map(id => getProducts(storeId).then(res => {
          // getProducts returns full list; try find the product by id
          return (res.data || []).find(p => p.id === id) || null;
        }).catch(() => null));

        const results = await Promise.all(promises);
        const map = {};
        results.forEach(p => { if (p) map[p.id] = p; });
        setProducts(map);
      } catch (e) {
        console.error('Failed to load products for cart', e);
      }
    };
    loadProductsForCart();
  }, [cart.items, storeId]);

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
      } catch (e) {
        // ignore
      }
    };

    loadStore();
  }, [storeId, navigate]);

  // Address and shipping handled on the checkout page now

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

  // Shipping/address actions removed from cart; checkout handles them

  // Shipping calculation moved to checkout page

  const handleCheckout = async () => {
    // Navigate to checkout page where shipping and payment are handled
    if (!user) {
      toast.error('Please login to proceed to checkout');
      navigate(`/store/${storeId}/login`);
      return;
    }
    navigate(`/store/${storeId}/checkout`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col w-full overflow-x-hidden">
      <StoreHeader store={store} storeId={storeId} cartTotal={cartCount} activeTab="" />
      <LoadingOverlay isLoading={processingPayment || updatingCart} message={processingPayment ? "Processing Payment..." : updatingCart ? "Updating Cart..." : ""} />

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
                    
                    <div className="flex justify-between text-lg font-semibold pt-2">
                      <span>Total</span>
                      <span className="gold-text">{formatCurrency(finalTotal)}</span>
                    </div>
                  </div>

                  {user ? (
                    <div className="space-y-4">
                      <Button className="w-full gold-gradient text-white" onClick={handleCheckout} disabled={cartCount === 0 || processingPayment || cartLoading}>
                        {processingPayment ? 'Processing...' : (cartLoading ? 'Calculating tax...' : 'Proceed to Checkout')}
                      </Button>
                      <p className="text-xs text-muted-foreground">Secure payment powered by Razorpay</p>
                    </div>
                  ) : (
                    <Button className="w-full gold-gradient text-white" onClick={() => navigate(`/store/${storeId}/login`)}>
                      Login to Checkout
                    </Button>
                  )}

                  <div className="text-xs text-muted-foreground">Taxes added as applicable.</div>
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
