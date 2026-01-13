// Razorpay Logs
export const getRazorpayLogs = (storeId, page = 1, limit = 20) =>
    api.get(`/stores/${storeId}/razorpay-logs?page=${page}&limit=${limit}`);
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Get raw backend API URL for fetch() calls (cart endpoints)
export const getBackendAPI = () => process.env.REACT_APP_BACKEND_URL + '/api';

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle auth errors; avoid redirecting on login/register attempts to preserve in-place error toasts
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const reqUrl = error.config?.url || '';
            const isAuthAttempt = reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register');
            if (!isAuthAttempt) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');

// Stores
export const getStores = () => api.get('/stores');
export const getStore = (id) => api.get(`/stores/${id}`);
export const createStore = (data) => api.post('/stores', data);
export const updateStore = (id, data) => api.put(`/stores/${id}`, data);
export const deleteStore = (id) => api.delete(`/stores/${id}`);
// New: support full settings update with body
export const updateStoreSettings = (id, data) => api.put(`/stores/${id}/settings`, data);
export const getMarketPrices = (storeId) => api.get(`/stores/${storeId}/market-prices`);

// Users
export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const updateProfile = (name) => api.put(`/profile?name=${encodeURIComponent(name)}`);
export const updatePassword = (currentPassword, newPassword) => api.put('/profile/password', {
    current_password: currentPassword,
    new_password: newPassword,
});
export const setProfileStore = (storeId) => api.put(`/profile/store?store_id=${encodeURIComponent(storeId)}`);

// Products
export const getProducts = (storeId, category, activeOnly = true, featured = null, limit = null, page = null, search = null) => {
    const params = new URLSearchParams();
    params.set('active_only', String(activeOnly));
    if (category) params.set('category', category);
    if (featured !== null && featured !== undefined) params.set('featured', String(!!featured));
    if (limit !== null && limit !== undefined) params.set('limit', String(limit));
    if (page !== null && page !== undefined) params.set('page', String(page));
    if (search) params.set('search', search);
    return api.get(`/stores/${storeId}/products?${params.toString()}`);
};
export const getProduct = (storeId, productId) => api.get(`/stores/${storeId}/products/${productId}`);
export const createProduct = (storeId, data) => api.post(`/stores/${storeId}/products`, data);
export const updateProduct = (storeId, productId, data) => api.put(`/stores/${storeId}/products/${productId}`, data);
export const deleteProduct = (storeId, productId) => api.delete(`/stores/${storeId}/products/${productId}`);

// Inventory
export const getInventory = (storeId, page, limit) => {
    let url = `/stores/${storeId}/inventory`;
    const params = [];
    if (page) params.push(`page=${page}`);
    if (limit) params.push(`limit=${limit}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return api.get(url);
};
export const createInventory = (storeId, data) => api.post(`/stores/${storeId}/inventory`, data);
export const updateInventory = (storeId, invId, data) => api.put(`/stores/${storeId}/inventory/${invId}`, data);

// Vendors
export const getVendors = (storeId, page = 1, limit = 50) => api.get(`/stores/${storeId}/vendors?page=${page}&limit=${limit}`);
export const createVendor = (storeId, data) => api.post(`/stores/${storeId}/vendors`, data);
export const updateVendor = (storeId, vendorId, data) => api.put(`/stores/${storeId}/vendors/${vendorId}`, data);
export const deleteVendor = (storeId, vendorId) => api.delete(`/stores/${storeId}/vendors/${vendorId}`);

// Purchase Orders
export const getPurchaseOrders = (storeId, page = 1, limit = 50) => api.get(`/stores/${storeId}/purchase-orders?page=${page}&limit=${limit}`);
export const createPurchaseOrder = (storeId, data) => api.post(`/stores/${storeId}/purchase-orders`, data);
export const updatePurchaseOrder = (storeId, poId, data) => api.put(`/stores/${storeId}/purchase-orders/${poId}`, data);
export const updatePOStatus = (storeId, poId, status) => api.put(`/stores/${storeId}/purchase-orders/${poId}/status?status=${status}`);
export const deletePurchaseOrder = (storeId, poId) => api.delete(`/stores/${storeId}/purchase-orders/${poId}`);

// POS Transactions
export const getPOSTransactions = (storeId, page = 1, limit = 50) => api.get(`/stores/${storeId}/pos-transactions?page=${page}&limit=${limit}`);
export const createPOSTransaction = (storeId, data) => api.post(`/stores/${storeId}/pos-transactions`, data);
export const updatePOSTransaction = (storeId, txId, data) => api.put(`/stores/${storeId}/pos-transactions/${txId}`, data);
export const deletePOSTransaction = (storeId, txId) => api.delete(`/stores/${storeId}/pos-transactions/${txId}`);

// Reporting
export const getStoreReports = (storeId, startDate, endDate) => {
    let url = `/stores/${storeId}/reports`;
    const params = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return api.get(url);
};

// Staff Management
export const getStoreStaff = (storeId, page = 1, limit = 50) => api.get(`/stores/${storeId}/staff?page=${page}&limit=${limit}`);
export const createStaff = (storeId, data) => api.post(`/stores/${storeId}/staff`, data);
export const updateStaff = (storeId, staffId, data) => api.put(`/stores/${storeId}/staff/${staffId}`, data);
export const deleteStaff = (storeId, staffId) => api.delete(`/stores/${storeId}/staff/${staffId}`);
export const getStaffActivity = (storeId, staffId) => api.get(`/stores/${storeId}/staff/${staffId}/activity`);

// Customer Management
export const getStoreCustomers = (storeId, page = 1, limit = 50) => api.get(`/stores/${storeId}/customers?page=${page}&limit=${limit}`);
export const getCustomerDetails = (storeId, customerId) => api.get(`/stores/${storeId}/customers/${customerId}`);
export const updateCustomer = (storeId, customerId, data) => api.put(`/stores/${storeId}/customers/${customerId}`, data);
export const deleteCustomer = (storeId, customerId) => api.delete(`/stores/${storeId}/customers/${customerId}`);

// Orders
export const getOrders = (storeId, page = 1, limit = 50) => api.get(`/stores/${storeId}/orders?page=${page}&limit=${limit}`);
export const getMyOrders = (page = 1, limit = 20) => api.get(`/my-orders?page=${page}&limit=${limit}`);
export const createOrder = (storeId, data) => api.post(`/stores/${storeId}/orders`, data);
export const updateOrderStatus = (storeId, orderId, data) => api.put(`/stores/${storeId}/orders/${orderId}/status`, data);

// Addresses
export const getAddresses = () => api.get('/addresses');
export const createAddress = (data) => api.post('/addresses', data);
export const updateAddress = (id, data) => api.put(`/addresses/${id}`, data);
export const deleteAddress = (id) => api.delete(`/addresses/${id}`);

// Subscription Plans
export const getSubscriptionPlans = (storeId) => api.get(`/stores/${storeId}/subscription-plans`);
export const createSubscriptionPlan = (storeId, data) => api.post(`/stores/${storeId}/subscription-plans`, data);
export const updateSubscriptionPlan = (storeId, planId, data) => api.put(`/stores/${storeId}/subscription-plans/${planId}`, data);
export const subscribeToPlan = (storeId, data) => api.post(`/stores/${storeId}/subscribe`, data);
export const getMySubscriptions = () => api.get('/my-subscriptions');
export const getSubscriptionTransactions = (subscriptionId) => api.get(`/subscriptions/${subscriptionId}/transactions`);

// Store Admin - Subscribers
export const getStoreSubscribers = (storeId) => api.get(`/stores/${storeId}/subscribers`);
export const getSubscriptionDetails = (storeId, subscriptionId) => api.get(`/stores/${storeId}/subscriptions/${subscriptionId}`);
export const updateSubscriptionStatus = (storeId, subscriptionId, status) => api.put(`/stores/${storeId}/subscriptions/${subscriptionId}/status`, { status });
export const deleteSubscription = (storeId, subscriptionId) => api.delete(`/stores/${storeId}/subscriptions/${subscriptionId}`);

// End User - Pay subscription
export const paySubscription = (subscriptionId, amount) => api.post(`/subscriptions/${subscriptionId}/pay`, { subscription_id: subscriptionId, amount });
export const previewClosure = (subscriptionId, data) => api.post(`/subscriptions/${subscriptionId}/preview-closure`, data);
export const initiateClosure = (subscriptionId, data) => api.post(`/subscriptions/${subscriptionId}/initiate-closure`, data);

// Store Payment Config (Super Admin)
export const getStorePaymentConfig = (storeId) => api.get(`/stores/${storeId}/payment-config`);
export const updateStorePaymentConfig = (storeId, data) => api.put(`/stores/${storeId}/payment-config`, data);

// Page Config
export const getPageConfigs = (storeId) => api.get(`/stores/${storeId}/page-config`);
export const getPageConfig = (storeId, pageName) => api.get(`/stores/${storeId}/page-config/${pageName}`);
export const createPageConfig = (storeId, data) => api.post(`/stores/${storeId}/page-config`, data);
export const updatePageConfig = (storeId, configId, data) => api.put(`/stores/${storeId}/page-config/${configId}`, data);

// Payments (Razorpay)
export const createPaymentOrder = (data) => api.post('/payments/create-order', data);
export const verifyPayment = (data) => api.post('/payments/verify', data);

export default api;

export const getStoreTaxConfig = (storeId) => api.get(`/stores/${storeId}/tax-config`);
export const updateStoreTaxConfig = (storeId, data) => api.put(`/stores/${storeId}/tax-config`, data);

export const getShiprocketLogs = (storeId, page = 1, limit = 20) => api.get(`/stores/${storeId}/shiprocket-logs?page=${page}&limit=${limit}`);

export const estimateShipping = (storeId, data) => api.post(`/stores/${storeId}/shipping/estimate`, data);

