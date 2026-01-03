import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { getMyOrders, getMySubscriptions, getAddresses, createAddress, deleteAddress, updateProfile, paySubscription } from '../lib/api';
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
import { User, Package, CreditCard, MapPin, LogOut, Plus, Trash2, Edit2, Home, IndianRupee } from 'lucide-react';
import { formatCurrency, formatDate, getStatusColor } from '../lib/utils';

const CustomerPortal = () => {
    const { user, logout, updateUser } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('orders');
    const [addressDialogOpen, setAddressDialogOpen] = useState(false);
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [newAddress, setNewAddress] = useState({
        label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '',
        city: '', state: '', postal_code: '', country: 'India', is_default: false
    });
    const [profileName, setProfileName] = useState(user?.name || '');

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        loadData();
    }, [user]);

    const loadData = async () => {
        try {
            const [ordersRes, subsRes, addrsRes] = await Promise.all([
                getMyOrders(),
                getMySubscriptions(),
                getAddresses()
            ]);
            setOrders(ordersRes.data);
            setSubscriptions(subsRes.data);
            setAddresses(addrsRes.data);
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
                city: '', state: '', postal_code: '', country: 'India', is_default: false
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
        try {
            const res = await updateProfile(profileName);
            updateUser(res.data);
            toast.success('Profile updated');
            setProfileDialogOpen(false);
        } catch (error) {
            toast.error('Failed to update profile');
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-serif font-semibold">My Account</h1>
                            <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link to="/">
                            <Button variant="outline" data-testid="home-btn">
                                <Home className="w-4 h-4 mr-2" /> Home
                            </Button>
                        </Link>
                        <Button variant="outline" onClick={() => setProfileDialogOpen(true)} data-testid="edit-profile-btn">
                            <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
                        </Button>
                        <Button variant="outline" onClick={handleLogout} data-testid="logout-btn">
                            <LogOut className="w-4 h-4 mr-2" /> Logout
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-serif">My Orders</CardTitle>
                                <CardDescription>Track your order history and status</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {orders.length > 0 ? (
                                    <div className="space-y-4">
                                        {orders.map((order) => (
                                            <Card key={order.id} className="border" data-testid={`order-card-${order.id}`}>
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
                                                        <div className="space-y-1">
                                                            {order.items.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between text-sm">
                                                                    <span>{item.product_name} × {item.quantity}</span>
                                                                    <span>{formatCurrency(item.price * item.quantity)}</span>
                                                                </div>
                                                            ))}
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
                    </TabsContent>

                    {/* Subscriptions Tab */}
                    <TabsContent value="subscriptions">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {subscriptions.length > 0 ? (
                                subscriptions.map((sub) => (
                                    <Card key={sub.id} className="luxury-card" data-testid={`subscription-card-${sub.id}`}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <Badge className="gold-gradient text-white">{sub.plan_name}</Badge>
                                                <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
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
                        <Button type="submit" className="w-full gold-gradient text-white" data-testid="save-address-btn">
                            Save Address
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Profile Dialog */}
            <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                <DialogContent>
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
                        <Button type="submit" className="w-full gold-gradient text-white" data-testid="update-profile-btn">
                            Update Profile
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CustomerPortal;
