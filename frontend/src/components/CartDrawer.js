import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { estimateShipping, getStore, getAddresses } from '../lib/api';
import { Button } from './ui/button';
import { Plus, Minus, X, CreditCard } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useCart } from '../context/CartContext';
import { getStore } from '../lib/api';

const CartDrawer = () => {
    const params = useParams();
    const paramStoreId = params?.storeId;
    const fallbackStore = typeof window !== 'undefined' ? localStorage.getItem('lastVisitedStore') : null;
    const currentStoreId = paramStoreId || fallbackStore;
    const { cart, updateCartItemQty, removeFromCart, cartOpen, setCartOpen, cartTotal } = useCart(currentStoreId);
    const [store, setStore] = useState(null);
    const [pincode, setPincode] = useState('');
    const [shipping, setShipping] = useState(null);
    const [calculating, setCalculating] = useState(false);
    const [defaultAddress, setDefaultAddress] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!currentStoreId) return;
            try {
                const res = await getStore(currentStoreId);
                if (mounted) setStore(res.data);
            } catch (e) {}
        };
        const loadUserAddress = async () => {
             if (user) {
                 try {
                     const res = await getAddresses();
                     if (res.data && res.data.length > 0) {
                         const def = res.data.find(a => a.is_default) || res.data[0];
                         if (def && mounted) {
                             if (def.postal_code) setPincode(def.postal_code);
                             setDefaultAddress(def);
                         }
                     }
                 } catch (e) {}
             }
        };
        
        load();
        loadUserAddress();
        
        return () => { mounted = false; };
    }, [currentStoreId, user]);

    useEffect(() => {
        if (pincode && pincode.length >= 6 && cart?.items?.length > 0 && cartOpen) {
            // Auto check shipping if pincode is present (e.g. from user profile)
            // But verify we haven't already checked (unless cart changed?)
            // For simplicity, just check it.
            checkShipping();
        }
    }, [pincode, cartOpen]); // Depend on pincode (loaded from user) and drawer open

    const navigate = useNavigate();

    const checkShipping = async () => {
        if (!pincode || pincode.length < 6) return;
        setCalculating(true);
        try {
            const res = await estimateShipping(currentStoreId, {
                items: cart.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
                postal_code: pincode
            });
            setShipping(res.data);
        } catch (error) {
            console.error("Shipping calc error", error);
            setShipping({ shipping_charges: 0, error: true });
        } finally {
            setCalculating(false);
        }
    };

    const handleCheckout = () => {
        if (!user) {
            setCartOpen(false);
            toast.error('Please login to proceed to checkout');
            navigate('/login');
            return;
        }
        setCartOpen(false);
        if (!currentStoreId) {
            // fallback to home
            navigate('/');
            return;
        }
        // navigate to store page and request checkout modal
        navigate(`/store/${currentStoreId}?checkout=1`);
    };

    return (
        <Dialog open={!!cartOpen} onOpenChange={setCartOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-serif">Shopping Cart</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    {(!cart?.items || cart.items.length === 0) ? (
                        <p className="text-center text-muted-foreground py-8">Your cart is empty</p>
                    ) : (
                        <>
                            {cart.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0">
                                            <div className="w-full h-full gold-gradient opacity-20" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{item.product_id}</p>
                                            <p className="text-sm text-muted-foreground">{formatCurrency(item.price, store?.currency)} × {item.quantity}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, -1)}>
                                            <Minus className="w-3 h-3" />
                                        </Button>
                                        <span className="w-8 text-center">{item.quantity}</span>
                                        <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, 1)}>
                                            <Plus className="w-3 h-3" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.id)}>
                                            <X className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <div className="pt-4 border-t space-y-3">
                                <div className="space-y-2">
                                    <Label className="text-xs">Estimate Shipping</Label>
                                    
                                    {defaultAddress && (
                                        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded mb-2 border border-border/50">
                                            <p className="font-semibold text-foreground mb-1">Delivering to:</p>
                                            <p>{defaultAddress.address_line1}</p>
                                            {defaultAddress.address_line2 && <p>{defaultAddress.address_line2}</p>}
                                            <p>{defaultAddress.city}, {defaultAddress.state} {defaultAddress.postal_code}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="Enter Pincode" 
                                            value={pincode} 
                                            onChange={(e) => setPincode(e.target.value)}
                                            maxLength={6}
                                            className="h-8"
                                        />
                                        <Button size="sm" variant="secondary" onClick={checkShipping} disabled={calculating || pincode.length < 6} className="h-8">
                                            {calculating ? '...' : 'Check'}
                                        </Button>
                                    </div>
                                    {shipping && (
                                        <div className="text-sm flex justify-between items-center text-muted-foreground bg-muted/50 p-2 rounded">
                                            {shipping.error ? (
                                                <span className="text-destructive">Shipping not available for this area</span>
                                            ) : (
                                                <>
                                                    <span>{shipping.courier_name || 'Standard Shipping'}</span>
                                                    <span className="font-medium text-foreground">{formatCurrency(shipping.shipping_charges, store?.currency)}</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between text-lg font-semibold">
                                    <span>Total</span>
                                    <span className="gold-text">{formatCurrency(cartTotal + (shipping?.shipping_charges || 0), store?.currency)}</span>
                                </div>
                            </div>

                            <Button className="w-full gold-gradient text-white" onClick={handleCheckout}>
                                <CreditCard className="w-4 h-4 mr-2" /> Checkout
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CartDrawer;
