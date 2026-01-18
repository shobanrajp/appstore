import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getBackendAPI } from '../lib/api';
import LoadingOverlay from '../components/LoadingOverlay';

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
    const [updating, setUpdating] = useState(false);
    const [adding, setAdding] = useState(false); // true only during explicit addToCart network requests
    // track pending loadCart promises to coalesce concurrent requests
    const pendingLoadsRef = useRef({});
    // batching queue for addToCart
    const addQueueRef = useRef([]);
    const addTimerRef = useRef(null);

    // Get auth token if user is logged in
    const getAuthToken = () => localStorage.getItem('token');
    const isLoggedIn = !!getAuthToken();

    const API = getBackendAPI();

    const loadCart = async (storeId, force = false) => {
        if (!storeId) return { items: [] };
        if (!force && carts[storeId]) return carts[storeId];
        // coalesce concurrent loads for the same storeId
        if (!pendingLoadsRef.current) pendingLoadsRef.current = {};
        if (pendingLoadsRef.current[storeId]) {
            return pendingLoadsRef.current[storeId];
        }

        try {
            setLoading(true);
            const sessionId = !isLoggedIn ? getSessionId() : null;
            const query = sessionId ? `?session_id=${sessionId}` : '';
            const responsePromise = fetch(`${API}/stores/${storeId}/cart${query}`, {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });

            // store the promise so concurrent callers reuse it
            pendingLoadsRef.current[storeId] = (async () => await responsePromise)();
            const response = await pendingLoadsRef.current[storeId];

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
        finally {
            setLoading(false);
            // clear pending promise
            if (pendingLoadsRef.current) delete pendingLoadsRef.current[storeId];
        }
        return { items: [] };
    };

    const addToCart = async (storeId, product, qty = 1) => {
        if (!storeId) return { items: [] };

        // Optimistic UI update: update local cart immediately, then send request in background.
        try {
            const current = carts[storeId] || { items: [] };
            // Clone to avoid mutating state directly
            const newCart = { ...current, items: (current.items || []).map(i => ({ ...i })) };

            // Try to find existing item by product_id
            const existing = newCart.items.find(it => it.product_id === product.id);
            if (existing) {
                existing.quantity = (existing.quantity || 0) + qty;
            } else {
                // Temporary id until server replies
                newCart.items.push({ id: `tmp_${Date.now()}`, product_id: product.id, quantity: qty, price: product.price });
            }

            // Update local cache immediately so UI doesn't wait
            setCarts(prev => ({ ...prev, [storeId]: newCart }));

            // Add to batch queue and schedule flush
            addQueueRef.current.push({ product_id: product.id, quantity: qty, price: product.price, storeId });

            const scheduleFlush = () => {
                if (addTimerRef.current) return;
                addTimerRef.current = setTimeout(async () => {
                    const queued = addQueueRef.current.splice(0, addQueueRef.current.length);
                    addTimerRef.current = null;
                    if (queued.length === 0) return;

                    setAdding(true);
                    try {
                        // Group items by storeId
                        const byStore = {};
                        for (const it of queued) {
                            const sid = it.storeId;
                            if (!byStore[sid]) byStore[sid] = [];
                            byStore[sid].push({ product_id: it.product_id, quantity: it.quantity, price: it.price });
                        }

                        for (const sid of Object.keys(byStore)) {
                            const items = byStore[sid];
                            const sessionId = !getAuthToken() ? getSessionId() : null;
                            const query = sessionId ? `?session_id=${sessionId}` : '';
                            const response = await fetch(`${API}/stores/${sid}/cart/items/batch${query}`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${getAuthToken()}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ items })
                            });

                            if (response.ok) {
                                const serverCart = await response.json();
                                setCarts(prev => ({ ...prev, [sid]: serverCart }));
                                // Ensure tax/shipping are present quickly by forcing a reload
                                setTimeout(() => loadCart(sid, true), 300);
                            } else {
                                // On failure, reload cart from server to reconcile
                                try {
                                    const reloadResp = await fetch(`${API}/stores/${sid}/cart${sessionId ? `?session_id=${sessionId}` : ''}`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
                                    if (reloadResp.ok) {
                                        const serverCart = await reloadResp.json();
                                        setCarts(prev => ({ ...prev, [sid]: serverCart }));
                                    }
                                } catch (e) {
                                    console.error('Failed to reload cart after batch add failure', e);
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Batch addToCart failed, reloading cart', err);
                        try {
                            // reload affected stores
                            const affected = Array.from(new Set(queued.map(q => q.storeId)));
                            for (const sid of affected) {
                                const sessionId = !getAuthToken() ? getSessionId() : null;
                                const reloadResp = await fetch(`${API}/stores/${sid}/cart${sessionId ? `?session_id=${sessionId}` : ''}`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
                                if (reloadResp.ok) {
                                    const serverCart = await reloadResp.json();
                                    setCarts(prev => ({ ...prev, [sid]: serverCart }));
                                    setTimeout(() => loadCart(sid, true), 300);
                                }
                            }
                        } catch (e) {
                            console.error('Failed to reload cart after batch add failure', e);
                        }
                    } finally {
                        setTimeout(() => setAdding(false), 250);
                    }
                }, 300);
            };

            scheduleFlush();

            return newCart;
        } catch (e) {
            console.error('Failed to optimistically add to cart:', e);
            return { items: [] };
        }
    };

    const removeFromCart = async (storeId, itemId) => {
        if (!storeId) return { items: [] };
        setUpdating(true);
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
        } finally {
            setUpdating(false);
        }
        return { items: [] };
    };

    const updateCartItemQty = async (storeId, itemId, quantity) => {
        if (!storeId) return { items: [] };
        setUpdating(true);
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
        } finally {
            setUpdating(false);
        }
        return { items: [] };
    };

    const clearCart = async (storeId) => {
        if (!storeId) return { items: [] };
        setUpdating(true);
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
        } finally {
            setUpdating(false);
        }
        return { items: [] };
    };

    const mergeGuestCartToUser = async (storeId) => {
        if (!storeId) return;
        // Check auth dynamically (user may have logged in after provider init)
        const token = getAuthToken();
        if (!token) return;
        try {
            const sessionId = getSessionId();
            const response = await fetch(`${API}/stores/${storeId}/cart/merge`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
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

const overlayLoading = updating; // show overlay only when updating (do not show on add-to-cart)
    const overlayMessage = "Updating cart...";

    // Suppress the global cart overlay on certain routes (e.g., checkout).
    // Avoid useLocation here because CartProvider may be mounted outside a Router.
    const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    const isCheckoutRoute = typeof pathname === 'string' && pathname.includes('/checkout');
    const effectiveOverlayLoading = overlayLoading && !isCheckoutRoute;

    return (
        <>
            <LoadingOverlay isLoading={effectiveOverlayLoading} message={overlayMessage} />
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
                loading,
                updating
        }}>
            {children}
            </CartContext.Provider>
        </>
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

    // Load cart when storeId changes (call once).
    // Skip loading on auth pages (login/register) to avoid unnecessary API calls.
    React.useEffect(() => {
        if (!storeId) return;
        const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
        // Skip auth pages including store-scoped routes like /store/:id/login
        const skipAuth = /\/(?:login|register)(?:\/|$)/;
        if (skipAuth.test(pathname)) return;
        loadCart(storeId);
        // intentionally exclude `loadCart` from deps to avoid loops when its identity changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeId]);

    // Stable wrappers so consumers can safely use them in deps
    const wrappedLoadCart = React.useCallback((force = false) => loadCart(storeId, force), [loadCart, storeId]);
    const wrappedAddToCart = React.useCallback((product, qty = 1) => addToCart(storeId, product, qty), [addToCart, storeId]);
    const wrappedUpdateCartItemQty = React.useCallback((itemId, qty) => updateCartItemQty(storeId, itemId, qty), [updateCartItemQty, storeId]);
    const wrappedClearCart = React.useCallback(() => clearCart(storeId), [clearCart, storeId]);
    const wrappedSetCart = React.useCallback((c) => setCartForStore(storeId, c), [setCartForStore, storeId]);

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
        setCart: wrappedSetCart,
        loadCart: wrappedLoadCart,
        addToCart: wrappedAddToCart,
        removeFromCart: removeFromCartLocal,
        updateQuantityLocal,
        updateCartItemQty: wrappedUpdateCartItemQty,
        clearCart: wrappedClearCart,
        cartCount: getCartCount(storeId),
        cartTotal: getCartTotal(storeId),
        // cart UI state
        cartOpen: ctx.cartOpen,
        setCartOpen: ctx.setCartOpen,
        loading: ctx.loading
    };
};

export default CartContext;
