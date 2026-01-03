import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export const formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
    }).format(amount);
};

export const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const getStatusColor = (status) => {
    const colors = {
        pending: 'bg-yellow-100 text-yellow-800',
        processing: 'bg-blue-100 text-blue-800',
        shipped: 'bg-purple-100 text-purple-800',
        delivered: 'bg-green-100 text-green-800',
        cancelled: 'bg-red-100 text-red-800',
        completed: 'bg-green-100 text-green-800',
        active: 'bg-green-100 text-green-800',
        inactive: 'bg-gray-100 text-gray-800',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
};

export const USER_ROLES = {
    SUPER_ADMIN: 'super_admin',
    STORE_ADMIN: 'store_admin',
    STORE_USER: 'store_user',
    END_USER: 'end_user',
};

export const getRoleLabel = (role) => {
    const labels = {
        super_admin: 'Super Admin',
        store_admin: 'Store Admin',
        store_user: 'Store User',
        end_user: 'Customer',
    };
    return labels[role] || role;
};
