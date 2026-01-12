import React, { createContext, useContext, useState, useEffect } from 'react';
import { getBackendAPI } from '../lib/api';

const CartContext = createContext(null);

// Get or create session ID for guest carts
const getSessionId = () => {
    let sid = sessionStorage.getItem('session_id');
    if (!sid) {
        sid = 'guest_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('session_id', sid);
    }
    return sid;
};

export const CartProvider = ({ children }) => {
    const [carts, setCarts] = useState({}); // storeId -> CartResponse object from backend
    const [cartOpen, setCartOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Get auth token if user is logged in
    const getAuthToken = () => localStorage.getItem('token');
    const isLoggedIn = !!getAuthToken();

    const API = getBackendAPI();

    const loadCart = async (storeId) => {
        if (!storeId) return { items: [] };
        if (carts[storeId]) return carts[storeId];

        try {
            const sessionId = !isLoggedIn ? getSessionId() : null;
            const query = sessionId ? `?session_id=${sessionId}` : '';
            const response = await fetch(`${API}/stores/${storeId}/cart${query}`, {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });

            if (response.status === 404) {
                // Cart doesn't exist, create it
                const createResp = await fetch(`${API}/stores/${storeId}/cart`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${getAuthToken()}` },
                    body: JSON.stringify({ session_id: sessionId })
                });
                if (createResp.ok) {
                    const cart = await createResp.json();
                    setCarts(prev => ({ ...prev, [storeId]: cart }));
                    return cart;
                }
            }

            if (response.ok) {
                const cart = await response.json();
                setCarts(prev => ({ ...prev, [storeId]: cart }));
                return cart;
            }
        } catch (e) {
            console.error('Failed to load cart:', e);
        }
        return { items: [] };
    };

    const addToCart = async (storeId, product, qty = 1) => {
        if (!storeId) return { items: [] };
        try {
            const sessionId = !isLoggedIn ? getSessionId() : null;
            const query = sessionId ? `?session_id=${sessionId}` : '';
            const response = await fetch(`${API}/stores/${storeId}/cart/items${query}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    product_id: product.id,
                    quantity: qty,
                    price: product.price
                })
            });

            if (response.ok) {
                const cart = await response.json();
                setCarts(prev => ({ ...prev, [storeId]: cart }));
                return cart;
            }
        } catch (e) {
            console.error('Failed to add to cart:', e);
        }
        return { items: [] };
    };

    const removeFromCart = async (storeId, itemId) => {
        if (!storeId) return { items: [] };
        try {
            const sessionId = !isLoggedIn ? getSessionId() : null;
            const query = sessionId ? `?session_id=${sessionId}` : '';
            const response = await fetch(`${API}/stores/${storeId}/cart/items/${itemId}${query}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });

            if (response.ok) {
                const cart = await response.json();
                setCarts(prev => ({ ...prev, [storeId]: cart }));
                return cart;
            }
        } catch (e) {
            console.error('Failed to remove from cart:', e);
        }
        return { items: [] };
    };

    const updateCartItemQty = async (storeId, itemId, quantity) => {
        if (!storeId) return { items: [] };
        try {
            const sessionId = !isLoggedIn ? getSessionId() : null;
            const query = sessionId ? `?session_id=${sessionId}` : '';
            const response = await fetch(`${API}/stores/${storeId}/cart/items/${itemId}${query}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ quantity })
            });

            if (response.ok) {
                const cart = await response.json();
                setCarts(prev => ({ ...prev, [storeId]: cart }));
                return cart;
            }
        } catch (e) {
            console.error('Failed to update cart item:', e);
        }
        return { items: [] };
    };

    const clearCart = async (storeId) => {
        if (!storeId) return { items: [] };
        try {
            const sessionId = !isLoggedIn ? getSessionId() : null;
            const query = sessionId ? `?session_id=${sessionId}` : '';
            const response = await fetch(`${API}/stores/${storeId}/cart${query}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });

            if (response.ok) {
                const cart = await response.json();
                setCarts(prev => ({ ...prev, [storeId]: cart }));
                return cart;
            }
        } catch (e) {
            console.error('Failed to clear cart:', e);
        }
        return { items: [] };
    };

    const mergeGuestCartToUser = async (storeId) => {
        if (!storeId || isLoggedIn) return;
        try {
            const sessionId = getSessionId();
            const response = await fetch(`${API}/stores/${storeId}/cart/merge`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ session_id: sessionId })
            });

            if (response.ok) {
                const cart = await response.json();
                // Clear old guest session
                sessionStorage.removeItem('session_id');
                setCarts(prev => ({ ...prev, [storeId]: cart }));
                return cart;
            }
        } catch (e) {
            console.error('Failed to merge cart:', e);
        }
    };

    const getCartCount = (storeId) => {
        const cart = carts[storeId] || { items: [] };
        return (cart.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
    };

    const getCartTotal = (storeId) => {
        const cart = carts[storeId] || { items: [] };
        return (cart.items || []).reduce((s, it) => s + (it.quantity || 0) * (it.price || 0), 0);
    };

    const setCartForStore = (storeId, cart) => {
        setCarts(prev => ({ ...prev, [storeId]: cart || { items: [] } }));
    };

    return (
        <CartContext.Provider value={{
            loadCart,
            setCartForStore,
            addToCart,
            removeFromCart,
            updateCartItemQty,
            clearCart,
            mergeGuestCartToUser,
            getCartCount,
            getCartTotal,
            carts,
            cartOpen,
            setCartOpen,
            loading
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCartContext = () => {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error('useCartContext must be used within CartProvider');
    return ctx;
};

// Helper hook for a specific store
export const useCart = (storeId) => {
    const ctx = useCartContext();
    const { loadCart, setCartForStore, addToCart, removeFromCart, updateCartItemQty, clearCart, getCartCount, getCartTotal } = ctx;
    const cart = ctx.carts[storeId] || { items: [] };
    
    // Load cart when storeId changes
    React.useEffect(() => {
        if (storeId) {
            loadCart(storeId);
        }
    }, [storeId, loadCart]);
    
    const updateQuantityLocal = (productId, delta) => {
        const items = cart.items || [];
        const itemIndex = items.findIndex(it => it.id);
        if (itemIndex >= 0) {
            const newQty = items[itemIndex].quantity + delta;
            const itemId = items[itemIndex].id;
            if (newQty > 0) {
                updateCartItemQty(storeId, itemId, newQty);
            } else {
                removeFromCart(storeId, itemId);
            }
        }
    };

    const removeFromCartLocal = (productId) => {
        const items = cart.items || [];
        const item = items.find(it => it.product_id === productId);
        if (item) {
            removeFromCart(storeId, item.id);
        }
    };
    
    return {
        cart,
        setCart: (c) => setCartForStore(storeId, c),
        loadCart: () => loadCart(storeId),
        addToCart: (product, qty = 1) => addToCart(storeId, product, qty),
        removeFromCart: removeFromCartLocal,
        updateQuantityLocal,
        updateCartItemQty: (itemId, qty) => updateCartItemQty(storeId, itemId, qty),
        clearCart: () => clearCart(storeId),
        cartCount: getCartCount(storeId),
        cartTotal: getCartTotal(storeId),
        // cart UI state
        cartOpen: ctx.cartOpen,
        setCartOpen: ctx.setCartOpen,
        loading: ctx.loading
    };
};

export default CartContext;
