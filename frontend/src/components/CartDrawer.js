import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
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

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!currentStoreId) return;
            try {
                const res = await getStore(currentStoreId);
                if (mounted) setStore(res.data);
            } catch (e) {}
        };
        load();
        return () => { mounted = false; };
    }, [currentStoreId]);

    const updateQuantity = (itemId, delta) => {
        const item = (cart?.items || []).find(i => i.id === itemId);
        if (item) {
            const newQty = item.quantity + delta;
            if (newQty > 0) {
                updateCartItemQty(itemId, newQty);
            } else {
                removeFromCart(itemId);
            }
        }
    };

    const navigate = useNavigate();

    const { user } = useAuth();

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

                            <div className="border-t pt-4">
                                <div className="flex justify-between text-lg font-semibold">
                                    <span>Total</span>
                                    <span className="gold-text">{formatCurrency(cartTotal, store?.currency)}</span>
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
