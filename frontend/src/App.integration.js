/**
 * App.js Integration with Domain Detection
 * 
 * This shows how to integrate domain detection into your main App component.
 * Add this code to your existing App.js
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { initializeStore } from './utils/domainDetector';

// Your page imports
import StoreFront from './pages/StoreFront';
import StoreProducts from './pages/StoreProducts';
import ProductDetail from './pages/ProductDetail';
import CartPage from './pages/CartPage';
import StoreLogin from './pages/StoreLogin';
import StoreRegister from './pages/StoreRegister';
import StoreContact from './pages/StoreContact';
import StorePlans from './pages/StorePlans';
import CustomerPortal from './pages/CustomerPortal';
import StoreAdminDashboard from './pages/StoreAdminDashboard';

function App() {
  const [storeId, setStoreId] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Initialize store on component mount
   * Handles domain detection and store loading
   */
  useEffect(() => {
    const initStore = async () => {
      try {
        console.log('[App] Starting store initialization...');
        setLoading(true);
        setError(null);

        // Call domain detector to get store
        const result = await initializeStore();
        
        if (result.error) {
          console.warn('[App] Store initialization warning:', result.error);
          setError(result.error);
          // Don't stop here - user might be using URL params or logging in
        }

        if (result.storeId) {
          console.log('[App] Store loaded:', result.storeId);
          setStoreId(result.storeId);
          setStore(result.store);
          
          // Log where store came from
          console.log(`[App] Store detected via: ${result.source}`);
        }

      } catch (err) {
        console.error('[App] Store initialization error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initStore();
  }, []);

  // Handle store fallback from URL if domain detection fails
  useEffect(() => {
    if (!storeId) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlStoreId = urlParams.get('store_id');
      
      if (urlStoreId) {
        console.log('[App] Using store_id from URL:', urlStoreId);
        setStoreId(urlStoreId);
      }
    }
  }, [storeId]);

  // Show loading state
  if (loading && !storeId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading store...</p>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  // Provide storeId through context
  // Make sure your CartProvider and AuthProvider accept storeId prop
  return (
    <Router>
      <CartProvider storeId={storeId}>
        <AuthProvider storeId={storeId}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<StoreFront />} />
            <Route path="/products" element={<StoreProducts />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/login" element={<StoreLogin />} />
            <Route path="/register" element={<StoreRegister />} />
            <Route path="/contact" element={<StoreContact />} />
            <Route path="/plans" element={<StorePlans />} />

            {/* Authenticated routes */}
            <Route path="/portal" element={<CustomerPortal />} />
            <Route path="/admin" element={<StoreAdminDashboard />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </CartProvider>
    </Router>
  );
}

export default App;

/**
 * ALTERNATIVE: Using custom hooks for store management
 * 
 * If you prefer, you can create a custom hook instead:
 */

/*
// useStore.js
import { useEffect, useState } from 'react';
import { initializeStore } from './utils/domainDetector';

export function useStore() {
  const [storeId, setStoreId] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const result = await initializeStore();
        if (result.storeId) {
          setStoreId(result.storeId);
          setStore(result.store);
        }
        if (result.error && !result.storeId) {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  return { storeId, store, loading, error };
}

// Usage in App.js:
// function App() {
//   const { storeId, store, loading } = useStore();
//   if (loading) return <LoadingSpinner />;
//   return <CartProvider storeId={storeId}>...</CartProvider>;
// }
*/
