import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStores, createStore, deleteStore, getUsers, createUser, deleteUser, getStorePaymentConfig, updateStorePaymentConfig } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Store, Users, LogOut, Building2, CreditCard, Settings } from 'lucide-react';
import { formatDate, getRoleLabel, USER_ROLES } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

const SuperAdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [stores, setStores] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [storeDialogOpen, setStoreDialogOpen] = useState(false);
    const [userDialogOpen, setUserDialogOpen] = useState(false);
    const [paymentConfigDialogOpen, setPaymentConfigDialogOpen] = useState(false);
    const [selectedStoreForPayment, setSelectedStoreForPayment] = useState(null);
    const [paymentConfig, setPaymentConfig] = useState({ razorpay_key_id: '', razorpay_key_secret: '' });
    const [newStore, setNewStore] = useState({ name: '', description: '', currency: 'INR', contact_email: '', contact_phone: '', address: '' });
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'store_admin', store_id: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [storesRes, usersRes] = await Promise.all([getStores(), getUsers()]);
            setStores(storesRes.data);
            setUsers(usersRes.data);
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateStore = async (e) => {
        e.preventDefault();
        try {
            await createStore(newStore);
            toast.success('Store created successfully');
            setStoreDialogOpen(false);
            setNewStore({ name: '', description: '', currency: 'INR', contact_email: '', contact_phone: '', address: '' });
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to create store');
        }
    };

    const handleDeleteStore = async (storeId) => {
        if (!window.confirm('Are you sure you want to deactivate this store?')) return;
        try {
            await deleteStore(storeId);
            toast.success('Store deactivated');
            loadData();
        } catch (error) {
            toast.error('Failed to delete store');
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await createUser(newUser);
            toast.success('User created successfully');
            setUserDialogOpen(false);
            setNewUser({ name: '', email: '', password: '', role: 'store_admin', store_id: '' });
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to create user');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to deactivate this user?')) return;
        try {
            await deleteUser(userId);
            toast.success('User deactivated');
            loadData();
        } catch (error) {
            toast.error('Failed to delete user');
        }
    };

    const openPaymentConfigDialog = async (store) => {
        setSelectedStoreForPayment(store);
        try {
            const res = await getStorePaymentConfig(store.id);
            setPaymentConfig({
                razorpay_key_id: res.data.razorpay_key_id || '',
                razorpay_key_secret: ''
            });
        } catch (error) {
            setPaymentConfig({ razorpay_key_id: '', razorpay_key_secret: '' });
        }
        setPaymentConfigDialogOpen(true);
    };

    const handleSavePaymentConfig = async () => {
        if (!selectedStoreForPayment) return;
        try {
            await updateStorePaymentConfig(selectedStoreForPayment.id, paymentConfig);
            toast.success('Payment configuration saved');
            setPaymentConfigDialogOpen(false);
            setSelectedStoreForPayment(null);
            setPaymentConfig({ razorpay_key_id: '', razorpay_key_secret: '' });
        } catch (error) {
            toast.error('Failed to save payment configuration');
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
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-serif font-semibold">Super Admin</h1>
                            <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleLogout} data-testid="logout-btn">
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="luxury-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stores</CardTitle>
                            <Store className="w-5 h-5 gold-text" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-serif font-bold">{stores.length}</div>
                        </CardContent>
                    </Card>
                    <Card className="luxury-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                            <Users className="w-5 h-5 gold-text" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-serif font-bold">{users.length}</div>
                        </CardContent>
                    </Card>
                    <Card className="luxury-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Store Admins</CardTitle>
                            <Users className="w-5 h-5 gold-text" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-serif font-bold">
                                {users.filter(u => u.role === 'store_admin').length}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="stores" className="space-y-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="stores" data-testid="stores-tab">Stores</TabsTrigger>
                        <TabsTrigger value="users" data-testid="users-tab">Users</TabsTrigger>
                    </TabsList>

                    {/* Stores Tab */}
                    <TabsContent value="stores">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="font-serif">Stores</CardTitle>
                                    <CardDescription>Manage all stores in the system</CardDescription>
                                </div>
                                <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="gold-gradient text-white" data-testid="create-store-btn">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Store
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle className="font-serif">Create New Store</DialogTitle>
                                            <DialogDescription>Add a new store to the platform</DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateStore} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="store-name">Store Name</Label>
                                                <Input
                                                    id="store-name"
                                                    value={newStore.name}
                                                    onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                                                    required
                                                    data-testid="store-name-input"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="store-desc">Description</Label>
                                                <Input
                                                    id="store-desc"
                                                    value={newStore.description}
                                                    onChange={(e) => setNewStore({ ...newStore, description: e.target.value })}
                                                    data-testid="store-desc-input"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="store-currency">Currency</Label>
                                                    <Select value={newStore.currency} onValueChange={(v) => setNewStore({ ...newStore, currency: v })}>
                                                        <SelectTrigger data-testid="store-currency-select">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="INR">INR (₹)</SelectItem>
                                                            <SelectItem value="USD">USD ($)</SelectItem>
                                                            <SelectItem value="EUR">EUR (€)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="store-email">Contact Email</Label>
                                                    <Input
                                                        id="store-email"
                                                        type="email"
                                                        value={newStore.contact_email}
                                                        onChange={(e) => setNewStore({ ...newStore, contact_email: e.target.value })}
                                                        data-testid="store-email-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="store-phone">Contact Phone</Label>
                                                <Input
                                                    id="store-phone"
                                                    value={newStore.contact_phone}
                                                    onChange={(e) => setNewStore({ ...newStore, contact_phone: e.target.value })}
                                                    data-testid="store-phone-input"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="store-address">Address</Label>
                                                <Input
                                                    id="store-address"
                                                    value={newStore.address}
                                                    onChange={(e) => setNewStore({ ...newStore, address: e.target.value })}
                                                    data-testid="store-address-input"
                                                />
                                            </div>
                                            <Button type="submit" className="w-full gold-gradient text-white" data-testid="submit-store-btn">
                                                Create Store
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Currency</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead>Payment</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stores.map((store) => (
                                            <TableRow key={store.id} data-testid={`store-row-${store.id}`}>
                                                <TableCell className="font-medium">{store.name}</TableCell>
                                                <TableCell>{store.currency}</TableCell>
                                                <TableCell>{store.contact_email || '-'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={store.razorpay_key_id ? 'default' : 'outline'}>
                                                        {store.razorpay_key_id ? 'Configured' : 'Not Set'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={store.is_active ? 'default' : 'secondary'}>
                                                        {store.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{formatDate(store.created_at)}</TableCell>
                                                <TableCell className="text-right space-x-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openPaymentConfigDialog(store)}
                                                        title="Configure Razorpay"
                                                        data-testid={`config-payment-${store.id}`}
                                                    >
                                                        <CreditCard className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteStore(store.id)}
                                                        data-testid={`delete-store-${store.id}`}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {stores.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                    No stores yet. Create your first store to get started.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Users Tab */}
                    <TabsContent value="users">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="font-serif">Users</CardTitle>
                                    <CardDescription>Manage store admins and users</CardDescription>
                                </div>
                                <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="gold-gradient text-white" data-testid="create-user-btn">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add User
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle className="font-serif">Create New User</DialogTitle>
                                            <DialogDescription>Add a new admin or user</DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateUser} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="user-name">Name</Label>
                                                <Input
                                                    id="user-name"
                                                    value={newUser.name}
                                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                                    required
                                                    data-testid="user-name-input"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="user-email">Email</Label>
                                                <Input
                                                    id="user-email"
                                                    type="email"
                                                    value={newUser.email}
                                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                                    required
                                                    data-testid="user-email-input"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="user-password">Password</Label>
                                                <Input
                                                    id="user-password"
                                                    type="password"
                                                    value={newUser.password}
                                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                                    required
                                                    data-testid="user-password-input"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="user-role">Role</Label>
                                                <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                                                    <SelectTrigger data-testid="user-role-select">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="store_admin">Store Admin</SelectItem>
                                                        <SelectItem value="store_user">Store User</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="user-store">Assign to Store</Label>
                                                <Select value={newUser.store_id} onValueChange={(v) => setNewUser({ ...newUser, store_id: v })}>
                                                    <SelectTrigger data-testid="user-store-select">
                                                        <SelectValue placeholder="Select a store" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {stores.map((store) => (
                                                            <SelectItem key={store.id} value={store.id}>
                                                                {store.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button type="submit" className="w-full gold-gradient text-white" data-testid="submit-user-btn">
                                                Create User
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Store</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((u) => (
                                            <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                                                <TableCell className="font-medium">{u.name}</TableCell>
                                                <TableCell>{u.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{getRoleLabel(u.role)}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {stores.find(s => s.id === u.store_id)?.name || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={u.is_active ? 'default' : 'secondary'}>
                                                        {u.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {u.role !== 'super_admin' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteUser(u.id)}
                                                            data-testid={`delete-user-${u.id}`}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>

            {/* Payment Config Dialog */}
            <Dialog open={paymentConfigDialogOpen} onOpenChange={setPaymentConfigDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">
                            <CreditCard className="w-5 h-5 inline mr-2" />
                            Razorpay Configuration
                        </DialogTitle>
                        <DialogDescription>
                            Configure Razorpay payment gateway for {selectedStoreForPayment?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Razorpay Key ID</Label>
                            <Input
                                value={paymentConfig.razorpay_key_id}
                                onChange={(e) => setPaymentConfig({ ...paymentConfig, razorpay_key_id: e.target.value })}
                                placeholder="rzp_live_xxxxxxxxxxxx"
                                data-testid="razorpay-key-id-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Razorpay Key Secret</Label>
                            <Input
                                type="password"
                                value={paymentConfig.razorpay_key_secret}
                                onChange={(e) => setPaymentConfig({ ...paymentConfig, razorpay_key_secret: e.target.value })}
                                placeholder="Enter new secret to update"
                                data-testid="razorpay-key-secret-input"
                            />
                            <p className="text-xs text-muted-foreground">Leave blank to keep existing secret</p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button 
                                variant="outline" 
                                onClick={() => setPaymentConfigDialogOpen(false)} 
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSavePaymentConfig} 
                                className="flex-1 gold-gradient text-white"
                                data-testid="save-payment-config-btn"
                            >
                                Save Configuration
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SuperAdminDashboard;
