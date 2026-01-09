import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNavigate, Link, useSearchParams, useParams } from 'react-router-dom';
import { getMyOrders, getMySubscriptions, getAddresses, createAddress, deleteAddress, updateProfile, updatePassword, paySubscription, getProduct, getStore } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { User, Package, CreditCard, MapPin, LogOut, Plus, Trash2, Edit2, IndianRupee } from 'lucide-react';
import { formatCurrency, formatDate, getStatusColor, setPageTitle } from '../lib/utils';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';

const CustomerPortal = () => {
    const { storeId } = useParams();
    const { user, logout, updateUser, loading: authLoading } = useAuth();
    const { cartCount } = useCart(storeId);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [store, setStore] = useState(null);
    const [orders, setOrders] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('orders');
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [addressDialogOpen, setAddressDialogOpen] = useState(false);
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState(null);
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    const [newAddress, setNewAddress] = useState({
        label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '',
        city: '', state: '', postal_code: '', country: 'India', special_instructions: '', is_default: false
    });
    const [profileName, setProfileName] = useState(user?.name || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [updatingProfile, setUpdatingProfile] = useState(false);

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
        loadData();
    }, [authLoading, user, searchParams, navigate]);

    const loadData = async () => {
        try {
            const [storeRes, ordersRes, subsRes, addrsRes] = await Promise.all([
                getStore(storeId),
                getMyOrders(),
                getMySubscriptions(),
                getAddresses()
            ]);
            setStore(storeRes.data);
            setPageTitle(storeRes.data, 'Account');
            const rawOrders = ordersRes.data || [];
            // Sort orders by created_at timestamp (most recent first)
            rawOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setOrders(rawOrders);
            setSubscriptions(subsRes.data);
            setAddresses(addrsRes.data);

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
                        setOrders(prev => (prev || []).map(o => {
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
                        }));
                    }
                }
            } catch (e) {
                // best-effort; ignore failures
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddAddress = async (e) => {
        e.preventDefault();
        try {
            await createAddress(newAddress);
            toast.success('Address added');
            setAddressDialogOpen(false);
            setNewAddress({
                label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '',
                city: '', state: '', postal_code: '', country: 'India', special_instructions: '', is_default: false
            });
            loadData();
        } catch (error) {
            toast.error('Failed to add address');
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

    const handlePaySubscription = async () => {
        if (!selectedSubscription) return;
        setPaymentProcessing(true);
        try {
            await paySubscription(selectedSubscription.id, selectedSubscription.monthly_amount);
            toast.success('Payment successful!');
            setPaymentDialogOpen(false);
            setSelectedSubscription(null);
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Payment failed');
        } finally {
            setPaymentProcessing(false);
        }
    };

    const openPaymentDialog = (subscription) => {
        setSelectedSubscription(subscription);
        setPaymentDialogOpen(true);
    };

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
        <div className="min-h-screen bg-background flex flex-col">
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
                    <TabsList className="grid w-full max-w-md grid-cols-3">
                        <TabsTrigger value="orders" data-testid="orders-tab">Orders</TabsTrigger>
                        <TabsTrigger value="subscriptions" data-testid="subscriptions-tab">Subscriptions</TabsTrigger>
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
                                                                                        <img src={item.image} alt={item.product_name} className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <div className="w-full h-full gold-gradient opacity-20" />
                                                                                    )}
                                                                                </div>
                                                                            </Link>
                                                                        ) : (
                                                                            <div className="w-16 h-16 rounded bg-muted overflow-hidden">
                                                                                {item.image ? (
                                                                                    <img src={item.image} alt={item.product_name} className="w-full h-full object-cover" />
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
                                                                                                <img src={item.image} alt={item.product_name} className="w-full h-full object-cover" />
                                                                                            ) : (
                                                                                                <div className="w-full h-full gold-gradient opacity-20" />
                                                                                            )}
                                                                                        </div>
                                                                                    </Link>
                                                                                ) : (
                                                                                    <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                                                                                        {item.image ? (
                                                                                            <img src={item.image} alt={item.product_name} className="w-full h-full object-cover" />
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
                                            <div>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span>Progress</span>
                                                    <span>{sub.payments_made} of 11 payments</span>
                                                </div>
                                                <Progress value={(sub.payments_made / 11) * 100} className="h-2" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-muted-foreground">Total Paid</span>
                                                    <p className="font-semibold gold-text">{formatCurrency(sub.total_paid)}</p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Maturity Date</span>
                                                    <p className="font-semibold">{formatDate(sub.maturity_date)}</p>
                                                </div>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">Started</span>
                                                <p>{formatDate(sub.start_date)}</p>
                                            </div>
                                            {sub.status === 'active' && (
                                                <Button 
                                                    onClick={() => openPaymentDialog(sub)} 
                                                    className="w-full gold-gradient text-white"
                                                    data-testid={`pay-subscription-${sub.id}`}
                                                >
                                                    <IndianRupee className="w-4 h-4 mr-2" />
                                                    Pay Monthly Installment ({formatCurrency(sub.monthly_amount)})
                                                </Button>
                                            )}
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
                                <Button onClick={() => setAddressDialogOpen(true)} className="gold-gradient text-white" data-testid="add-address-btn">
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
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteAddress(addr.id)}
                                                            data-testid={`delete-address-${addr.id}`}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
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
                        <DialogTitle className="font-serif">Add New Address</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddAddress} className="space-y-4">
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
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Payments Made</span>
                                    <span className="font-medium">{selectedSubscription.payments_made} / 11</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Paid So Far</span>
                                    <span className="font-medium">{formatCurrency(selectedSubscription.total_paid)}</span>
                                </div>
                                <hr className="border-border" />
                                <div className="flex justify-between text-lg">
                                    <span className="font-semibold">Amount Due</span>
                                    <span className="font-bold gold-text">{formatCurrency(selectedSubscription.monthly_amount)}</span>
                                </div>
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
                                Payment will be processed securely. This is a MOCK payment for demonstration.
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <StoreFooter store={store} storeId={storeId} />
        </div>
    );
};

export default CustomerPortal;
