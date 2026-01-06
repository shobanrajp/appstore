import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
    // carts is an object keyed by storeId -> array of cart items
    const [carts, setCarts] = useState({});
    const [cartOpen, setCartOpen] = useState(false);

    useEffect(() => {
        // no-op; carts will lazily load from localStorage when requested
    }, []);

    const loadCart = (storeId) => {
        if (!storeId) return [];
        if (carts[storeId]) return carts[storeId];
        try {
            const saved = localStorage.getItem(`cart_${storeId}`);
            const parsed = saved ? JSON.parse(saved) : [];
            setCarts(prev => ({ ...prev, [storeId]: parsed }));
            return parsed;
        } catch (e) {
            return [];
        }
    };

    const saveCart = (storeId, cart) => {
        setCarts(prev => ({ ...prev, [storeId]: cart }));
        try { localStorage.setItem(`cart_${storeId}`, JSON.stringify(cart)); } catch (e) {}
    };

    const getCartCount = (storeId) => {
        const cart = loadCart(storeId) || [];
        return cart.reduce((s, it) => s + (it.quantity || 0), 0);
    };

    const getCartTotal = (storeId) => {
        const cart = loadCart(storeId) || [];
        return cart.reduce((s, it) => s + (it.quantity || 0) * (it.price || 0), 0);
    };

    const addToCart = (storeId, product, qty = 1) => {
        const cart = loadCart(storeId) || [];
        const existing = cart.find(i => i.product_id === product.id);
        let newCart;
        if (existing) {
            newCart = cart.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + qty } : i);
        } else {
            newCart = [...cart, { product_id: product.id, product_name: product.name, quantity: qty, price: product.price, image: product.images?.[0] }];
        }
        saveCart(storeId, newCart);
        return newCart;
    };

    const setCartForStore = (storeId, cart) => saveCart(storeId, cart || []);

    return (
        <CartContext.Provider value={{ loadCart, setCartForStore, addToCart, getCartCount, getCartTotal, carts, cartOpen, setCartOpen }}>
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
    const { loadCart, setCartForStore, addToCart, getCartCount, getCartTotal } = useCartContext();
    const cart = loadCart(storeId) || [];
    return {
        cart,
        setCart: (c) => setCartForStore(storeId, c),
        addToCart: (product, qty = 1) => addToCart(storeId, product, qty),
        cartCount: getCartCount(storeId),
        cartTotal: getCartTotal(storeId),
        // cart UI state
        cartOpen: useCartContext().cartOpen,
        setCartOpen: useCartContext().setCartOpen,
    };
};

export default CartContext;
