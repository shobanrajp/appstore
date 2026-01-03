import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
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
export const updateStoreSettings = (id, currency) => api.put(`/stores/${id}/settings?currency=${currency}`);

// Users
export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const updateProfile = (name) => api.put(`/profile?name=${encodeURIComponent(name)}`);

// Products
export const getProducts = (storeId, category, activeOnly = true) => {
    let url = `/stores/${storeId}/products?active_only=${activeOnly}`;
    if (category) url += `&category=${category}`;
    return api.get(url);
};
export const getProduct = (storeId, productId) => api.get(`/stores/${storeId}/products/${productId}`);
export const createProduct = (storeId, data) => api.post(`/stores/${storeId}/products`, data);
export const updateProduct = (storeId, productId, data) => api.put(`/stores/${storeId}/products/${productId}`, data);
export const deleteProduct = (storeId, productId) => api.delete(`/stores/${storeId}/products/${productId}`);

// Inventory
export const getInventory = (storeId) => api.get(`/stores/${storeId}/inventory`);
export const createInventory = (storeId, data) => api.post(`/stores/${storeId}/inventory`, data);
export const updateInventory = (storeId, invId, data) => api.put(`/stores/${storeId}/inventory/${invId}`, data);

// Vendors
export const getVendors = (storeId) => api.get(`/stores/${storeId}/vendors`);
export const createVendor = (storeId, data) => api.post(`/stores/${storeId}/vendors`, data);
export const updateVendor = (storeId, vendorId, data) => api.put(`/stores/${storeId}/vendors/${vendorId}`, data);
export const deleteVendor = (storeId, vendorId) => api.delete(`/stores/${storeId}/vendors/${vendorId}`);

// Purchase Orders
export const getPurchaseOrders = (storeId) => api.get(`/stores/${storeId}/purchase-orders`);
export const createPurchaseOrder = (storeId, data) => api.post(`/stores/${storeId}/purchase-orders`, data);
export const updatePOStatus = (storeId, poId, status) => api.put(`/stores/${storeId}/purchase-orders/${poId}/status?status=${status}`);

// POS Transactions
export const getPOSTransactions = (storeId) => api.get(`/stores/${storeId}/pos-transactions`);
export const createPOSTransaction = (storeId, data) => api.post(`/stores/${storeId}/pos-transactions`, data);

// Orders
export const getOrders = (storeId) => api.get(`/stores/${storeId}/orders`);
export const getMyOrders = () => api.get('/my-orders');
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
export const subscribeToPlan = (storeId, data) => api.post(`/stores/${storeId}/subscribe`, data);
export const getMySubscriptions = () => api.get('/my-subscriptions');

// Page Config
export const getPageConfigs = (storeId) => api.get(`/stores/${storeId}/page-config`);
export const getPageConfig = (storeId, pageName) => api.get(`/stores/${storeId}/page-config/${pageName}`);
export const createPageConfig = (storeId, data) => api.post(`/stores/${storeId}/page-config`, data);
export const updatePageConfig = (storeId, configId, data) => api.put(`/stores/${storeId}/page-config/${configId}`, data);

// Payments (Mock)
export const createPaymentOrder = (data) => api.post('/payments/create-order', data);
export const completePayment = (paymentId) => api.post(`/payments/${paymentId}/complete`);

export default api;
