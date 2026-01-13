import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNavigate, Link, useSearchParams, useParams } from 'react-router-dom';
import { getMyOrders, getMySubscriptions, getAddresses, createAddress, deleteAddress, updateAddress, updateProfile, updatePassword, paySubscription, getProduct, getStore, getSubscriptionDetails, getSubscriptionPlans, getStoreTaxConfig, getMarketPrices, getSubscriptionTransactions, previewClosure, initiateClosure } from '../lib/api';
import { createRazorpayPayment } from '../lib/razorpay';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { User, Package, CreditCard, MapPin, LogOut, Plus, Trash2, Edit2, IndianRupee, History } from 'lucide-react';
import { formatCurrency, formatDate, getStatusColor, setPageTitle, formatDateTime, getImageUrl } from '../lib/utils';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import LoadingOverlay from '../components/LoadingOverlay';

const CustomerPortal = () => {
    const { storeId } = useParams();
    const { user, logout, updateUser, loading: authLoading } = useAuth();
    const { cartCount } = useCart(storeId);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [store, setStore] = useState(null);
    const [orders, setOrders] = useState([]);
    
    // Pagination State for Orders
    const [orderPage, setOrderPage] = useState(1);
    const [orderLimit] = useState(10);
    const [orderTotalPages, setOrderTotalPages] = useState(1);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const [subscriptions, setSubscriptions] = useState([]);
    const [plans, setPlans] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('orders');
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [addressDialogOpen, setAddressDialogOpen] = useState(false);
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState(null);
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    // Closure State
    const [closureDialogOpen, setClosureDialogOpen] = useState(false);
    const [closureStep, setClosureStep] = useState(1);
    const [closurePreview, setClosurePreview] = useState(null);
    const [selectedAddressId, setSelectedAddressId] = useState('');
    const [closureLoading, setClosureLoading] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState(null);

    const [newAddress, setNewAddress] = useState({
        label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '',
        city: '', state: '', postal_code: '', country: 'India', special_instructions: '', is_default: false
    });
    const [profileName, setProfileName] = useState(user?.name || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [updatingProfile, setUpdatingProfile] = useState(false);
    const [flexibleAmount, setFlexibleAmount] = useState('');
    const [taxConfig, setTaxConfig] = useState(null);
    const [marketPrices, setMarketPrices] = useState(null);
    
    // Transactions View
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
    const [transactionList, setTransactionList] = useState([]);
    const [viewingSubscription, setViewingSubscription] = useState(null);

    useEffect(() => {
        // Wait for auth to initialize before checking user
        if (authLoading) return;
        
        if (!user) {
            // Redirect to store login
            navigate(`/store/${storeId}/login`, { replace: true });
            return;
        }
        // Get order ID from URL params if coming from payment success
        const orderIdParam = searchParams.get('order');
        if (orderIdParam) {
            setSelectedOrderId(orderIdParam);
            setActiveTab('orders');
        }

        const tabParam = searchParams.get('tab');
        if (tabParam) {
            setActiveTab(tabParam);
        }

        loadData();
    }, [authLoading, user, searchParams, navigate]);

    // If subscriptions tab becomes unavailable (no plans), switch to orders tab
    useEffect(() => {
        if (!loading && plans.length === 0 && activeTab === 'subscriptions') {
            setActiveTab('orders');
        }
    }, [plans, activeTab, loading]);

    useEffect(() => {
        if (user) {
            fetchOrders(orderPage);
        }
    }, [user, orderPage]);

    const fetchOrders = async (page = 1) => {
        setLoadingOrders(true);
        try {
            const res = await getMyOrders(page, orderLimit);
            let rawOrders = [];
            
            if (res.data && Array.isArray(res.data.items)) {
                rawOrders = res.data.items;
                setOrderTotalPages(res.data.pages || 1);
            } else if (Array.isArray(res.data)) {
                rawOrders = res.data;
            }

            // Hydrate order items with images if missing
            try {
                const fetches = [];
                for (const ord of rawOrders) {
                    if (!ord?.items || !Array.isArray(ord.items)) continue;
                    for (const it of ord.items) {
                        if (!it?.image && ord.store_id && it?.product_id) {
                            fetches.push(
                                getProduct(ord.store_id, it.product_id)
                                    .then(res => ({ orderId: ord.id, productId: it.product_id, image: res.data?.images?.[0] || null }))
                                    .catch(() => null)
                            );
                        }
                    }
                }
                
                if (fetches.length > 0) {
                    const results = await Promise.all(fetches);
                    const imageMap = new Map();
                    for (const r of results) {
                        if (r && r.image) {
                            imageMap.set(`${r.orderId}:${r.productId}`, r.image);
                        }
                    }
                    if (imageMap.size > 0) {
                        rawOrders = rawOrders.map(o => {
                            if (!o?.items) return o;
                            if (![...imageMap.keys()].some(k => k.startsWith(`${o.id}:`))) return o;
                            return {
                                ...o,
                                items: o.items.map(it => {
                                    const key = `${o.id}:${it.product_id}`;
                                    const img = imageMap.get(key);
                                    return img && !it.image ? { ...it, image: img } : it;
                                })
                            };
                        });
                    }
                }
            } catch (e) {
                // best-effort
            }
            
            setOrders(rawOrders);
        } catch (error) {
            console.error("Failed to fetch orders", error);
            toast.error("Failed to load orders");
        } finally {
            setLoadingOrders(false);
        }
    };

    const loadData = async () => {
        try {
            const [storeRes, subsRes, addrsRes, plansRes, taxRes, pricesRes] = await Promise.all([
                getStore(storeId),
                getMySubscriptions(),
                getAddresses(),
                getSubscriptionPlans(storeId).catch(() => ({ data: [] })),
                getStoreTaxConfig(storeId).catch(() => ({ data: null })),
                getMarketPrices(storeId).catch(() => ({ data: { prices: {} } }))
            ]);
            setStore(storeRes.data);
            setPageTitle(storeRes.data, 'Account');
            setPlans(plansRes.data || []);
            setTaxConfig(taxRes.data);
            setMarketPrices(pricesRes.data?.prices || {});
            // Orders loaded via fetchOrders

            
            // Fetch payment history for each subscription
            const subsWithPayments = await Promise.all(
                (subsRes.data || []).map(async (sub) => {
                    try {
                        const txnRes = await getSubscriptionTransactions(sub.id);
                        return { ...sub, payments: txnRes.data || [] };
                    } catch (e) {
                        console.error(`Failed to load payments for subscription ${sub.id}`, e);
                        return { ...sub, payments: [] };
                    }
                })
            );
            setSubscriptions(subsWithPayments);
            setAddresses(addrsRes.data);

            // Hydration moved to fetchOrders

        } catch (error) {
            console.error(error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAddress = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...newAddress };
            delete payload.id;
            delete payload.user_id;
            
            if (editingAddressId) {
                await updateAddress(editingAddressId, payload);
                toast.success('Address updated');
            } else {
                await createAddress(payload);
                toast.success('Address added');
            }
            setAddressDialogOpen(false);
            setEditingAddressId(null);
            setNewAddress({
                label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '',
                city: '', state: '', postal_code: '', country: 'India', special_instructions: '', is_default: false
            });
            loadData();
        } catch (error) {
            toast.error(editingAddressId ? 'Failed to update address' : 'Failed to add address');
        }
    };

    const handleDeleteAddress = async (id) => {
        if (!window.confirm('Delete this address?')) return;
        try {
            await deleteAddress(id);
            toast.success('Address deleted');
            loadData();
        } catch (error) {
            toast.error('Failed to delete address');
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();

        setUpdatingProfile(true);

        if (newPassword || confirmPassword || currentPassword) {
            if (!currentPassword) {
                toast.error('Enter your current password to change it');
                setUpdatingProfile(false);
                return;
            }
            if (newPassword !== confirmPassword) {
                toast.error('New passwords do not match');
                setUpdatingProfile(false);
                return;
            }
            if (newPassword && newPassword.length < 8) {
                toast.error('New password must be at least 8 characters');
                setUpdatingProfile(false);
                return;
            }
        }

        try {
            const res = await updateProfile(profileName);
            updateUser(res.data);

            if (newPassword) {
                await updatePassword(currentPassword, newPassword);
                toast.success('Password updated');
            }

            toast.success('Profile updated');
            setProfileDialogOpen(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update profile');
        } finally {
            setUpdatingProfile(false);
        }
    };

    const getMetalPrice = (plan) => {
        if (!plan || !marketPrices) return 0;
        const metal = (plan.target_metal || '').toLowerCase();
        if (metal === 'gold') return marketPrices.gold_22 || marketPrices.gold_24 || 0;
        if (metal === 'silver') return marketPrices.silver_1g || 0;
        if (metal === 'platinum') return marketPrices.platinum_1g || 0;
        return 0;
    };

    const handleOpenClosure = (sub) => {
        setSelectedSubscription(sub);
        setClosureStep(1);
        setClosurePreview(null);
        // Default select default address
        const defaultAddr = addresses.find(a => a.is_default) || addresses[0];
        if (defaultAddr) setSelectedAddressId(defaultAddr.id);
        setClosureDialogOpen(true);
    };

    const handlePreviewClosure = async () => {
        if (!selectedAddressId) {
            toast.error("Please select a delivery address");
            return;
        }
        setClosureLoading(true);
        try {
            const res = await previewClosure(selectedSubscription.id, { address_id: selectedAddressId });
            setClosurePreview(res.data);
            setClosureStep(2);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Failed to calculate closure details");
        } finally {
            setClosureLoading(false);
        }
    };

    const handleConfirmClosure = async () => {
        setPaymentProcessing(true);
        try {
            // Close 'Step' dialog
            setClosureDialogOpen(false);

            const { data: paymentOrder } = await initiateClosure(selectedSubscription.id, { address_id: selectedAddressId });

            // Check for Mock Order (Test Mode without valid keys)
            if (paymentOrder.razorpay_order_id && paymentOrder.razorpay_order_id.startsWith("order_mock_")) {
                console.log("Mock Payment Detected");
                // Simulate user payment interaction delay
                setTimeout(async () => {
                    const mockResponse = {
                        razorpay_order_id: paymentOrder.razorpay_order_id,
                        razorpay_payment_id: "pay_mock_" + Math.random().toString(36).substring(7),
                        razorpay_signature: "mock_signature_bypass"
                    };
                    try {
                        await verifyPayment({
                            razorpay_order_id: mockResponse.razorpay_order_id,
                            razorpay_payment_id: mockResponse.razorpay_payment_id,
                            razorpay_signature: mockResponse.razorpay_signature,
                            payment_id: paymentOrder.id
                        });
                        toast.success('Subscription Closed Successfully!');
                        window.location.href = `/store/${storeId}/portal?tab=orders`;
                    } catch (verifyErr) {
                        console.error('Payment verification error:', verifyErr);
                        toast.error('Payment verification failed');
                        setPaymentProcessing(false);
                    }
                }, 1500);
                return;
            }

            // Create payment using the new Razorpay utility
            await createRazorpayPayment(
                {
                    amount: paymentOrder.amount,
                    description: paymentOrder.description,
                    store_id: storeId,
                    order_id: paymentOrder.razorpay_order_id
                },
                {
                    name: store?.name || "Store Payment",
                    description: paymentOrder.description,
                    prefill: {
                        name: user?.name,
                        email: user?.email,
                        contact: user?.phone
                    },
                    theme: {
                        color: "#d4af37"
                    },
                    onSuccess: (response, orderData) => {
                        toast.success('Subscription Closed Successfully!');
                        window.location.href = `/store/${storeId}/portal?tab=orders`;
                    },
                    onError: (error) => {
                        console.error('Payment failed:', error);
                        toast.error(error?.description || error?.message || 'Payment failed');
                        setPaymentProcessing(false);
                    },
                    onCancel: () => {
                        setPaymentProcessing(false);
                    }
                }
            );

        } catch (error) {
            console.error(error);
            toast.error('Failed to initiate closure');
            setPaymentProcessing(false);
        }
    };

    const handlePaySubscription = async () => {
        if (!selectedSubscription) return;
        setPaymentProcessing(true);
        try {
            const isFlexible = selectedSubscription.scheme_type === 'flexible';
            const amountToPay = isFlexible ? parseFloat(flexibleAmount) : selectedSubscription.monthly_amount;

            if (isFlexible && (!amountToPay || amountToPay <= 0)) {
                toast.error("Please enter a valid amount");
                setPaymentProcessing(false);
                return;
            }

            const orderData = {
                amount: amountToPay,
                description: `Payment for subscription`,
                subscription_id: selectedSubscription.id,
                order_id: selectedSubscription.id,
                store_id: selectedSubscription.store_id
            };

            const { data: paymentOrder } = await createPaymentOrder(orderData);

            // Close dialog to prevent overlay interference with Razorpay popup
            setPaymentDialogOpen(false);

            // Create payment using the new Razorpay utility
            await createRazorpayPayment(
                {
                    amount: amountToPay,
                    description: paymentOrder.description,
                    store_id: selectedSubscription.store_id,
                    subscription_id: selectedSubscription.id,
                    order_id: selectedSubscription.id
                },
                {
                    name: store?.name || "Store Payment",
                    description: paymentOrder.description,
                    prefill: {
                        name: user?.name,
                        email: user?.email,
                        contact: user?.phone
                    },
                    theme: {
                        color: store?.settings?.primary_color || "#3399cc"
                    },
                    onSuccess: (response, orderData) => {
                        toast.success('Payment successful!');
                        window.location.href = `/store/${storeId}/portal?tab=subscriptions`;
                    },
                    onError: (error) => {
                        console.error('Payment failed:', error);
                        toast.error(error?.description || error?.message || 'Payment failed');
                        setPaymentProcessing(false);
                    },
                    onCancel: () => {
                        setPaymentProcessing(false);
                    }
                }
            );

        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || 'Payment failed');
            setPaymentProcessing(false);
        }
    };

    const viewTransactions = async (sub) => {
        setViewingSubscription(sub);
        setTransactionList([]);
        setTransactionDialogOpen(true);
        try {
            const res = await getSubscriptionTransactions(sub.id);
            setTransactionList(res.data);
        } catch (err) {
            toast.error('Failed to load transactions');
        }
    };

    const openPaymentDialog = (subscription) => {
        setSelectedSubscription(subscription);
        setPaymentDialogOpen(true);
    };

    // Check if subscription has already been paid for current month
    const hasAlreadyPaidThisMonth = (subscription) => {
        if (!subscription) return false;
        // Logic only applies to fixed/monthly schemes. Flexible can pay anytime.
        if (subscription.scheme_type === 'flexible') return false; 
        
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // 1. Check direct payments list
        if (subscription.payments && Array.isArray(subscription.payments)) {
            const hasPaymentThisMonth = subscription.payments.some(payment => {
                const dateStr = payment.payment_date || payment.created_at || payment.date;
                if (!dateStr) return false;
                
                const d = new Date(dateStr);
                // If it comes from getSubscriptionTransactions, it matches our current API.
                // Assuming filtering by 'completed' status is done by backend or explicit check here
                const isCompleted = payment.status === 'completed' || payment.type === 'payment';
                
                return d >= currentMonthStart && d <= currentMonthEnd && isCompleted;
            });
            if (hasPaymentThisMonth) return true;
        }

        // 2. Fallback: Check 'last_payment_date' or similar field if backend provides it
        // Or if the subscription was just created this month and has > 0 payments
        // We need to trust the backend's data. If user made a payment today, it should appear in the payments list or updated stats.
        
        // This logic is mostly client-side estimation. 
        // For robustness, let's rely on the `payments` array which we load via getSubscriptionTransactions or similar in loadData
        // But loadData() creates `subsWithPayments` by calling `getSubscriptionDetails` which includes payments logic.
        
        // If we don't have payments array but payments_made > 0, we can't be sure WHEN it was paid unless we check dates.
        // Assuming `subscriptions` state here HAS payments array populated from loadData()
        
        return false;
    };

    const getFlexibleTaxDetails = () => {
        if (!selectedSubscription || selectedSubscription.scheme_type !== 'flexible' || !flexibleAmount || !taxConfig) {
            return null;
        }
        
        const amount = parseFloat(flexibleAmount);
        if (isNaN(amount) || amount <= 0) return null;
        
        const plan = plans.find(p => p.id === selectedSubscription.plan_id);
        const targetMetal = plan?.target_metal || selectedSubscription.target_metal || 'gold';
        const metalTax = taxConfig.metal_taxes?.find(m => m.metal === targetMetal && m.is_enabled);
        
        if (!metalTax) return null;
        
        const cgstRate = metalTax.tax_rate.cgst || 0;
        const igstRate = metalTax.tax_rate.igst || 0;
        const totalTaxRate = (cgstRate + igstRate) / 100;
        
        // Backend logic: net_amount = amount / (1 + total_tax_rate)
        // so Tax = amount - net_amount
        const netAmount = amount / (1 + totalTaxRate);
        const taxAmount = amount - netAmount;
        
        // Split tax based on rates proportional contribution
        const totalRate = cgstRate + igstRate;
        if (totalRate === 0) return { cgst: 0, igst: 0, total: 0 };

        const cgstAmount = taxAmount * (cgstRate / totalRate);
        const igstAmount = taxAmount * (igstRate / totalRate);

        return {
            cgst: cgstAmount,
            igst: igstAmount,
            total: taxAmount,
            cgstRate,
            igstRate
        };
    };

    const taxDetails = getFlexibleTaxDetails();

    const handleLogout = () => {
        logout();
        navigate(`/store/${storeId}/login`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col w-full overflow-x-hidden">
            <StoreHeader
                store={store}
                storeId={storeId}
                cartTotal={cartCount}
                activeTab="portal"
                showSearch={true}
            />

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
                {/* Account summary */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Logged in as</p>
                        <div className="text-lg font-serif font-semibold flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{profileName || user?.name || 'User'}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">Email: {user?.email || 'N/A'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="link" className="px-0" onClick={() => setProfileDialogOpen(true)} data-testid="edit-profile-link">
                            <Edit2 className="w-4 h-4 mr-2" /> Edit profile
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleLogout} className="text-destructive hover:text-destructive" data-testid="logout-btn">
                            <LogOut className="w-4 h-4 mr-2" /> Logout
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="luxury-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
                            <Package className="w-5 h-5 gold-text" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-serif font-bold">{orders.length}</div>
                        </CardContent>
                    </Card>
                    <Card className="luxury-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
                            <CreditCard className="w-5 h-5 gold-text" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-serif font-bold">
                                {subscriptions.filter(s => s.status === 'active').length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="luxury-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Saved Addresses</CardTitle>
                            <MapPin className="w-5 h-5 gold-text" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-serif font-bold">{addresses.length}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className={`grid w-full max-w-md ${plans.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        <TabsTrigger value="orders" data-testid="orders-tab">Orders</TabsTrigger>
                        {plans.length > 0 && (
                            <TabsTrigger value="subscriptions" data-testid="subscriptions-tab">Subscriptions</TabsTrigger>
                        )}
                        <TabsTrigger value="addresses" data-testid="addresses-tab">Addresses</TabsTrigger>
                    </TabsList>

                    {/* Orders Tab */}
                    <TabsContent value="orders">
                        {selectedOrderId && orders.find(o => o.id === selectedOrderId) ? (
                            // Detailed Order View
                            <div>
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setSelectedOrderId(null)}
                                    className="mb-4"
                                >
                                    ← Back to Orders
                                </Button>
                                {(() => {
                                    const order = orders.find(o => o.id === selectedOrderId);
                                    return (
                                        <Card>
                                            <CardHeader className="border-b">
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                                    <div>
                                                        <CardTitle className="font-serif">Order Details</CardTitle>
                                                        <CardDescription className="font-mono text-xs mt-2">{order.id}</CardDescription>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Status</p>
                                                            <Badge className={getStatusColor(order.status)} style={{fontSize: '14px'}}>{order.status}</Badge>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Placed On</p>
                                                            <p className="font-semibold">{formatDate(order.created_at)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-6 pt-6">
                                                {/* Items Section */}
                                                <div>
                                                    <h3 className="font-semibold mb-4">Items</h3>
                                                    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                                                        {order.items.map((item, idx) => {
                                                            const productLink = (order.store_id && item.product_id) ? `/store/${order.store_id}/product/${item.product_id}` : null;
                                                            return (
                                                                <div key={idx} className="flex items-center justify-between pb-3 last:pb-0 last:border-b-0 border-b">
                                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                                        {productLink ? (
                                                                            <Link to={productLink} className="shrink-0">
                                                                                <div className="w-16 h-16 rounded bg-muted overflow-hidden hover:opacity-90">
                                                                                    {item.image ? (
                                                                                        <img src={getImageUrl(item.image)} alt={item.product_name} className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <div className="w-full h-full gold-gradient opacity-20" />
                                                                                    )}
                                                                                </div>
                                                                            </Link>
                                                                        ) : (
                                                                            <div className="w-16 h-16 rounded bg-muted overflow-hidden">
                                                                                {item.image ? (
                                                                                    <img src={getImageUrl(item.image)} alt={item.product_name} className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    <div className="w-full h-full gold-gradient opacity-20" />
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        <div className="min-w-0">
                                                                            <p className="font-semibold truncate">{item.product_name}</p>
                                                                            <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="font-semibold gold-text">{formatCurrency(item.price * item.quantity)}</p>
                                                                        <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} each</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Pricing Summary */}
                                                <div className="border-t pt-4">
                                                    <h3 className="font-semibold mb-3">Order Summary</h3>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Subtotal:</span>
                                                            <span>{formatCurrency(order.total_amount)}</span>
                                                        </div>
                                                        {order.discount_amount > 0 && (
                                                            <div className="flex justify-between text-green-600">
                                                                <span className="text-muted-foreground">Discount:</span>
                                                                <span>-{formatCurrency(order.discount_amount)}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between font-semibold text-base border-t pt-2">
                                                            <span>Total Amount:</span>
                                                            <span className="gold-text">{formatCurrency(order.total_amount)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Tracking Information */}
                                                {(order.tracking_number || order.carrier_name) && (
                                                    <div className="border-t pt-4 bg-green-50 dark:bg-green-900/20 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
                                                        <h3 className="font-semibold text-green-900 dark:text-green-100 mb-3">Shipping Information</h3>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                                            {order.tracking_number && (
                                                                <div>
                                                                    <p className="text-green-800 dark:text-green-200 text-xs">Tracking Number</p>
                                                                    <p className="font-mono font-semibold text-green-900 dark:text-green-100">{order.tracking_number}</p>
                                                                </div>
                                                            )}
                                                            {order.carrier_name && (
                                                                <div>
                                                                    <p className="text-green-800 dark:text-green-200 text-xs">Carrier</p>
                                                                    <p className="font-semibold text-green-900 dark:text-green-100">{order.carrier_name}</p>
                                                                </div>
                                                            )}
                                                            {order.carrier_url && (
                                                                <div>
                                                                    <p className="text-green-800 dark:text-green-200 text-xs">Track Shipment</p>
                                                                    <a 
                                                                        href={order.carrier_url} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="text-green-700 dark:text-green-300 hover:underline font-semibold flex items-center gap-1"
                                                                    >
                                                                        Track Now →
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Delivery Address */}
                                                {order.address && (
                                                    <div className="border-t pt-4">
                                                        <h3 className="font-semibold mb-3">Delivery Address</h3>
                                                        <div className="p-3 bg-muted rounded text-sm">
                                                            <p className="font-semibold">{order.address.full_name}</p>
                                                            <p>{order.address.address_line1}</p>
                                                            {order.address.address_line2 && <p>{order.address.address_line2}</p>}
                                                            <p>{order.address.city}, {order.address.state} {order.address.postal_code}</p>
                                                            <p className="text-muted-foreground">{order.address.country}</p>
                                                            {order.address.phone && <p className="text-muted-foreground mt-2">Phone: {order.address.phone}</p>}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })()}
                            </div>
                        ) : (
                            // Orders List View
                            <Card>
                                <CardHeader>
                                    <CardTitle className="font-serif">My Orders</CardTitle>
                                    <CardDescription>Track your order history and status</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {orders.length > 0 ? (
                                        <>
                                        <div className="space-y-4">
                                            {orders.map((order) => (
                                                <Card 
                                                    key={order.id} 
                                                    className="border cursor-pointer hover:shadow-md transition-shadow" 
                                                    data-testid={`order-card-${order.id}`}
                                                    onClick={() => setSelectedOrderId(order.id)}
                                                >
                                                    <CardContent className="p-4">
                                                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                                            <div>
                                                                <p className="font-mono text-sm text-muted-foreground">Order ID</p>
                                                                <p className="font-semibold">{order.id}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-muted-foreground">Status</p>
                                                                <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-muted-foreground">Total</p>
                                                                <p className="font-semibold gold-text">{formatCurrency(order.total_amount)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-muted-foreground">Date</p>
                                                                <p>{formatDate(order.created_at)}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="border-t pt-4 mb-4">
                                                            <p className="text-sm text-muted-foreground mb-2">Items</p>
                                                            <div className="space-y-2">
                                                                {order.items.map((item, idx) => {
                                                                    const productLink = (order.store_id && item.product_id) ? `/store/${order.store_id}/product/${item.product_id}` : null;
                                                                    return (
                                                                        <div key={idx} className="flex items-center justify-between text-sm">
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                {productLink ? (
                                                                                    <Link to={productLink} className="shrink-0">
                                                                                        <div className="w-10 h-10 rounded bg-muted overflow-hidden hover:opacity-90">
                                                                                            {item.image ? (
                                                                                                <img src={getImageUrl(item.image)} alt={item.product_name} className="w-full h-full object-cover" />
                                                                                            ) : (
                                                                                                <div className="w-full h-full gold-gradient opacity-20" />
                                                                                            )}
                                                                                        </div>
                                                                                    </Link>
                                                                                ) : (
                                                                                    <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                                                                                        {item.image ? (
                                                                                            <img src={getImageUrl(item.image)} alt={item.product_name} className="w-full h-full object-cover" />
                                                                                        ) : (
                                                                                            <div className="w-full h-full gold-gradient opacity-20" />
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                                <span className="truncate">{item.product_name} × {item.quantity}</span>
                                                                            </div>
                                                                            <span>{formatCurrency(item.price * item.quantity)}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Tracking Information */}
                                                        {(order.tracking_number || order.carrier_name) && (
                                                            <div className="border-t pt-4 bg-muted/30 -mx-4 -mb-4 px-4 pb-4 rounded-b-lg">
                                                                <p className="text-sm font-semibold mb-2">Tracking Information</p>
                                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                                                    {order.tracking_number && (
                                                                        <div>
                                                                            <p className="text-muted-foreground">Tracking Number</p>
                                                                            <p className="font-mono">{order.tracking_number}</p>
                                                                        </div>
                                                                    )}
                                                                    {order.carrier_name && (
                                                                        <div>
                                                                            <p className="text-muted-foreground">Carrier</p>
                                                                            <p>{order.carrier_name}</p>
                                                                        </div>
                                                                    )}
                                                                    {order.carrier_url && (
                                                                        <div>
                                                                            <p className="text-muted-foreground">Track Shipment</p>
                                                                            <a 
                                                                                href={order.carrier_url} 
                                                                                target="_blank" 
                                                                                rel="noopener noreferrer"
                                                                                className="gold-text hover:underline flex items-center gap-1"
                                                                            >
                                                                                Track Now →
                                                                            </a>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                        {orderTotalPages > 1 && (
                                            <div className="flex items-center justify-center gap-4 mt-6">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                                                    disabled={orderPage === 1 || loadingOrders}
                                                >
                                                    Previous
                                                </Button>
                                                <span className="text-sm font-medium">
                                                    Page {orderPage} of {orderTotalPages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setOrderPage(p => Math.min(orderTotalPages, p + 1))}
                                                    disabled={orderPage === orderTotalPages || loadingOrders}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        )}
                                        </>
                                    ) : (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                            <p>No orders yet</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Subscriptions Tab */}
                    <TabsContent value="subscriptions">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {subscriptions.length > 0 ? (
                                subscriptions.map((sub) => (
                                    <Card key={sub.id} className="luxury-card" data-testid={`subscription-card-${sub.id}`}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <Badge className="gold-gradient text-white">{sub.plan_name}</Badge>
                                                    {sub.plan_type && (
                                                        <Badge variant="outline" className="ml-2">{sub.plan_type}</Badge>
                                                    )}
                                                </div>
                                                <Badge variant={sub.status === 'active' ? 'default' : sub.status === 'completed' ? 'secondary' : 'destructive'}>
                                                    {sub.status}
                                                </Badge>
                                            </div>
                                            <CardTitle className="font-serif mt-2">
                                                {formatCurrency(sub.monthly_amount)}/month
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {sub.scheme_type === 'flexible' ? (
                                                <div>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-muted-foreground">Accumulated {sub.target_metal ? (sub.target_metal.charAt(0).toUpperCase() + sub.target_metal.slice(1)) : 'Metal'}</span>
                                                        <span className="font-bold">{(sub.accumulated_weight_grams || 0).toFixed(4)} g</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span>Progress</span>
                                                            <span>{sub.payments_made} of 11 payments</span>
                                                        </div>
                                                        <Progress value={(sub.payments_made / 11) * 100} className="h-2" />
                                                    </div>
                                                    <div className="flex justify-between text-sm pt-1">
                                                        <span className="text-muted-foreground">Accumulated {sub.target_metal ? (sub.target_metal.charAt(0).toUpperCase() + sub.target_metal.slice(1)) : 'Metal'}</span>
                                                        <span className="font-bold">{(sub.accumulated_weight_grams || 0).toFixed(4)} g</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-muted-foreground">Total Paid</span>
                                                    <p className="font-semibold gold-text">{formatCurrency(sub.total_paid)}</p>
                                                </div>
                                                {sub.scheme_type !== 'flexible' && (
                                                    <div>
                                                        <span className="text-muted-foreground">Maturity Date</span>
                                                        <p className="font-semibold">{formatDate(sub.maturity_date)}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">Started</span>
                                                <p>{formatDate(sub.start_date)}</p>
                                            </div>
                                            {sub.status === 'active' && (
                                                <div className="space-y-2">
                                                    <Button 
                                                        onClick={() => openPaymentDialog(sub)} 
                                                        disabled={hasAlreadyPaidThisMonth(sub) && sub.scheme_type !== 'flexible'}
                                                        className={`w-full text-white ${hasAlreadyPaidThisMonth(sub) && sub.scheme_type !== 'flexible' ? 'opacity-50 cursor-not-allowed' : 'gold-gradient'}`}
                                                        data-testid={`pay-subscription-${sub.id}`}
                                                    >
                                                        <IndianRupee className="w-4 h-4 mr-2" />
                                                        {hasAlreadyPaidThisMonth(sub) && sub.scheme_type !== 'flexible' 
                                                            ? 'Subscription already paid this month' 
                                                            : (sub.scheme_type === 'flexible' ? 'Pay Amount' : `Pay Monthly Installment (${formatCurrency(sub.monthly_amount)})`)}
                                                    </Button>
                                                    {sub.scheme_type === 'flexible' && (sub.accumulated_weight_grams || 0) > 0 && (
                                                        <Button
                                                            variant="secondary"
                                                            className="w-full text-gold bg-gold/10 hover:bg-gold/20 border border-gold/20"
                                                            onClick={() => handleOpenClosure(sub)}
                                                        >
                                                            Close & Buy {sub.target_metal ? (sub.target_metal.charAt(0).toUpperCase() + sub.target_metal.slice(1)) : 'Gold'} Coins ({(sub.accumulated_weight_grams || 0).toFixed(4)}g)
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                            <Button variant="outline" className="w-full mt-2 border-gold/30 hover:border-gold/60 text-foreground" onClick={() => viewTransactions(sub)}>
                                                 <History className="w-4 h-4 mr-2" /> View Transactions
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <Card className="col-span-full">
                                    <CardContent className="text-center py-12 text-muted-foreground">
                                        <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No active subscriptions</p>
                                        <p className="text-sm">Browse stores to subscribe to gold savings plans</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* Addresses Tab */}
                    <TabsContent value="addresses">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="font-serif">Saved Addresses</CardTitle>
                                    <CardDescription>Manage your delivery addresses</CardDescription>
                                </div>
                                <Button onClick={() => {
                                    setEditingAddressId(null);
                                    setNewAddress({
                                        label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '',
                                        city: '', state: '', postal_code: '', country: 'India', special_instructions: '', is_default: false
                                    });
                                    setAddressDialogOpen(true);
                                }} className="gold-gradient text-white" data-testid="add-address-btn">
                                    <Plus className="w-4 h-4 mr-2" /> Add Address
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {addresses.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {addresses.map((addr) => (
                                            <Card key={addr.id} className="relative" data-testid={`address-card-${addr.id}`}>
                                                <CardContent className="pt-6">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Badge variant="outline">{addr.label}</Badge>
                                                                {addr.is_default && <Badge>Default</Badge>}
                                                            </div>
                                                            <p className="font-medium">{addr.full_name}</p>
                                                            <p className="text-sm text-muted-foreground">{addr.phone}</p>
                                                            <p className="text-sm mt-2">
                                                                {addr.address_line1}<br />
                                                                {addr.address_line2 && <>{addr.address_line2}<br /></>}
                                                                {addr.city}, {addr.state} {addr.postal_code}<br />
                                                                {addr.country}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setEditingAddressId(addr.id);
                                                                    setNewAddress(addr);
                                                                    setAddressDialogOpen(true);
                                                                }}
                                                                data-testid={`edit-address-${addr.id}`}
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteAddress(addr.id)}
                                                                data-testid={`delete-address-${addr.id}`}
                                                            >
                                                                <Trash2 className="w-4 h-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No saved addresses</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>

            {/* Add Address Dialog */}
            <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">{editingAddressId ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveAddress} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Label</Label>
                                <Select value={newAddress.label} onValueChange={(v) => setNewAddress({ ...newAddress, label: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Home">Home</SelectItem>
                                        <SelectItem value="Work">Work</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input
                                    value={newAddress.full_name}
                                    onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                                    required
                                    data-testid="address-name-input"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input
                                value={newAddress.phone}
                                onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                                required
                                data-testid="address-phone-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Address Line 1</Label>
                            <Input
                                value={newAddress.address_line1}
                                onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                                required
                                data-testid="address-line1-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Address Line 2</Label>
                            <Input
                                value={newAddress.address_line2}
                                onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>City</Label>
                                <Input
                                    value={newAddress.city}
                                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                                    required
                                    data-testid="address-city-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>State</Label>
                                <Input
                                    value={newAddress.state}
                                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                                    required
                                    data-testid="address-state-input"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Postal Code</Label>
                                <Input
                                    value={newAddress.postal_code}
                                    onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                                    required
                                    data-testid="address-postal-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Country</Label>
                                <Input value={newAddress.country} disabled />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Special Instructions (Optional)</Label>
                            <Input placeholder="e.g., Ring doorbell twice, leave at gate" value={newAddress.special_instructions} onChange={(e) => setNewAddress({ ...newAddress, special_instructions: e.target.value })} />
                        </div>
                        <Button type="submit" className="w-full gold-gradient text-white" data-testid="save-address-btn">
                            Save Address
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Profile Dialog */}
            <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                <DialogContent className="relative sm:max-w-xl max-h-[80vh] overflow-y-auto">
                    {updatingProfile && (
                        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-10 flex items-center justify-center">
                            <div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    <DialogHeader>
                        <DialogTitle className="font-serif">Edit Profile</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input value={user?.email} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                required
                                data-testid="profile-name-input"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Current Password</Label>
                                <Input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>New Password</Label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Minimum 8 characters"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Confirm New Password</Label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter new password"
                                />
                            </div>
                        </div>
                        <Button type="submit" className="w-full gold-gradient text-white" data-testid="update-profile-btn" disabled={updatingProfile}>
                            {updatingProfile ? 'Updating...' : 'Update Profile'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Payment Dialog */}
            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Pay Monthly Installment</DialogTitle>
                    </DialogHeader>
                    {selectedSubscription && (
                        <div className="space-y-6">
                            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Plan</span>
                                    <span className="font-medium">{selectedSubscription.plan_name}</span>
                                </div>
                                {selectedSubscription.scheme_type === 'flexible' ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Accumulated Weight</span>
                                            <span className="font-medium">{(selectedSubscription.accumulated_weight_grams || 0).toFixed(4)} g</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Payments Made</span>
                                        <span className="font-medium">{selectedSubscription.payments_made} / 11</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Paid So Far</span>
                                    <span className="font-medium">{formatCurrency(selectedSubscription.total_paid)}</span>
                                </div>
                                <hr className="border-border" />
                                {selectedSubscription.scheme_type === 'flexible' ? (
                                    <div className="space-y-2 pt-2">
                                        <Label>Enter Amount to Pay</Label>
                                        <Input
                                            type="number"
                                            value={flexibleAmount}
                                            onChange={(e) => setFlexibleAmount(e.target.value)}
                                            placeholder="Enter amount"
                                            className="text-lg font-bold"
                                        />
                                        <p className="text-xs text-muted-foreground">Inclusive of GST</p>
                                        
                                        {taxDetails && (
                                            <div className="bg-secondary/20 p-2 rounded text-sm space-y-1 mt-2">
                                                <div className="flex justify-between">
                                                    <span>Net Amount (to convert)</span>
                                                    <span>{formatCurrency(parseFloat(flexibleAmount) - taxDetails.total)}</span>
                                                </div>
                                                {(() => {
                                                    const plan = plans.find(p => p.id === selectedSubscription.plan_id);
                                                    const price = getMetalPrice(plan);
                                                    const netAmount = parseFloat(flexibleAmount) - taxDetails.total;
                                                    if (price > 0 && netAmount > 0) {
                                                        const weight = netAmount / price;
                                                        return (
                                                             <div className="flex justify-between font-medium pt-1 pb-1 border-b border-border/50 mb-1">
                                                                <span>Est. Gold/Silver ({formatCurrency(price)}/g)</span>
                                                                <span className="gold-text">{weight.toFixed(4)} g</span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                <div className="flex justify-between text-muted-foreground text-xs">
                                                    <span>CGST ({taxDetails.cgstRate}%)</span>
                                                    <span>{formatCurrency(taxDetails.cgst)}</span>
                                                </div>
                                                <div className="flex justify-between text-muted-foreground text-xs">
                                                    <span>IGST ({taxDetails.igstRate}%)</span>
                                                    <span>{formatCurrency(taxDetails.igst)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex justify-between text-lg">
                                        <span className="font-semibold">Amount Due</span>
                                        <span className="font-bold gold-text">{formatCurrency(selectedSubscription.monthly_amount)}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setPaymentDialogOpen(false)} 
                                    className="flex-1"
                                    disabled={paymentProcessing}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handlePaySubscription} 
                                    className="flex-1 gold-gradient text-white"
                                    disabled={paymentProcessing}
                                    data-testid="confirm-payment-btn"
                                >
                                    {paymentProcessing ? 'Processing...' : 'Pay Now'}
                                </Button>
                            </div>
                            
                            <p className="text-xs text-center text-muted-foreground">
                                Payment will be processed securely.
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Closure Dialog */}
            <Dialog open={closureDialogOpen} onOpenChange={setClosureDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Close Subscription & Buy Coins</DialogTitle>
                    </DialogHeader>
                    {selectedSubscription && (
                        <div className="space-y-4">
                            {closureStep === 1 ? (
                                <>
                                    {(() => {
                                        const acc = selectedSubscription.accumulated_weight_grams || 0;
                                        const step = 0.25;
                                        // Handle potential floating point quirks by fixing input precision
                                        const accFixed = parseFloat(acc.toFixed(4));
                                        const tgt = Math.ceil(accFixed / step) * step;
                                        const diff = Math.max(0, tgt - accFixed);
                                        
                                        if (diff < 0.0001) return (
                                             <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-md text-sm mb-4 border border-green-200 dark:border-green-800">
                                                <p className="font-semibold text-green-800 dark:text-green-200">Ready for Redemption</p>
                                                <p className="text-green-700 dark:text-green-300">
                                                    You have accumulated <strong>{accFixed.toFixed(4)}g</strong>. This is a valid coin denomination.
                                                    Proceed to select a delivery address for shipping.
                                                </p>
                                            </div>
                                        );

                                        return (
                                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-sm mb-4 border border-blue-200 dark:border-blue-800">
                                              <p className="font-semibold text-blue-800 dark:text-blue-200">Redemption Status</p>
                                              <p className="text-blue-700 dark:text-blue-300 mt-1">
                                                Current accumulated value is <strong>{accFixed.toFixed(4)}g</strong>. 
                                              </p>
                                              <p className="text-blue-700 dark:text-blue-300 mt-1">
                                                You will have to purchase the remaining <strong>{diff.toFixed(4)} grams</strong> to reach the valid grams of <strong>{tgt.toFixed(4)}</strong>.
                                              </p>
                                            </div>
                                        );
                                    })()}
                                    <div className="space-y-2">
                                        <Label>Select Delivery Address</Label>
                                        <Select value={selectedAddressId} onValueChange={setSelectedAddressId}>
                                            <SelectTrigger><SelectValue placeholder="Select address" /></SelectTrigger>
                                            <SelectContent>
                                                {addresses.map(a => (
                                                    <SelectItem key={a.id} value={a.id}>{a.label} - {a.address_line1}, {a.city}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button variant="link" onClick={() => setAddressDialogOpen(true)} className="px-0 h-auto">
                                            + Add New Address
                                        </Button>
                                    </div>
                                    <Button onClick={handlePreviewClosure} disabled={closureLoading || !selectedAddressId} className="w-full">
                                        {closureLoading ? 'Calculating...' : 'Proceed to Preview'}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {closurePreview && (
                                        <div className="space-y-3 border p-4 rounded-lg bg-muted/20">
                                            {closurePreview.needed_grams > 0 ? (
                                                <>
                                                    <div className="bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-md text-sm mb-3">
                                                        <p className="font-semibold text-yellow-800 dark:text-yellow-200">Weight Adjustment Required</p>
                                                        <p className="text-yellow-700 dark:text-yellow-300">
                                                            Your accumulated metal ({closurePreview.accumulated_grams.toFixed(4)}g) is not a standard coin denomination. 
                                                            You need to purchase an additional <strong>{closurePreview.needed_grams.toFixed(4)}g</strong> to round off to the nearest valid coin size ({closurePreview.target_grams.toFixed(2)}g).
                                                        </p>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Accumulated Weight</span>
                                                        <span className="font-bold">{parseFloat(closurePreview.accumulated_grams.toFixed(4))} g</span>
                                                    </div>
                                                    <div className="flex justify-between text-muted-foreground">
                                                        <span>Rounding Up To</span>
                                                        <span>{parseFloat(closurePreview.target_grams.toFixed(4))} g</span>
                                                    </div>
                                                    <div className="flex justify-between text-gold font-medium border-t pt-2">
                                                        <span>Additional Gold Needed</span>
                                                        <span>{parseFloat(closurePreview.needed_grams.toFixed(4))} g</span>
                                                    </div>
                                                    
                                                    <div className="border-t my-2"></div>
                                                    
                                                    <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span>Gold Cost ({formatCurrency(closurePreview.gold_rate)}/g)</span>
                                                            <span>{formatCurrency(closurePreview.gold_cost)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Tax</span>
                                                            <span>{formatCurrency(closurePreview.tax_amount)}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-md text-sm mb-3">
                                                    <p className="font-semibold text-green-800 dark:text-green-200">Ready for Redemption</p>
                                                    <p className="text-green-700 dark:text-green-300">
                                                        Your accumulated metal ({closurePreview.accumulated_grams.toFixed(4)}g) matches a valid coin denomination. You only need to pay for shipping.
                                                    </p>
                                                </div>
                                            )}
                                            
                                            <div className="flex justify-between text-sm py-2">
                                                <span>Shipping Charges</span>
                                                <span>{formatCurrency(closurePreview.shipping_charges)}</span>
                                            </div>
                                            
                                            <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                                                <span>Total Payable</span>
                                                <span className="gold-text">{formatCurrency(closurePreview.total_amount)}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => setClosureStep(1)} className="flex-1">Back</Button>
                                        <Button onClick={handleConfirmClosure} disabled={paymentProcessing} className="flex-1 gold-gradient text-white">
                                            {paymentProcessing ? 'Processing...' : 'Pay & Close'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Transaction History Dialog */}
            <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-serif">Transaction History{viewingSubscription ? ` - ${viewingSubscription.plan_name}` : ''}</DialogTitle>
                    </DialogHeader>
                    {transactionList.length > 0 ? (
                        <div className="max-h-[60vh] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Rate</TableHead>
                                        <TableHead>Grams Purchased</TableHead>
                                        <TableHead>Transaction ID</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactionList.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell>{formatDateTime(t.date)}</TableCell>
                                            <TableCell className="font-medium text-gold">{formatCurrency(t.amount)}</TableCell>
                                            <TableCell className="text-muted-foreground">{t.metal_rate ? formatCurrency(t.metal_rate) + '/g' : '-'}</TableCell>
                                            <TableCell className="font-bold">{t.grams ? `${t.grams.toFixed(4)} g` : '-'}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{t.id}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No transactions found for this subscription.</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <StoreFooter store={store} storeId={storeId} />
            <LoadingOverlay isLoading={paymentProcessing} />
        </div>
    );
};

export default CustomerPortal;
