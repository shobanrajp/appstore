import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Toaster } from './components/ui/sonner';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import StoreAdminDashboard from './pages/StoreAdminDashboard';
import PageEditor from './pages/PageEditor';
import StoreFront from './pages/StoreFront';
import ProductDetail from './pages/ProductDetail';
import CategoryProducts from './pages/CategoryProducts';
import StoreProducts from './pages/StoreProducts';
import StorePlans from './pages/StorePlans';
import SubscriptionDetail from './pages/SubscriptionDetail';
import StoreContact from './pages/StoreContact';
import CustomerPortal from './pages/CustomerPortal';
import StoreLogin from './pages/StoreLogin';
import StoreRegister from './pages/StoreRegister';
import CartPage from './pages/CartPage';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    if (!user) {
        // Get last visited store for login redirect
        const lastStore = localStorage.getItem('lastVisitedStore');
        console.log('[ProtectedRoute] User not authenticated, lastStore:', lastStore);
        return <Navigate to={lastStore ? `/store/${lastStore}/login` : '/landing'} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to appropriate page based on role
        const lastStore = localStorage.getItem('lastVisitedStore');
        console.log('[ProtectedRoute] Role check failed. user.role:', user.role, 'allowedRoles:', allowedRoles, 'lastStore:', lastStore);
        if (user.role === 'super_admin') return <Navigate to="/" replace />;
        if (user.role === 'store_admin' || user.role === 'store_user') return <Navigate to={lastStore ? `/store/${lastStore}/admin` : '/landing'} replace />;
        return <Navigate to={lastStore ? `/store/${lastStore}` : '/landing'} replace />;
    }

    return children;
};

// Public Route (redirect if logged in)
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    if (user) {
        const lastStore = localStorage.getItem('lastVisitedStore');
        if (user.role === 'super_admin') return <Navigate to="/" replace />;
        if (user.role === 'store_admin' || user.role === 'store_user') return <Navigate to={lastStore ? `/store/${lastStore}/admin` : '/landing'} replace />;
        return <Navigate to={lastStore ? `/store/${lastStore}/portal` : '/landing'} replace />;
    }

    return children;
};

function AppRoutes() {
    return (
        <Routes>
            {/* Super Admin Dashboard - Root */}
            <Route
                path="/"
                element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                        <SuperAdminDashboard />
                    </ProtectedRoute>
                }
            />

            {/* Landing Page */}
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

            {/* Store Front (Public) */}
            <Route path="/store/:storeId" element={<StoreFront />} />
            <Route path="/store/:storeId/login" element={<StoreLogin />} />
            <Route path="/store/:storeId/register" element={<StoreRegister />} />
            <Route path="/store/:storeId/product/:productId" element={<ProductDetail />} />
            <Route path="/store/:storeId/category/:category" element={<CategoryProducts />} />
            <Route path="/store/:storeId/products" element={<StoreProducts />} />
            <Route path="/store/:storeId/cart" element={<CartPage />} />
            <Route path="/store/:storeId/plans" element={<StorePlans />} />
            <Route path="/store/:storeId/plan/:planId" element={<SubscriptionDetail />} />
            <Route path="/store/:storeId/contact" element={<StoreContact />} />

            {/* Store Admin/User Routes */}
            <Route
                path="/store/:storeId/admin"
                element={
                    <ProtectedRoute allowedRoles={['super_admin', 'store_admin', 'store_user']}>
                        <StoreAdminDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/store/:storeId/page-editor"
                element={
                    <ProtectedRoute allowedRoles={['super_admin', 'store_admin']}>
                        <PageEditor />
                    </ProtectedRoute>
                }
            />

            {/* Customer Portal */}
            <Route
                path="/store/:storeId/portal"
                element={
                    <ProtectedRoute allowedRoles={['end_user', 'super_admin', 'store_admin', 'store_user']}>
                        <CustomerPortal />
                    </ProtectedRoute>
                }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
    );
}

// Logs route changes to help diagnose navigation/render issues
const RouteChangeLogger = () => {
    const location = useLocation();
    React.useEffect(() => {
        console.log('[Router] Location changed:', location.pathname + location.search);
    }, [location.pathname, location.search]);
    return null;
};

function App() {
    return (
        <AuthProvider>
            <CartProvider>
                <BrowserRouter>
                    <RouteChangeLogger />
                    <AppRoutes />
                    <Toaster position="top-right" richColors />
                </BrowserRouter>
            </CartProvider>
        </AuthProvider>
    );
}

export default App;
