import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import CustomerPortal from './pages/CustomerPortal';

// Protected Route Component
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
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to appropriate dashboard based on role
        if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
        if (user.role === 'store_admin' || user.role === 'store_user') return <Navigate to="/store-admin" replace />;
        return <Navigate to="/shop" replace />;
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
        if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
        if (user.role === 'store_admin' || user.role === 'store_user') return <Navigate to="/store-admin" replace />;
        return <Navigate to="/portal" replace />;
    }

    return children;
};

function AppRoutes() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            
            {/* Store Front (Public) */}
            <Route path="/store/:storeId" element={<StoreFront />} />
            <Route path="/store/:storeId/product/:productId" element={<ProductDetail />} />
            <Route path="/shop" element={<StoreFront />} />

            {/* Super Admin Routes */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                        <SuperAdminDashboard />
                    </ProtectedRoute>
                }
            />

            {/* Store Admin/User Routes */}
            <Route
                path="/store-admin"
                element={
                    <ProtectedRoute allowedRoles={['super_admin', 'store_admin', 'store_user']}>
                        <StoreAdminDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/page-editor/:storeId"
                element={
                    <ProtectedRoute allowedRoles={['super_admin', 'store_admin']}>
                        <PageEditor />
                    </ProtectedRoute>
                }
            />

            {/* Customer Portal */}
            <Route
                path="/portal"
                element={
                    <ProtectedRoute allowedRoles={['end_user', 'super_admin', 'store_admin', 'store_user']}>
                        <CustomerPortal />
                    </ProtectedRoute>
                }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
                <Toaster position="top-right" richColors />
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
