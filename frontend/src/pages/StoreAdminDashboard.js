import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useParams } from 'react-router-dom';
import {
    getStores, getProducts, getProduct, createProduct, updateProduct, deleteProduct,
    getInventory, createInventory, updateInventory,
    getOrders, updateOrderStatus,
    getVendors, createVendor, updateVendor, deleteVendor,
    getPurchaseOrders, createPurchaseOrder, updatePurchaseOrder, updatePOStatus, deletePurchaseOrder,
    getPOSTransactions, createPOSTransaction, updatePOSTransaction, deletePOSTransaction,
    getSubscriptionPlans, createSubscriptionPlan, updateSubscriptionPlan,
    getStoreSubscribers, getSubscriptionDetails, updateSubscriptionStatus, deleteSubscription,
    updateStoreSettings, updateStore, getStoreReports,
    getStoreStaff, createStaff, updateStaff, deleteStaff, getStaffActivity,
    getStoreCustomers, getCustomerDetails, updateCustomer, deleteCustomer
} from '../lib/api';
import { adminCreateShiprocketOrder, adminSyncShiprocketOrder, adminCancelShiprocketOrder, adminShiprocketAction } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
    Plus, Trash2, Package, ShoppingCart, Users, Settings, LogOut,
    Box, Truck, DollarSign, CreditCard, Edit2, LayoutDashboard, Palette, Eye, Building2,
    BarChart3, Filter, Calendar, UserCog, Contact, Activity, Shield, FileText
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, setPageTitle, getImageUrl } from '../lib/utils';
import MarketPriceSettings from '../components/MarketPriceSettings';
import StoreSettings from '../components/StoreSettings';
import StoreTaxConfig from '../components/StoreTaxConfig';
import StoreLogs from '../components/StoreLogs';
import ShiprocketLogs from '../components/admin/ShiprocketLogs';
import MediaLibrary from '../components/admin/MediaLibrary';
import { Image as ImageIcon } from 'lucide-react';

const IMAGE_SERVER_URL = process.env.REACT_APP_IMAGE_SERVER_URL || 'http://localhost:8001';

const StoreAdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [orders, setOrders] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [posTransactions, setPosTransactions] = useState([]);
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [staff, setStaff] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    // Set initial tab based on user's menu access
    const getInitialTab = () => {
        if (user?.role === 'super_admin' || user?.role === 'store_admin') {
            return 'products';
        }
        const menuAccess = user?.menu_access || [];
        return menuAccess.length > 0 ? menuAccess[0] : 'products';
    };
    const [activeTab, setActiveTab] = useState(getInitialTab());

    // Dialog states
    const [productDialogOpen, setProductDialogOpen] = useState(false);
    const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
    const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
    const [poDialogOpen, setPoDialogOpen] = useState(false);
    const [posDialogOpen, setPosDialogOpen] = useState(false);
    const [planDialogOpen, setPlanDialogOpen] = useState(false);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [marketPricesSidebarOpen, setMarketPricesSidebarOpen] = useState(false);
    const [storeEditDialogOpen, setStoreEditDialogOpen] = useState(false);
    const [orderDetailOpen, setOrderDetailOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderTrackingInfo, setOrderTrackingInfo] = useState({ tracking_number: '', carrier_name: '', carrier_url: '' });
    // Order edit states
    const [orderEditStatus, setOrderEditStatus] = useState('');
    const [orderCarrier, setOrderCarrier] = useState('');
    const [orderTrackingNumber, setOrderTrackingNumber] = useState('');
    const [orderTrackingUrl, setOrderTrackingUrl] = useState('');
    const [canceledItems, setCanceledItems] = useState(new Set());

    // Allowed status options for admin edit
    const ORDER_STATUS_OPTIONS = [
        { value: 'placed', label: 'Placed' },
        { value: 'picking started', label: 'Picking Started' },
        { value: 'packed', label: 'Packed' },
        { value: 'sr-order', label: 'SR-Order', disabled: true },
        { value: 'sr-ship', label: 'SR-Ship', disabled: true },
        { value: 'sr-schedule-pickup', label: 'SR-Schedule-Pickup', disabled: true },
        { value: 'shipped', label: 'Shipped' }
    ];
    const DISABLED_STATUSES = ORDER_STATUS_OPTIONS.filter(o => o.disabled).map(o => o.value);
    const [storeEditForm, setStoreEditForm] = useState({ name: '', description: '', contact_email: '', contact_phone: '', address: '', address_map_url: '' });
    
    // Staff management states
    const [staffDialogOpen, setStaffDialogOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [newStaff, setNewStaff] = useState({ email: '', password: '', name: '', phone: '', menu_access: ['products', 'inventory', 'orders', 'pos'], is_active: true });
    const [staffActivityOpen, setStaffActivityOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [staffActivityData, setStaffActivityData] = useState(null);
    
    // Customer management states
    const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerData, setCustomerData] = useState(null);
    const [customerEditOpen, setCustomerEditOpen] = useState(false);
    const [customerEditForm, setCustomerEditForm] = useState({ name: '', phone: '' });

    // Media
    const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
    const [mediaSelectCallback, setMediaSelectCallback] = useState(null);

    // Form states
    const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', category: '', sku: '', weight: '', images: [''] });
    const [editingProduct, setEditingProduct] = useState(null);
    const [editingInventory, setEditingInventory] = useState(null);
    const [editingVendor, setEditingVendor] = useState(null);
    const [editingPlan, setEditingPlan] = useState(null);
    const [editingPO, setEditingPO] = useState(null);
    const [editingPOS, setEditingPOS] = useState(null);
    const [newInventory, setNewInventory] = useState({ product_id: '', quantity: '', min_stock_level: 5, location: '' });
    const [newVendor, setNewVendor] = useState({ name: '', contact_name: '', email: '', phone: '', address: '', gst_number: '' });
    const [newPO, setNewPO] = useState({ vendor_id: '', items: [{ product_id: '', quantity: '', unit_price: '' }], notes: '' });
    const [posItems, setPosItems] = useState([{ product_id: '', quantity: 1, price: 0 }]);
    const [posPaymentMethod, setPosPaymentMethod] = useState('cash');
    const [posCustomer, setPosCustomer] = useState({ name: '', phone: '' });
    const [newPlan, setNewPlan] = useState({ name: '', plan_type: '', duration_months: 11, min_amount: 500, max_amount: 100000, bonus_percentage: 0, benefits: [], description: '', scheme_type: 'fixed', target_metal: 'gold', metal_purity_key: 'auto' });
    const [currency, setCurrency] = useState('INR');
    const [subscribers, setSubscribers] = useState([]);
    const [selectedSubscription, setSelectedSubscription] = useState(null);
    const [subscriptionDetails, setSubscriptionDetails] = useState(null);
    const [subscriberDialogOpen, setSubscriberDialogOpen] = useState(false);

    // Filter states
    const [filters, setFilters] = useState({
        products: { search: '', category: '' },
        inventory: { search: '' },
        orders: { status: '', startDate: '', endDate: '' },
        pos: { startDate: '', endDate: '', paymentMethod: '' },
        vendors: { search: '' },
        purchaseOrders: { status: '', vendorId: '' }
    });

    // Reporting states
    const [reportData, setReportData] = useState(null);
    const [reportPeriod, setReportPeriod] = useState({ startDate: '', endDate: '' });
    const [reportLoading, setReportLoading] = useState(false);

    // Pagination state
    const [pagination, setPagination] = useState({
        products: { page: 1, limit: 20, total: 0, pages: 1 },
        inventory: { page: 1, limit: 20, total: 0, pages: 1 },
        orders: { page: 1, limit: 20, total: 0, pages: 1 },
        vendors: { page: 1, limit: 20, total: 0, pages: 1 },
        purchaseOrders: { page: 1, limit: 20, total: 0, pages: 1 },
        posTransactions: { page: 1, limit: 20, total: 0, pages: 1 },
        staff: { page: 1, limit: 20, total: 0, pages: 1 },
        customers: { page: 1, limit: 20, total: 0, pages: 1 },
        subscribers: { page: 1, limit: 20, total: 0, pages: 1 },
    });

    const handlePageChange = (entity, newPage) => {
        setPagination(prev => ({ ...prev, [entity]: { ...prev[entity], page: newPage } }));
    };

    const processPaginatedResponse = (response, entityKey, setFunction) => {
        if (response.data && response.data.items && typeof response.data.total === 'number') {
            setFunction(response.data.items);
            setPagination(prev => ({
                ...prev,
                [entityKey]: {
                    page: response.data.page,
                    limit: response.data.limit,
                    total: response.data.total,
                    pages: response.data.pages
                }
            }));
        } else if (Array.isArray(response.data)) {
            setFunction(response.data);
            setPagination(prev => ({
                 ...prev,
                 [entityKey]: { ...prev[entityKey], total: response.data.length, pages: 1 }
            }));
        } else {
             // Fallback for empty or error
             setFunction([]);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        loadStoreInfo();
    }, []);

    // Load data when tab or pagination changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!store) return;
        loadTabContent();
    }, [store, activeTab, 
        pagination.products.page, pagination.inventory.page, pagination.orders.page, 
        pagination.vendors.page, pagination.purchaseOrders.page, pagination.posTransactions.page, 
        pagination.staff.page, pagination.customers.page, pagination.subscribers.page
    ]);

    const loadStoreInfo = async () => {
         try {
            const storesRes = await getStores();
            const userStore = storesRes.data.find(s => s.id === user.store_id) || storesRes.data[0];
            if (!userStore) {
                toast.error('No store assigned');
                return;
            }
            setStore(userStore);
            setPageTitle(userStore, 'Admin');
            setCurrency(userStore.currency);
            
            // Pre-load critical data if needed? No, let loadTabContent handle it.
            // But we might need subscription plans everywhere?
            const plansRes = await getSubscriptionPlans(userStore.id).catch(() => ({ data: [] }));
            setSubscriptionPlans(plansRes.data);

         } catch (error) {
            console.error(error);
            toast.error('Failed to load store info');
        } finally {
            setLoading(false);
        }
    };

    const loadTabContent = async () => {
         if (!store) return;
         setLoading(true);
         try {
             const storeId = store.id;
             switch (activeTab) {
                 case 'products':
                     const pRes = await getProducts(storeId, null, false, null, pagination.products.limit, pagination.products.page);
                     processPaginatedResponse(pRes, 'products', setProducts);
                     break;
                 case 'inventory':
                     const iRes = await getInventory(storeId, pagination.inventory.page, pagination.inventory.limit);
                     processPaginatedResponse(iRes, 'inventory', setInventory);
                     break;
                 case 'orders':
                     const oRes = await getOrders(storeId, pagination.orders.page, pagination.orders.limit);
                     processPaginatedResponse(oRes, 'orders', setOrders);
                     break;
                 case 'vendors':
                     const vRes = await getVendors(storeId, pagination.vendors.page, pagination.vendors.limit);
                     processPaginatedResponse(vRes, 'vendors', setVendors);
                     break;
                 case 'purchase-orders':
                     const poRes = await getPurchaseOrders(storeId, pagination.purchaseOrders.page, pagination.purchaseOrders.limit);
                     processPaginatedResponse(poRes, 'purchaseOrders', setPurchaseOrders);
                     break;
                 case 'pos':
                     const posRes = await getPOSTransactions(storeId, pagination.posTransactions.page, pagination.posTransactions.limit);
                     processPaginatedResponse(posRes, 'posTransactions', setPosTransactions);
                     break;
                 case 'staff':
                     const sRes = await getStoreStaff(storeId, pagination.staff.page, pagination.staff.limit);
                     processPaginatedResponse(sRes, 'staff', setStaff);
                     break;
                 case 'customers':
                     const cRes = await getStoreCustomers(storeId, pagination.customers.page, pagination.customers.limit);
                     processPaginatedResponse(cRes, 'customers', setCustomers);
                     break;
                 case 'subscribers':
                     const subRes = await getStoreSubscribers(storeId); // Not paginated yet
                     setSubscribers(subRes.data || []);
                     break;
                 default:
                     break;
             }
         } catch(e) {
             console.error("Load tab content failed", e);
             toast.error("Failed to load data");
         } finally {
             setLoading(false);
         }
    };

    /* DEPRECATED loadData replaced by loadStoreInfo */

    // Set document title to store name + Admin
    useEffect(() => {
        if (store?.name) {
            document.title = `${store.name} - Admin`;
        }
        return () => {
            document.title = 'Store Admin';
        };
    }, [store?.name]);

    // loadData replaced by loadTabContent


    // Filtered data using useMemo
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            if (filters.products.search && !p.name.toLowerCase().includes(filters.products.search.toLowerCase())) return false;
            if (filters.products.category && p.category !== filters.products.category) return false;
            return true;
        });
    }, [products, filters.products]);

    const filteredInventory = useMemo(() => {
        return inventory.filter(i => {
            if (filters.inventory.search) {
                const productName = products.find(p => p.id === i.product_id)?.name || '';
                if (!productName.toLowerCase().includes(filters.inventory.search.toLowerCase())) return false;
            }
            return true;
        });
    }, [inventory, products, filters.inventory]);

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            if (filters.orders.status && o.status !== filters.orders.status) return false;
            if (filters.orders.startDate && o.created_at < filters.orders.startDate) return false;
            if (filters.orders.endDate && o.created_at > filters.orders.endDate + 'T23:59:59') return false;
            return true;
        });
    }, [orders, filters.orders]);

    const filteredPOS = useMemo(() => {
        return posTransactions.filter(t => {
            if (filters.pos.paymentMethod && t.payment_method !== filters.pos.paymentMethod) return false;
            if (filters.pos.startDate && t.created_at < filters.pos.startDate) return false;
            if (filters.pos.endDate && t.created_at > filters.pos.endDate + 'T23:59:59') return false;
            return true;
        });
    }, [posTransactions, filters.pos]);

    const filteredVendors = useMemo(() => {
        return vendors.filter(v => {
            if (filters.vendors.search && !v.name.toLowerCase().includes(filters.vendors.search.toLowerCase())) return false;
            return true;
        });
    }, [vendors, filters.vendors]);

    const filteredPurchaseOrders = useMemo(() => {
        return purchaseOrders.filter(po => {
            if (filters.purchaseOrders.status && po.status !== filters.purchaseOrders.status) return false;
            if (filters.purchaseOrders.vendorId && po.vendor_id !== filters.purchaseOrders.vendorId) return false;
            return true;
        });
    }, [purchaseOrders, filters.purchaseOrders]);

    const productCategories = useMemo(() => {
        return [...new Set(products.filter(p => p.category).map(p => p.category))];
    }, [products]);

    // Reporting
    const loadReport = async () => {
        if (!store) return;
        setReportLoading(true);
        try {
            const res = await getStoreReports(store.id, reportPeriod.startDate || null, reportPeriod.endDate || null);
            setReportData(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load report');
        } finally {
            setReportLoading(false);
        }
    };

    // POS Edit/Delete handlers
    const handleEditPOS = (tx) => {
        setEditingPOS(tx);
        setPosItems(tx.items.map(item => ({ product_id: item.product_id, quantity: item.quantity, price: item.price })));
        setPosPaymentMethod(tx.payment_method);
        setPosCustomer({ name: tx.customer_name || '', phone: tx.customer_phone || '' });
        setPosDialogOpen(true);
    };

    const handleDeletePOS = async (txId) => {
        if (!window.confirm('Delete this POS transaction?')) return;
        try {
            await deletePOSTransaction(store.id, txId);
            toast.success('Transaction deleted');
            loadTabContent();
        } catch (error) {
            toast.error('Failed to delete transaction');
        }
    };

    // PO Edit/Delete handlers
    const handleEditPO = (po) => {
        setEditingPO(po);
        setNewPO({
            vendor_id: po.vendor_id,
            items: po.items.map(item => ({ product_id: item.product_id, quantity: item.quantity.toString(), unit_price: item.unit_price.toString() })),
            notes: po.notes || ''
        });
        setPoDialogOpen(true);
    };

    const handleDeletePO = async (poId) => {
        if (!window.confirm('Delete this purchase order?')) return;
        try {
            await deletePurchaseOrder(store.id, poId);
            toast.success('Purchase order deleted');
            loadTabContent();
        } catch (error) {
            toast.error('Failed to delete purchase order');
        }
    };

    const handleUpdatePOStatus = async (poId, status) => {
        try {
            await updatePOStatus(store.id, poId, status);
            toast.success('PO status updated');
            loadTabContent();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };
    
    // View subscription details
    const handleViewSubscription = async (subscription) => {
        try {
            const res = await getSubscriptionDetails(store.id, subscription.id);
            setSubscriptionDetails(res.data);
            setSubscriberDialogOpen(true);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load subscription details');
        }
    };

    const handleUpdateSubscriptionStatus = async (subscriptionId, newStatus) => {
        try {
            await updateSubscriptionStatus(store.id, subscriptionId, newStatus);
            toast.success(`Status updated to ${newStatus}`);
            loadTabContent();
            // If viewing details, refresh them
            if (subscriptionDetails && subscriptionDetails.subscription.id === subscriptionId) {
                const res = await getSubscriptionDetails(store.id, subscriptionId);
                setSubscriptionDetails(res.data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to update status');
        }
    };

    const handleDeleteSubscription = async (subscriptionId) => {
        if (!window.confirm('Are you sure you want to delete this subscription? This will also delete all payment history.')) return;
        try {
            await deleteSubscription(store.id, subscriptionId);
            toast.success('Subscription deleted');
            setSubscriberDialogOpen(false);
            setSubscriptionDetails(null);
            loadTabContent();
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete subscription');
        }
    };

    // Staff handlers
    const handleCreateStaff = async (e) => {
        e.preventDefault();
        try {
            if (editingStaff) {
                const updateData = { 
                    name: newStaff.name, 
                    phone: newStaff.phone, 
                    menu_access: newStaff.menu_access,
                    is_active: newStaff.is_active
                };
                // Only include password if it's been changed
                if (newStaff.password && newStaff.password.trim()) {
                    updateData.password = newStaff.password;
                }
                await updateStaff(store.id, editingStaff.id, updateData);
                toast.success('Staff updated');
                setEditingStaff(null);
            } else {
                await createStaff(store.id, newStaff);
                toast.success('Staff created');
            }
            setStaffDialogOpen(false);
            setNewStaff({ email: '', password: '', name: '', phone: '', menu_access: ['products', 'inventory', 'orders', 'pos'], is_active: true });
            loadTabContent();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save staff');
        }
    };

    const openEditStaff = (staffMember) => {
        setEditingStaff(staffMember);
        setNewStaff({
            email: staffMember.email,
            password: '',
            name: staffMember.name,
            phone: staffMember.phone || '',
            menu_access: staffMember.menu_access || [],
            is_active: staffMember.is_active !== false
        });
        setStaffDialogOpen(true);
    };

    const handleDeleteStaff = async (staffId) => {
        if (!window.confirm('Are you sure you want to delete this staff member?')) return;
        try {
            await deleteStaff(store.id, staffId);
            toast.success('Staff deleted');
            loadTabContent();
        } catch (error) {
            toast.error('Failed to delete staff');
        }
    };

    const handleViewStaffActivity = async (staffMember) => {
        setSelectedStaff(staffMember);
        try {
            const res = await getStaffActivity(store.id, staffMember.id);
            setStaffActivityData(res.data);
            setStaffActivityOpen(true);
        } catch (error) {
            toast.error('Failed to load activity');
        }
    };

    const toggleStaffAccess = (menuKey) => {
        setNewStaff(prev => ({
            ...prev,
            menu_access: prev.menu_access.includes(menuKey)
                ? prev.menu_access.filter(m => m !== menuKey)
                : [...prev.menu_access, menuKey]
        }));
    };

    // Customer handlers
    const handleViewCustomerDetails = async (customer) => {
        setSelectedCustomer(customer);
        try {
            const res = await getCustomerDetails(store.id, customer.id);
            setCustomerData(res.data);
            setCustomerDetailOpen(true);
        } catch (error) {
            toast.error('Failed to load customer details');
        }
    };

    const openEditCustomer = (customer) => {
        setSelectedCustomer(customer);
        setCustomerEditForm({ name: customer.name || '', phone: customer.phone || '' });
        setCustomerEditOpen(true);
    };

    const handleUpdateCustomer = async (e) => {
        e.preventDefault();
        try {
            await updateCustomer(store.id, selectedCustomer.id, customerEditForm);
            toast.success('Customer updated');
            setCustomerEditOpen(false);
            loadTabContent();
        } catch (error) {
            toast.error('Failed to update customer');
        }
    };

    const handleDeleteCustomer = async (customerId) => {
        if (!window.confirm('Are you sure you want to delete this customer? This cannot be undone.')) return;
        try {
            await deleteCustomer(store.id, customerId);
            toast.success('Customer deleted');
            setCustomerDetailOpen(false);
            loadTabContent();
        } catch (error) {
            toast.error('Failed to delete customer');
        }
    };

    // Product handlers
    const handleCreateProduct = async (e) => {
        e.preventDefault();
        try {
            const productData = {
                ...newProduct,
                price: parseFloat(newProduct.price),
                weight: newProduct.weight ? parseFloat(newProduct.weight) : null,
                images: newProduct.images.filter(img => img.trim() !== ''),
                featured: !!newProduct.featured
            };
            
            if (editingProduct) {
                await updateProduct(store.id, editingProduct.id, productData);
                toast.success('Product updated');
                setEditingProduct(null);
            } else {
                await createProduct(store.id, productData);
                toast.success('Product created');
            }
            setProductDialogOpen(false);
            setNewProduct({ name: '', description: '', price: '', category: '', sku: '', weight: '', images: [''] });
            loadTabContent();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save product');
        }
    };

    const openEditProduct = (product) => {
        setEditingProduct(product);
        setNewProduct({
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            category: product.category || '',
            sku: product.sku || '',
            weight: product.weight?.toString() || '',
            images: product.images?.length > 0 ? product.images : [''],
            featured: !!product.featured
        });
        setProductDialogOpen(true);
    };

    const addImageField = () => {
        setNewProduct({ ...newProduct, images: [...newProduct.images, ''] });
    };

    const removeImageField = (index) => {
        const newImages = newProduct.images.filter((_, i) => i !== index);
        setNewProduct({ ...newProduct, images: newImages.length > 0 ? newImages : [''] });
    };

    const updateImageField = (index, value) => {
        const newImages = [...newProduct.images];
        newImages[index] = value;
        setNewProduct({ ...newProduct, images: newImages });
    };

    const handleDeleteProduct = async (productId) => {
        if (!window.confirm('Deactivate this product?')) return;
        try {
            await deleteProduct(store.id, productId);
            toast.success('Product deactivated');
            loadTabContent();
        } catch (error) {
            toast.error('Failed to delete product');
        }
    };

    // Inventory handlers
    const handleCreateInventory = async (e) => {
        e.preventDefault();
        try {
            const invData = {
                ...newInventory,
                quantity: parseInt(newInventory.quantity),
                min_stock_level: parseInt(newInventory.min_stock_level)
            };
            
            if (editingInventory) {
                await updateInventory(store.id, editingInventory.id, invData);
                toast.success('Inventory updated');
                setEditingInventory(null);
            } else {
                await createInventory(store.id, invData);
                toast.success('Inventory added');
            }
            setInventoryDialogOpen(false);
            setNewInventory({ product_id: '', quantity: '', min_stock_level: 5, location: '' });
            loadTabContent();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save inventory');
        }
    };

    const openEditInventory = (inv) => {
        setEditingInventory(inv);
        setNewInventory({
            product_id: inv.product_id,
            quantity: inv.quantity.toString(),
            min_stock_level: inv.min_stock_level.toString(),
            location: inv.location || ''
        });
        setInventoryDialogOpen(true);
    };

    // Vendor handlers
    const handleCreateVendor = async (e) => {
        e.preventDefault();
        try {
            if (editingVendor) {
                await updateVendor(store.id, editingVendor.id, newVendor);
                toast.success('Vendor updated');
                setEditingVendor(null);
            } else {
                await createVendor(store.id, newVendor);
                toast.success('Vendor created');
            }
            setVendorDialogOpen(false);
            setNewVendor({ name: '', contact_name: '', email: '', phone: '', address: '', gst_number: '' });
            loadTabContent();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save vendor');
        }
    };

    const openEditVendor = (vendor) => {
        setEditingVendor(vendor);
        setNewVendor({
            name: vendor.name,
            contact_name: vendor.contact_name || '',
            email: vendor.email || '',
            phone: vendor.phone || '',
            address: vendor.address || '',
            gst_number: vendor.gst_number || ''
        });
        setVendorDialogOpen(true);
    };

    // PO handlers
    const handleCreatePO = async (e) => {
        e.preventDefault();
        try {
            const poData = {
                vendor_id: newPO.vendor_id,
                items: newPO.items.map(i => ({
                    product_id: i.product_id,
                    quantity: parseInt(i.quantity),
                    unit_price: parseFloat(i.unit_price)
                })),
                notes: newPO.notes
            };
            
            if (editingPO) {
                await updatePurchaseOrder(store.id, editingPO.id, poData);
                toast.success('Purchase order updated');
                setEditingPO(null);
            } else {
                await createPurchaseOrder(store.id, poData);
                toast.success('Purchase order created');
            }
            setPoDialogOpen(false);
            setNewPO({ vendor_id: '', items: [{ product_id: '', quantity: '', unit_price: '' }], notes: '' });
            loadTabContent();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save PO');
        }
    };

    // POS handlers
    const handleCreatePOS = async (e) => {
        e.preventDefault();
        try {
            const posData = {
                items: posItems.filter(i => i.product_id).map(i => ({
                    product_id: i.product_id,
                    quantity: parseInt(i.quantity),
                    price: parseFloat(i.price)
                })),
                payment_method: posPaymentMethod,
                customer_name: posCustomer.name || null,
                customer_phone: posCustomer.phone || null
            };
            
            if (editingPOS) {
                await updatePOSTransaction(store.id, editingPOS.id, posData);
                toast.success('Transaction updated');
                setEditingPOS(null);
            } else {
                await createPOSTransaction(store.id, posData);
                toast.success('Transaction completed');
            }
            setPosDialogOpen(false);
            setPosItems([{ product_id: '', quantity: 1, price: 0 }]);
            setPosCustomer({ name: '', phone: '' });
            loadTabContent();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Transaction failed');
        }
    };

    // Plan handlers
    const handleCreatePlan = async (e) => {
        e.preventDefault();
        try {
            const planData = {
                ...newPlan,
                min_amount: parseFloat(newPlan.min_amount) || 500,
                max_amount: parseFloat(newPlan.max_amount) || 100000,
                bonus_percentage: parseFloat(newPlan.bonus_percentage) || 0,
                benefits: newPlan.benefits.filter(b => b.trim())
            };
            // map 'auto' placeholder to no explicit key so backend falls back to store default
            if (planData.metal_purity_key === 'auto') {
                delete planData.metal_purity_key;
            }
            
            if (editingPlan) {
                await updateSubscriptionPlan(store.id, editingPlan.id, planData);
                toast.success('Plan updated');
                setEditingPlan(null);
            } else {
                await createSubscriptionPlan(store.id, planData);
                toast.success('Plan created');
            }
            setPlanDialogOpen(false);
            setNewPlan({ name: '', plan_type: '', duration_months: 11, min_amount: 500, max_amount: 100000, bonus_percentage: 0, benefits: [], description: '', scheme_type: 'fixed', target_metal: 'gold', metal_purity_key: 'auto' });
            loadTabContent();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save plan');
        }
    };

    const openEditPlan = (plan) => {
        setEditingPlan(plan);
            setNewPlan({
            name: plan.name,
            plan_type: plan.plan_type || '',
            scheme_type: plan.scheme_type || 'fixed',
            target_metal: plan.target_metal || 'gold',
            duration_months: plan.duration_months,
            min_amount: plan.min_amount || 500,
            max_amount: plan.max_amount || 100000,
            bonus_percentage: plan.bonus_percentage || 0,
            benefits: plan.benefits || [],
            description: plan.description || '',
            metal_purity_key: plan.metal_purity_key ? plan.metal_purity_key : 'auto'
        });
        setPlanDialogOpen(true);
    };

    const handleDeletePlan = async (planId) => {
        // Plans are typically not deleted, just deactivated - but for now we show message
        toast.info('Plans cannot be deleted as customers may have active subscriptions');
    };

    // Order handlers
    const handleUpdateOrderStatus = async (orderId, status) => {
        try {
            await updateOrderStatus(store.id, orderId, { 
                status, 
                tracking_number: orderTrackingInfo.tracking_number || null,
                carrier_name: orderTrackingInfo.carrier_name || null,
                carrier_url: orderTrackingInfo.carrier_url || null
            });
            toast.success('Order updated');
            loadTabContent();
            setOrderDetailOpen(false);
            setOrderTrackingInfo({ tracking_number: '', carrier_name: '', carrier_url: '' });
        } catch (error) {
            toast.error('Failed to update order');
        }
    };

    const openOrderDetail = (order) => {
        setSelectedOrder(order);
        setOrderTrackingInfo({
            tracking_number: order.tracking_number || '',
            carrier_name: order.carrier_name || '',
            carrier_url: order.carrier_url || ''
        });
        // Initialize edit states
        setOrderEditStatus(order.status || '');
        setOrderCarrier(order.carrier_name || '');
        setOrderTrackingNumber(order.tracking_number || '');
        setOrderTrackingUrl(order.carrier_url || '');
        setCanceledItems(new Set());
        setOrderDetailOpen(true);
    };

    useEffect(() => {
        const enrich = async () => {
            if (!selectedOrder || !selectedOrder.items || !store) return;
            const needs = selectedOrder.items.filter(it => !(it.product && it.product.images && it.product.images.length > 0) && it.product_id);
            if (!needs.length) return;
            try {
                const results = await Promise.all(needs.map(it => getProduct(store.id, it.product_id).then(r => ({ id: it.product_id, product: r.data })).catch(() => null)));
                const map = {};
                results.forEach(r => { if (r && r.id) map[r.id] = r.product; });
                const newItems = selectedOrder.items.map(it => ({ ...it, product: it.product || map[it.product_id] || it.product }));
                setSelectedOrder({ ...selectedOrder, items: newItems });
            } catch (e) { console.debug('enrich failed', e); }
        };
        enrich();
    }, [selectedOrder, store]);

    // Admin Shiprocket actions
    const handleAdminCreateShiprocket = async () => {
        if (!selectedOrder) return;
        try {
            toast.promise(
                adminCreateShiprocketOrder(store.id, selectedOrder.id),
                {
                    loading: 'Creating Shiprocket order...',
                    success: 'Shiprocket create requested',
                    error: 'Failed to request Shiprocket create'
                }
            );
            await loadTabContent();
            const refreshed = (await getOrders(store.id, pagination.orders.page, pagination.orders.limit)).data.find(o => o.id === selectedOrder.id);
            setSelectedOrder(refreshed || selectedOrder);
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.detail || e.message || 'Shiprocket create failed');
        }
    };

    const handleAdminSyncShiprocket = async () => {
        if (!selectedOrder) return;
        try {
            const res = await adminSyncShiprocketOrder(store.id, selectedOrder.id);
            toast.success('Synced with Shiprocket');
            await loadTabContent();
            setSelectedOrder(res.data.order || selectedOrder);
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.detail || e.message || 'Sync failed');
        }
    };

    const handleAdminCancelShiprocket = async () => {
        if (!selectedOrder) return;
        if (!window.confirm('Cancel Shiprocket order?')) return;
        try {
            const res = await adminCancelShiprocketOrder(store.id, selectedOrder.id);
            toast.success('Cancel requested');
            await loadTabContent();
            setSelectedOrder(res.data.order || selectedOrder);
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.detail || e.message || 'Cancel failed');
        }
    };

    const handleAdminShiprocketAction = async (action) => {
        if (!selectedOrder) return;
        try {
            const res = await adminShiprocketAction(store.id, selectedOrder.id, action);
            toast.success(`${action} requested`);
            await loadTabContent();
            setSelectedOrder(res.data.order || selectedOrder);
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.detail || e.message || `${action} failed`);
        }
    };

    const handleAdminUpdateSelectedOrder = async () => {
        if (!selectedOrder) return;
        try {
            // Prevent sending disabled SR statuses from admin unless it's already the current status
            const newStatus = orderEditStatus || selectedOrder.status;
            if (DISABLED_STATUSES.includes(newStatus) && newStatus !== selectedOrder.status) {
                toast.error('Cannot set status to an SR-managed status');
                return;
            }
            const cancelled = Array.from(canceledItems).map(i => ({ index: i, item: selectedOrder.items[i] }));
            const data = {
                status: newStatus,
                tracking_number: orderTrackingNumber || selectedOrder.tracking_number || null,
                carrier_name: orderCarrier || selectedOrder.carrier_name || null,
                carrier_url: orderTrackingUrl || selectedOrder.carrier_url || null,
                cancelled_items: cancelled
            };
            await updateOrderStatus(store.id, selectedOrder.id, data);
            toast.success('Order updated');
            await loadTabContent();
            const refreshed = (await getOrders(store.id, pagination.orders.page, pagination.orders.limit)).data.find(o => o.id === selectedOrder.id);
            setSelectedOrder(refreshed || { ...selectedOrder, ...data });
        } catch (e) {
            console.error(e);
            toast.error('Failed to update order');
        }
    };

    const handleAdminCancelWholeOrder = async () => {
        if (!selectedOrder) return;
        if (!window.confirm('Are you sure you want to cancel this entire order?')) return;
        try {
            const cancelled = selectedOrder.items?.map((item, idx) => ({ index: idx, item })) || [];
            const data = {
                status: 'cancelled',
                tracking_number: selectedOrder.tracking_number || null,
                carrier_name: selectedOrder.carrier_name || null,
                carrier_url: selectedOrder.carrier_url || null,
                cancelled_items: cancelled
            };
            await updateOrderStatus(store.id, selectedOrder.id, data);
            toast.success('Order cancelled');
            await loadTabContent();
            const refreshed = (await getOrders(store.id, pagination.orders.page, pagination.orders.limit)).data.find(o => o.id === selectedOrder.id);
            setSelectedOrder(refreshed || { ...selectedOrder, ...data });
            setOrderDetailOpen(false);
        } catch (e) {
            console.error(e);
            toast.error('Failed to cancel order');
        }
    };

    // Settings handlers
    const handleUpdateSettings = async () => {
        try {
            await updateStoreSettings(store.id, currency);
            toast.success('Settings updated');
            setSettingsDialogOpen(false);
            loadTabContent();
        } catch (error) {
            toast.error('Failed to update settings');
        }
    };

    const openStoreEditDialog = () => {
        setStoreEditForm({
            name: store.name || '',
            description: store.description || '',
            contact_email: store.contact_email || '',
            contact_phone: store.contact_phone || '',
            address: store.address || '',
            address_map_url: store.address_map_url || ''
        });
        setStoreEditDialogOpen(true);
    };

    const handleUpdateStore = async (e) => {
        e.preventDefault();
        try {
            await updateStore(store.id, { ...storeEditForm, currency: store.currency });
            toast.success('Store information updated');
            setStoreEditDialogOpen(false);
            loadTabContent();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update store');
        }
    };

    const handleLogout = () => {
        logout();
        // Get the storeId from the first store (if available) or redirect to landing
        const lastStore = localStorage.getItem('lastVisitedStore');
        navigate(lastStore ? `/store/${lastStore}/login` : '/landing');
    };

    const getProductName = (productId) => {
        return products.find(p => p.id === productId)?.name || 'Unknown';
    };

    const renderPagination = (entityKey) => {
        const { page, pages } = pagination[entityKey];
        if (pages <= 1) return null;
        
        return (
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handlePageChange(entityKey, page - 1)}
                    disabled={page <= 1}
                >
                    Previous
                </Button>
                <div className="text-sm font-medium">
                    Page {page} of {pages}
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handlePageChange(entityKey, page + 1)}
                    disabled={page >= pages}
                >
                    Next
                </Button>
            </div>
        );
    };

    const getVendorName = (vendorId) => {
        return vendors.find(v => v.id === vendorId)?.name || 'Unknown';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    if (!store) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>No Store Assigned</CardTitle>
                        <CardDescription>Please contact the super admin to assign you to a store.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleLogout}>Logout</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex w-full overflow-x-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-card border-r flex flex-col shrink-0">
                <div className="p-6 border-b">
                    <h1 className="text-xl font-serif font-semibold truncate">{store.name}</h1>
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                    {user?.role === 'store_user' && (
                        <Badge variant="outline" className="mt-2 text-xs">Staff</Badge>
                    )}
                </div>
                <ScrollArea className="flex-1">
                    <nav className="p-4 space-y-2">
                        {/* Menu items with access control */}
                        {(() => {
                            const isAdmin = user?.role === 'super_admin' || user?.role === 'store_admin';
                            const userMenuAccess = user?.menu_access || [];
                            
                            const menuItems = [
                                { key: 'products', label: 'Products', icon: Package, testId: 'nav-products' },
                                { key: 'inventory', label: 'Inventory', icon: Box, testId: 'nav-inventory' },
                                { key: 'orders', label: 'Orders', icon: ShoppingCart, testId: 'nav-orders' },
                                { key: 'pos', label: 'POS', icon: CreditCard, testId: 'nav-pos' },
                                { key: 'vendors', label: 'Vendors', icon: Truck, testId: 'nav-vendors' },
                                { key: 'purchase-orders', label: 'Purchase Orders', icon: DollarSign, testId: 'nav-po' },
                                { key: 'plans', label: 'Subscription Plans', icon: DollarSign, testId: 'nav-plans' },
                                { key: 'reporting', label: 'Reporting', icon: BarChart3, testId: 'nav-reporting', onClick: () => { setActiveTab('reporting'); loadReport(); } },
                                { key: 'settings', label: 'Settings', icon: Settings, testId: 'nav-settings' },
                            ];
                            
                            const filteredMenuItems = menuItems.filter(item => 
                                isAdmin || userMenuAccess.includes(item.key)
                            );
                            
                            return filteredMenuItems.map(({ key, label, icon: Icon, testId, onClick }) => {
                                const handler = onClick || (() => {
                                    setActiveTab(key);
                                });
                                return (
                                    <Button
                                        key={key}
                                        variant={activeTab === key ? 'secondary' : 'ghost'}
                                        className="w-full justify-start"
                                        onClick={handler}
                                        data-testid={testId}
                                    >
                                        <Icon className="w-4 h-4 mr-2" /> {label}
                                    </Button>
                                );
                            });
                        })()}
                        
                        {/* Admin-only Management Section */}
                        {(user?.role === 'super_admin' || user?.role === 'store_admin') && (
                            <>
                                <div className="border-t my-4" />
                                <p className="text-xs text-muted-foreground px-2 mb-2 uppercase tracking-wide">Management</p>
                                <Button
                                    variant={activeTab === 'staff' ? 'secondary' : 'ghost'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTab('staff')}
                                    data-testid="nav-staff"
                                >
                                    <UserCog className="w-4 h-4 mr-2" /> Staff Members
                                </Button>
                                <Button
                                    variant={activeTab === 'customers' ? 'secondary' : 'ghost'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTab('customers')}
                                    data-testid="nav-customers"
                                >
                                    <Contact className="w-4 h-4 mr-2" /> Website Customers
                                </Button>
                                <Button
                                    variant={activeTab === 'tax' ? 'secondary' : 'ghost'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTab('tax')}
                                >
                                    <Settings className="w-4 h-4 mr-2" /> Tax Configuration
                                </Button>
                                <Button
                                    variant={activeTab === 'logs' ? 'secondary' : 'ghost'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTab('logs')}
                                >
                                    <FileText className="w-4 h-4 mr-2" /> Activity Logs
                                </Button>
                                <Button
                                    variant={activeTab === 'shiprocket-logs' ? 'secondary' : 'ghost'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTab('shiprocket-logs')}
                                >
                                    <FileText className="w-4 h-4 mr-2" /> Shiprocket Logs
                                </Button>
                                <Button
                                    variant={activeTab === 'media' ? 'secondary' : 'ghost'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTab('media')}
                                >
                                    <ImageIcon className="w-4 h-4 mr-2" /> Media Library
                                </Button>
                                <div className="border-t my-4" />
                                <Link to={`/store/${store.id}/page-editor`}>
                                    <Button variant="ghost" className="w-full justify-start" data-testid="nav-page-editor">
                                        <Palette className="w-4 h-4 mr-2" /> Page Editor
                                    </Button>
                                </Link>
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={openStoreEditDialog}
                                    data-testid="nav-store-info"
                                >
                                    <Building2 className="w-4 h-4 mr-2" /> Store Info
                                </Button>
                                {/* Removed duplicate Settings menu item */}
                            </>
                        )}
                    </nav>
                </ScrollArea>
                {marketPricesSidebarOpen && store && (
                    <div className="p-4 border-t">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold">Market Prices</h3>
                            <Button variant="ghost" size="sm" onClick={() => setMarketPricesSidebarOpen(false)}>Close</Button>
                        </div>
                        <div className="max-h-[60vh] overflow-auto">
                            <MarketPriceSettings storeId={store.id} />
                        </div>
                    </div>
                )}
                <div className="p-4 border-t">
                    <Button variant="outline" className="w-full" onClick={handleLogout} data-testid="logout-btn">
                        <LogOut className="w-4 h-4 mr-2" /> Logout
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8">
                    {/* Products Tab */}
                    {activeTab === 'products' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Products</h2>
                                    <p className="text-muted-foreground">Manage your product catalog</p>
                                </div>
                                <Dialog open={productDialogOpen} onOpenChange={(open) => { setProductDialogOpen(open); if (!open) { setEditingProduct(null); setNewProduct({ name: '', description: '', price: '', category: '', sku: '', weight: '', images: [''] }); } }}>
                                    <DialogTrigger asChild>
                                        <Button className="gold-gradient text-white" data-testid="add-product-btn">
                                            <Plus className="w-4 h-4 mr-2" /> Add Product
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle className="font-serif">{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
                                            <DialogDescription>{editingProduct ? 'Update product details' : 'Add a new product to your catalog'}</DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateProduct} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Product Name</Label>
                                                    <Input
                                                        value={newProduct.name}
                                                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                                        required
                                                        data-testid="product-name-input"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>SKU</Label>
                                                    <Input
                                                        value={newProduct.sku}
                                                        onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                                                        data-testid="product-sku-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Description</Label>
                                                <Textarea
                                                    value={newProduct.description}
                                                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                                    data-testid="product-desc-input"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Price ({store.currency})</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={newProduct.price}
                                                        onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                                        required
                                                        data-testid="product-price-input"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Weight (g)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={newProduct.weight}
                                                        onChange={(e) => setNewProduct({ ...newProduct, weight: e.target.value })}
                                                        data-testid="product-weight-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Category</Label>
                                                <Input
                                                    value={newProduct.category}
                                                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                                                    placeholder="e.g., Necklaces, Rings, Earrings"
                                                    data-testid="product-category-input"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Featured</Label>
                                                <div className="flex items-center">
                                                    <Switch
                                                        checked={!!newProduct.featured}
                                                        onCheckedChange={(v) => setNewProduct({ ...newProduct, featured: !!v })}
                                                    />
                                                    <span className="ml-2 text-sm text-muted-foreground">Mark product as featured</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label>Product Images</Label>
                                                    <Button type="button" variant="outline" size="sm" onClick={addImageField}>
                                                        <Plus className="w-3 h-3 mr-1" /> Add Image
                                                    </Button>
                                                </div>
                                                {newProduct.images.map((img, index) => (
                                                    <div key={index} className="flex gap-2 items-start">
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    value={img}
                                                                    onChange={(e) => updateImageField(index, e.target.value)}
                                                                    placeholder={`Image URL ${index + 1}`}
                                                                    data-testid={`product-image-input-${index}`}
                                                                />
                                                                <Button 
                                                                    type="button" 
                                                                    variant="outline" 
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        setMediaSelectCallback(() => (url) => {
                                                                            // Strip base URL if present to store relative path
                                                                            const relativeUrl = url.replace(IMAGE_SERVER_URL, '');
                                                                            updateImageField(index, relativeUrl);
                                                                        });
                                                                        setMediaDialogOpen(true);
                                                                    }}
                                                                    title="Select from Media Library"
                                                                >
                                                                    <ImageIcon className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                            {img && (
                                                                <div className="h-16 w-16 rounded border overflow-hidden">
                                                                    <img 
                                                                        src={img.startsWith('http') ? img : `${IMAGE_SERVER_URL}${img}`} 
                                                                        alt={`Preview ${index + 1}`} 
                                                                        className="w-full h-full object-cover" 
                                                                        onError={(e) => e.target.style.display = 'none'} 
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        {newProduct.images.length > 1 && (
                                                            <Button type="button" variant="ghost" size="sm" onClick={() => removeImageField(index)}>
                                                                <Trash2 className="w-4 h-4 text-destructive" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <Button type="submit" className="w-full gold-gradient text-white" data-testid="submit-product-btn">
                                                {editingProduct ? 'Update Product' : 'Create Product'}
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            {/* Filter Controls */}
                            <Card className="mb-4">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <Filter className="w-4 h-4 text-muted-foreground" />
                                        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <Input
                                                placeholder="Search products..."
                                                value={filters.products.search}
                                                onChange={(e) => setFilters({ ...filters, products: { ...filters.products, search: e.target.value } })}
                                                data-testid="products-filter-search"
                                            />
                                            <Select
                                                value={filters.products.category || 'all'}
                                                onValueChange={(v) => setFilters({ ...filters, products: { ...filters.products, category: v === 'all' ? '' : v } })}
                                            >
                                                <SelectTrigger data-testid="products-filter-category">
                                                    <SelectValue placeholder="All Categories" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Categories</SelectItem>
                                                    {productCategories.map((cat) => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Image</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>SKU</TableHead>
                                                <TableHead>Category</TableHead>
                                                        <TableHead>Price</TableHead>
                                                        <TableHead>Weight</TableHead>
                                                        <TableHead>Featured</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredProducts.map((product) => (
                                                <TableRow key={product.id} data-testid={`product-row-${product.id}`}>
                                                    <TableCell>
                                                        {product.images?.[0] ? (
                                                            <img 
                                                                src={product.images[0].startsWith('http') ? product.images[0] : `${IMAGE_SERVER_URL}${product.images[0]}`} 
                                                                alt={product.name} 
                                                                className="w-12 h-12 object-cover rounded" 
                                                                onError={(e) => {
                                                                    e.target.onerror = null; 
                                                                    e.target.src = 'https://placehold.co/48x48?text=No+Img';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">No img</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-medium">{product.name}</TableCell>
                                                    <TableCell>{product.sku || '-'}</TableCell>
                                                    <TableCell>{product.category || '-'}</TableCell>
                                                    <TableCell>{formatCurrency(product.price, store.currency)}</TableCell>
                                                    <TableCell>{product.weight ? `${product.weight}g` : '-'}</TableCell>
                                                    <TableCell>
                                                        {product.featured ? (
                                                            <Badge className="bg-gold text-white text-xs">Featured</Badge>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                                            {product.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => openEditProduct(product)} data-testid={`edit-product-${product.id}`}>
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product.id)} data-testid={`delete-product-${product.id}`}>
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredProducts.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                        {products.length === 0 ? 'No products yet. Add your first product to get started.' : 'No products match the current filters.'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            {renderPagination('products')}
                        </div>
                    )}

                    {/* Inventory Tab */}
                    {activeTab === 'inventory' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Inventory</h2>
                                    <p className="text-muted-foreground">Manage stock levels</p>
                                </div>
                                <Dialog open={inventoryDialogOpen} onOpenChange={(open) => { setInventoryDialogOpen(open); if (!open) { setEditingInventory(null); setNewInventory({ product_id: '', quantity: '', min_stock_level: 5, location: '' }); } }}>
                                    <DialogTrigger asChild>
                                        <Button className="gold-gradient text-white" data-testid="add-inventory-btn">
                                            <Plus className="w-4 h-4 mr-2" /> Add Inventory
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle className="font-serif">{editingInventory ? 'Edit Inventory' : 'Add Inventory'}</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateInventory} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Product</Label>
                                                <Select value={newInventory.product_id} onValueChange={(v) => setNewInventory({ ...newInventory, product_id: v })} disabled={!!editingInventory}>
                                                    <SelectTrigger data-testid="inventory-product-select">
                                                        <SelectValue placeholder="Select product" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {products.filter(p => p.is_active).map((p) => (
                                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Quantity</Label>
                                                    <Input
                                                        type="number"
                                                        value={newInventory.quantity}
                                                        onChange={(e) => setNewInventory({ ...newInventory, quantity: e.target.value })}
                                                        required
                                                        data-testid="inventory-qty-input"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Min Stock Level</Label>
                                                    <Input
                                                        type="number"
                                                        value={newInventory.min_stock_level}
                                                        onChange={(e) => setNewInventory({ ...newInventory, min_stock_level: e.target.value })}
                                                        data-testid="inventory-min-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Location</Label>
                                                <Input
                                                    value={newInventory.location}
                                                    onChange={(e) => setNewInventory({ ...newInventory, location: e.target.value })}
                                                    placeholder="e.g., Shelf A1"
                                                    data-testid="inventory-location-input"
                                                />
                                            </div>
                                            <Button type="submit" className="w-full gold-gradient text-white" data-testid="submit-inventory-btn">
                                                {editingInventory ? 'Update Inventory' : 'Add Inventory'}
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            {/* Filter Controls */}
                            <Card className="mb-4">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <Filter className="w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by product name..."
                                            value={filters.inventory.search}
                                            onChange={(e) => setFilters({ ...filters, inventory: { ...filters.inventory, search: e.target.value } })}
                                            className="max-w-xs"
                                            data-testid="inventory-filter-search"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead>Quantity</TableHead>
                                                <TableHead>Min Stock</TableHead>
                                                <TableHead>Location</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Last Updated</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredInventory.map((inv) => (
                                                <TableRow key={inv.id}>
                                                    <TableCell className="font-medium">{getProductName(inv.product_id)}</TableCell>
                                                    <TableCell>{inv.quantity}</TableCell>
                                                    <TableCell>{inv.min_stock_level}</TableCell>
                                                    <TableCell>{inv.location || '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={inv.quantity > inv.min_stock_level ? 'default' : 'destructive'}>
                                                            {inv.quantity > inv.min_stock_level ? 'In Stock' : 'Low Stock'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{formatDate(inv.updated_at)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => openEditInventory(inv)} data-testid={`edit-inventory-${inv.id}`}>
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredInventory.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                        {inventory.length === 0 ? 'No inventory records yet.' : 'No inventory matches the current filter.'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            {renderPagination('inventory')}
                        </div>
                    )}

                    {/* Orders Tab */}
                    {activeTab === 'orders' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-serif font-semibold">Customer Orders</h2>
                                <p className="text-muted-foreground">Manage and track orders</p>
                            </div>
                            {/* Orders Filters */}
                            <Card className="mb-4">
                                <CardContent className="p-4">
                                    <div className="flex flex-wrap gap-4 items-center">
                                        {/* Status Filter */}
                                        <select className="border rounded px-3 py-2 text-sm" value={filters.orders.status || ''} onChange={e => setFilters({ ...filters, orders: { ...filters.orders, status: e.target.value } })}>
                                            <option value="">All Statuses</option>
                                            <option value="placed">Placed</option>
                                            <option value="picking started">Picking Started</option>
                                            <option value="packed">Packed</option>
                                            <option value="sr-order">SR-Order</option>
                                            <option value="sr-ship">SR-Ship</option>
                                            <option value="sr-schedule-pickup">SR-Schedule-Pickup</option>
                                            <option value="shipped">Shipped</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                        {/* Date Filter */}
                                        <input type="date" className="border rounded px-3 py-2 text-sm" value={filters.orders.startDate || ''} onChange={e => setFilters({ ...filters, orders: { ...filters.orders, startDate: e.target.value } })} placeholder="Start Date" />
                                        <input type="date" className="border rounded px-3 py-2 text-sm" value={filters.orders.endDate || ''} onChange={e => setFilters({ ...filters, orders: { ...filters.orders, endDate: e.target.value } })} placeholder="End Date" />
                                        {/* Customer Name Filter */}
                                        <input type="text" className="border rounded px-3 py-2 text-sm" value={filters.orders.customerName || ''} onChange={e => setFilters({ ...filters, orders: { ...filters.orders, customerName: e.target.value } })} placeholder="Customer Name" />
                                        {/* City Filter */}
                                        <input type="text" className="border rounded px-3 py-2 text-sm" value={filters.orders.city || ''} onChange={e => setFilters({ ...filters, orders: { ...filters.orders, city: e.target.value } })} placeholder="City" />
                                        {/* State Filter (dropdown) */}
                                        <select className="border rounded px-3 py-2 text-sm" value={filters.orders.state || ''} onChange={e => setFilters({ ...filters, orders: { ...filters.orders, state: e.target.value } })}>
                                            <option value="">All States</option>
                                            {Array.from(new Set(orders.map(o => o.shipping_address?.state).filter(Boolean))).map(state => (
                                                <option key={state} value={state}>{state}</option>
                                            ))}
                                        </select>
                                    </div>
                                </CardContent>
                            </Card>
                            {/* Table-style order list, as in admin template */}
                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Order ID</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>City</TableHead>
                                                <TableHead>State</TableHead>
                                                <TableHead>Total</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredOrders
                                                .filter(order => {
                                                    const { status, startDate, endDate, customerName, city, state } = filters.orders;
                                                    let pass = true;
                                                    if (status && order.status !== status) pass = false;
                                                    if (startDate && order.created_at < startDate) pass = false;
                                                    if (endDate && order.created_at > endDate + 'T23:59:59') pass = false;
                                                    if (customerName && !(order.customer_name || order.shipping_address?.full_name || '').toLowerCase().includes(customerName.toLowerCase())) pass = false;
                                                    if (city && !(order.shipping_address?.city || '').toLowerCase().includes(city.toLowerCase())) pass = false;
                                                    if (state && order.shipping_address?.state !== state) pass = false;
                                                    return pass;
                                                })
                                                .slice((pagination.orders.page - 1) * pagination.orders.limit, pagination.orders.page * pagination.orders.limit)
                                                .map((order) => (
                                                <TableRow key={order.id}>
                                                    <TableCell className="font-mono text-sm">
                                                        <button style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }} onClick={() => openOrderDetail(order)}>{order.id}</button>
                                                    </TableCell>
                                                    <TableCell>{formatDate(order.created_at)}</TableCell>
                                                    <TableCell>
                                                        <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                                                    </TableCell>
                                                    <TableCell>{order.customer_name || order.shipping_address?.full_name || '-'}</TableCell>
                                                    <TableCell>{order.shipping_address?.city || '-'}</TableCell>
                                                    <TableCell>{order.shipping_address?.state || '-'}</TableCell>
                                                    <TableCell>{formatCurrency(order.total_amount, store.currency)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openOrderDetail(order)}
                                                            data-testid={`edit-order-${order.id}`}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredOrders.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                        {orders.length === 0 ? 'No orders yet.' : 'No orders match the current filters.'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            {/* Pagination Controls */}
                            <div className="flex justify-end items-center gap-2 py-4">
                                <Button variant="outline" size="sm" onClick={() => handlePageChange('orders', Math.max(1, pagination.orders.page - 1))} disabled={pagination.orders.page <= 1}>Previous</Button>
                                <span className="text-sm font-medium">Page {pagination.orders.page} of {pagination.orders.pages}</span>
                                <Button variant="outline" size="sm" onClick={() => handlePageChange('orders', Math.min(pagination.orders.pages, pagination.orders.page + 1))} disabled={pagination.orders.page >= pagination.orders.pages}>Next</Button>
                            </div>

                            {/* Order Detail Dialog */}
                            <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
                                <DialogContent className="max-w-4xl border-2 border-blue-100 rounded-lg p-6">
                                    <DialogHeader>
                                        <DialogTitle className="font-serif">Order Details</DialogTitle>
                                    </DialogHeader>
                                    {selectedOrder && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label className="text-muted-foreground">Order ID</Label>
                                                    <p className="font-mono">{selectedOrder.id}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-muted-foreground">Status</Label>
                                                    <Badge className={getStatusColor(selectedOrder.status)}>{selectedOrder.status}</Badge>
                                                </div>
                                            </div>
                                            <div>
                                                <Label className="text-muted-foreground">Order Placed Date</Label>
                                                <p>{formatDate(selectedOrder.created_at)}</p>
                                            </div>
                                            <div>
                                                <Label className="text-muted-foreground">Shipping Address</Label>
                                                <p className="text-sm">
                                                    {selectedOrder.shipping_address?.full_name}<br />
                                                    {selectedOrder.shipping_address?.address_line1}<br />
                                                    {selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state} {selectedOrder.shipping_address?.postal_code}
                                                </p>
                                            </div>

                                            {/* Editable fields (admin) */}
                                            {(user?.role === 'store_admin' || user?.role === 'super_admin') && (
                                                <div className="grid grid-cols-1 gap-3">
                                                    <Label className="text-muted-foreground">Edit Order</Label>
                                                    <div className="flex gap-2 items-center">
                                                        <select value={orderEditStatus} onChange={(e) => {
                                                            const val = e.target.value;
                                                            // prevent selecting disabled statuses programmatically
                                                            if (DISABLED_STATUSES.includes(val) && val !== selectedOrder.status) {
                                                                // ignore change and show hint
                                                                toast.error('This status is managed by the app and cannot be set manually');
                                                                return;
                                                            }
                                                            setOrderEditStatus(val);
                                                        }} className="p-2 border rounded">
                                                            <option value="">-- Select status --</option>
                                                            {ORDER_STATUS_OPTIONS.map(opt => (
                                                                <option key={opt.value} value={opt.value} disabled={opt.disabled} title={opt.disabled ? 'Updated by app' : ''}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                        <input placeholder="Carrier name" value={orderCarrier} onChange={(e) => setOrderCarrier(e.target.value)} className="p-2 border rounded" />
                                                        <input placeholder="Tracking number" value={orderTrackingNumber} onChange={(e) => setOrderTrackingNumber(e.target.value)} className="p-2 border rounded" />
                                                        <input placeholder="Tracking URL" value={orderTrackingUrl} onChange={(e) => setOrderTrackingUrl(e.target.value)} className="p-2 border rounded" />

                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <Label className="text-muted-foreground">SKUs & Items</Label>
                                                <div className="mt-2 space-y-2">
                                                    {selectedOrder.items?.map((item, idx) => {
                                                        // Debug raw item fields so we can see where images live
                                                        console.log('[Order Detail Dialog] item:', item);
                                                        console.log('[Order Detail Dialog] productImageRaw:', item.product?.images?.[0], 'item.image:', item.image, 'store_image_placeholder:', selectedOrder.store_image_placeholder);
                                                        // Try product images first; fall back to products list by product_id if present
                                                        const productImage = item.product?.images?.[0] || products.find(p => p.id === item.product_id)?.images?.[0];
                                                        const imgUrl = productImage ? getImageUrl(productImage) : getImageUrl(item.image || selectedOrder.store_image_placeholder);
                                                        console.log(`[Order Detail Dialog] Item ${idx} imgUrl:`, imgUrl);
                                                        const isCanceled = canceledItems.has(idx);
                                                        return (
                                                            <div key={idx} className={`flex gap-4 items-center border-b pb-2 ${isCanceled ? 'opacity-50 line-through' : ''}`}>
                                                                <img src={imgUrl} alt={item.product_name || item.sku || `SKU-${idx+1}`} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} onError={e => { e.target.onerror = null; e.target.src = 'https://placehold.co/56x56?text=No+Img'; }} />
                                                                <div className="flex-1">
                                                                    <div className="font-mono font-semibold">{item.sku || item.item_number || item.product?.sku || item.product_id || `SKU-${idx+1}`}</div>
                                                                    <div className="text-sm">{item.product_name || item.description || item.product?.name || ''}</div>
                                                                    <div className="text-xs text-muted-foreground">Qty: {item.quantity || 0}</div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="font-semibold">{formatCurrency((item.price || 0) * (item.quantity || 1), selectedOrder.currency || 'INR')}</div>
                                                                    <Button size="small" variant={isCanceled ? 'outlined' : 'contained'} color={isCanceled ? 'secondary' : 'error'} onClick={() => {
                                                                        const s = new Set(canceledItems);
                                                                        if (s.has(idx)) s.delete(idx); else s.add(idx);
                                                                        setCanceledItems(s);
                                                                    }}>{isCanceled ? 'Undo' : 'Cancel line'}</Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label className="text-muted-foreground">Tax</Label>
                                                    <p>{selectedOrder.tax ? formatCurrency(selectedOrder.tax, selectedOrder.currency || 'INR') : '-'}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-muted-foreground">Shipping Charge Paid</Label>
                                                    <p>{selectedOrder.shipping_charges ? formatCurrency(selectedOrder.shipping_charges, selectedOrder.currency || 'INR') : '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sticky footer for update action to keep button visible */}
                                    {(user?.role === 'store_admin' || user?.role === 'super_admin') && (
                                        <div className="sticky bottom-0 -mx-6 -mb-6 bg-white/90 dark:bg-slate-900/80 backdrop-blur p-4 border-t flex justify-end gap-3">
                                            <Button color="error" variant="outlined" onClick={handleAdminCancelWholeOrder}>Cancel Order</Button>
                                            <Button onClick={handleAdminUpdateSelectedOrder} className="gold-gradient text-white">Update</Button>
                                            <Button variant="outline" onClick={() => setOrderDetailOpen(false)}>Close</Button>
                                        </div>
                                    )}

                                </DialogContent>
                            </Dialog>
                        </div>
                    )}

                    {/* POS Tab */}
                    {activeTab === 'pos' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">POS Transactions</h2>
                                    <p className="text-muted-foreground">Point of Sale transactions</p>
                                </div>
                                <Dialog open={posDialogOpen} onOpenChange={(open) => { setPosDialogOpen(open); if (!open) { setEditingPOS(null); setPosItems([{ product_id: '', quantity: 1, price: 0 }]); setPosCustomer({ name: '', phone: '' }); setPosPaymentMethod('cash'); } }}>
                                    <DialogTrigger asChild>
                                        <Button className="gold-gradient text-white" data-testid="new-sale-btn">
                                            <Plus className="w-4 h-4 mr-2" /> New Sale
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle className="font-serif">{editingPOS ? 'Edit POS Transaction' : 'New POS Transaction'}</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleCreatePOS} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Items</Label>
                                                {posItems.map((item, idx) => (
                                                    <div key={idx} className="grid grid-cols-3 gap-2">
                                                        <Select value={item.product_id} onValueChange={(v) => {
                                                            const product = products.find(p => p.id === v);
                                                            const newItems = [...posItems];
                                                            newItems[idx] = { ...newItems[idx], product_id: v, price: product?.price || 0 };
                                                            setPosItems(newItems);
                                                        }}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Product" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {products.filter(p => p.is_active).map((p) => (
                                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Input
                                                            type="number"
                                                            placeholder="Qty"
                                                            value={item.quantity}
                                                            onChange={(e) => {
                                                                const newItems = [...posItems];
                                                                newItems[idx].quantity = parseInt(e.target.value) || 1;
                                                                setPosItems(newItems);
                                                            }}
                                                        />
                                                        <Input
                                                            type="number"
                                                            placeholder="Price"
                                                            value={item.price}
                                                            onChange={(e) => {
                                                                const newItems = [...posItems];
                                                                newItems[idx].price = parseFloat(e.target.value) || 0;
                                                                setPosItems(newItems);
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                                <Button type="button" variant="outline" size="sm" onClick={() => setPosItems([...posItems, { product_id: '', quantity: 1, price: 0 }])}>
                                                    Add Item
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Customer Name</Label>
                                                    <Input value={posCustomer.name} onChange={(e) => setPosCustomer({ ...posCustomer, name: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Phone</Label>
                                                    <Input value={posCustomer.phone} onChange={(e) => setPosCustomer({ ...posCustomer, phone: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Payment Method</Label>
                                                <Select value={posPaymentMethod} onValueChange={setPosPaymentMethod}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="cash">Cash</SelectItem>
                                                        <SelectItem value="card">Card</SelectItem>
                                                        <SelectItem value="upi">UPI</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="p-4 bg-muted rounded-lg">
                                                <div className="flex justify-between text-lg font-semibold">
                                                    <span>Total</span>
                                                    <span>{formatCurrency(posItems.reduce((sum, i) => sum + (i.price * i.quantity), 0), store.currency)}</span>
                                                </div>
                                            </div>
                                            <Button type="submit" className="w-full gold-gradient text-white" data-testid="complete-sale-btn">
                                                {editingPOS ? 'Update Transaction' : 'Complete Sale'}
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            {/* Filter Controls */}
                            <Card className="mb-4">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <Filter className="w-4 h-4 text-muted-foreground" />
                                        <Select
                                            value={filters.pos.paymentMethod || 'all'}
                                            onValueChange={(v) => setFilters({ ...filters, pos: { ...filters.pos, paymentMethod: v === 'all' ? '' : v } })}
                                        >
                                            <SelectTrigger className="w-[150px]" data-testid="pos-filter-payment">
                                                <SelectValue placeholder="All Payments" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Payments</SelectItem>
                                                <SelectItem value="cash">Cash</SelectItem>
                                                <SelectItem value="card">Card</SelectItem>
                                                <SelectItem value="upi">UPI</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-muted-foreground" />
                                            <Input
                                                type="date"
                                                value={filters.pos.startDate}
                                                onChange={(e) => setFilters({ ...filters, pos: { ...filters.pos, startDate: e.target.value } })}
                                                className="w-[150px]"
                                                data-testid="pos-filter-start-date"
                                            />
                                            <span className="text-muted-foreground">to</span>
                                            <Input
                                                type="date"
                                                value={filters.pos.endDate}
                                                onChange={(e) => setFilters({ ...filters, pos: { ...filters.pos, endDate: e.target.value } })}
                                                className="w-[150px]"
                                                data-testid="pos-filter-end-date"
                                            />
                                        </div>
                                        {(filters.pos.paymentMethod || filters.pos.startDate || filters.pos.endDate) && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={() => setFilters({ ...filters, pos: { startDate: '', endDate: '', paymentMethod: '' } })}
                                            >
                                                Clear Filters
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Transaction ID</TableHead>
                                                <TableHead>Items</TableHead>
                                                <TableHead>Total</TableHead>
                                                <TableHead>Payment</TableHead>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPOS.map((tx) => (
                                                <TableRow key={tx.id}>
                                                    <TableCell className="font-mono text-sm">{tx.id.slice(0, 8)}...</TableCell>
                                                    <TableCell>{tx.items.length} items</TableCell>
                                                    <TableCell>{formatCurrency(tx.total_amount, store.currency)}</TableCell>
                                                    <TableCell className="capitalize">{tx.payment_method}</TableCell>
                                                    <TableCell>{tx.customer_name || '-'}</TableCell>
                                                    <TableCell>{formatDateTime(tx.created_at)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => handleEditPOS(tx)} data-testid={`edit-pos-${tx.id}`}>
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeletePOS(tx.id)} data-testid={`delete-pos-${tx.id}`}>
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredPOS.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                        {posTransactions.length === 0 ? 'No POS transactions yet.' : 'No transactions match the current filters.'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            {renderPagination('posTransactions')}
                        </div>
                    )}

                    {/* Vendors Tab */}
                    {activeTab === 'vendors' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Vendors</h2>
                                    <p className="text-muted-foreground">Manage your suppliers</p>
                                </div>
                                <Dialog open={vendorDialogOpen} onOpenChange={(open) => { setVendorDialogOpen(open); if (!open) { setEditingVendor(null); setNewVendor({ name: '', contact_name: '', email: '', phone: '', address: '', gst_number: '' }); } }}>
                                    <DialogTrigger asChild>
                                        <Button className="gold-gradient text-white" data-testid="add-vendor-btn">
                                            <Plus className="w-4 h-4 mr-2" /> Add Vendor
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle className="font-serif">{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateVendor} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Company Name</Label>
                                                    <Input
                                                        value={newVendor.name}
                                                        onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                                                        required
                                                        data-testid="vendor-name-input"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Contact Person</Label>
                                                    <Input
                                                        value={newVendor.contact_name}
                                                        onChange={(e) => setNewVendor({ ...newVendor, contact_name: e.target.value })}
                                                        data-testid="vendor-contact-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Email</Label>
                                                    <Input
                                                        type="email"
                                                        value={newVendor.email}
                                                        onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                                                        data-testid="vendor-email-input"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Phone</Label>
                                                    <Input
                                                        value={newVendor.phone}
                                                        onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                                                        data-testid="vendor-phone-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>GST Number</Label>
                                                <Input
                                                    value={newVendor.gst_number}
                                                    onChange={(e) => setNewVendor({ ...newVendor, gst_number: e.target.value })}
                                                    data-testid="vendor-gst-input"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Address</Label>
                                                <Textarea
                                                    value={newVendor.address}
                                                    onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                                                    data-testid="vendor-address-input"
                                                />
                                            </div>
                                            <Button type="submit" className="w-full gold-gradient text-white" data-testid="submit-vendor-btn">
                                                {editingVendor ? 'Update Vendor' : 'Add Vendor'}
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            {/* Filter Controls */}
                            <Card className="mb-4">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <Filter className="w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search vendors..."
                                            value={filters.vendors.search}
                                            onChange={(e) => setFilters({ ...filters, vendors: { ...filters.vendors, search: e.target.value } })}
                                            className="max-w-xs"
                                            data-testid="vendors-filter-search"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Contact</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Phone</TableHead>
                                                <TableHead>GST</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredVendors.map((vendor) => (
                                                <TableRow key={vendor.id}>
                                                    <TableCell className="font-medium">{vendor.name}</TableCell>
                                                    <TableCell>{vendor.contact_name || '-'}</TableCell>
                                                    <TableCell>{vendor.email || '-'}</TableCell>
                                                    <TableCell>{vendor.phone || '-'}</TableCell>
                                                    <TableCell>{vendor.gst_number || '-'}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => openEditVendor(vendor)} data-testid={`edit-vendor-${vendor.id}`}>
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => deleteVendor(store.id, vendor.id).then(() => loadTabContent())} data-testid={`delete-vendor-${vendor.id}`}>
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredVendors.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                        {vendors.length === 0 ? 'No vendors yet.' : 'No vendors match the current filter.'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            {renderPagination('vendors')}
                        </div>
                    )}

                    {/* Purchase Orders Tab */}
                    {activeTab === 'purchase-orders' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Purchase Orders</h2>
                                    <p className="text-muted-foreground">Manage supplier orders</p>
                                </div>
                                <Dialog open={poDialogOpen} onOpenChange={(open) => { setPoDialogOpen(open); if (!open) { setEditingPO(null); setNewPO({ vendor_id: '', items: [{ product_id: '', quantity: '', unit_price: '' }], notes: '' }); } }}>
                                    <DialogTrigger asChild>
                                        <Button className="gold-gradient text-white" data-testid="create-po-btn">
                                            <Plus className="w-4 h-4 mr-2" /> Create PO
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle className="font-serif">{editingPO ? 'Edit Purchase Order' : 'Create Purchase Order'}</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleCreatePO} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Vendor</Label>
                                                <Select value={newPO.vendor_id} onValueChange={(v) => setNewPO({ ...newPO, vendor_id: v })}>
                                                    <SelectTrigger data-testid="po-vendor-select">
                                                        <SelectValue placeholder="Select vendor" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {vendors.map((v) => (
                                                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Items</Label>
                                                {newPO.items.map((item, idx) => (
                                                    <div key={idx} className="grid grid-cols-3 gap-2">
                                                        <Select value={item.product_id} onValueChange={(v) => {
                                                            const items = [...newPO.items];
                                                            items[idx].product_id = v;
                                                            setNewPO({ ...newPO, items });
                                                        }}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Product" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {products.map((p) => (
                                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Input
                                                            type="number"
                                                            placeholder="Qty"
                                                            value={item.quantity}
                                                            onChange={(e) => {
                                                                const items = [...newPO.items];
                                                                items[idx].quantity = e.target.value;
                                                                setNewPO({ ...newPO, items });
                                                            }}
                                                        />
                                                        <Input
                                                            type="number"
                                                            placeholder="Unit Price"
                                                            value={item.unit_price}
                                                            onChange={(e) => {
                                                                const items = [...newPO.items];
                                                                items[idx].unit_price = e.target.value;
                                                                setNewPO({ ...newPO, items });
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                                <Button type="button" variant="outline" size="sm" onClick={() => setNewPO({ ...newPO, items: [...newPO.items, { product_id: '', quantity: '', unit_price: '' }] })}>
                                                    Add Item
                                                </Button>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Notes</Label>
                                                <Textarea value={newPO.notes} onChange={(e) => setNewPO({ ...newPO, notes: e.target.value })} />
                                            </div>
                                            <Button type="submit" className="w-full gold-gradient text-white" data-testid="submit-po-btn">
                                                {editingPO ? 'Update Purchase Order' : 'Create Purchase Order'}
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            {/* Filter Controls */}
                            <Card className="mb-4">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <Filter className="w-4 h-4 text-muted-foreground" />
                                        <Select
                                            value={filters.purchaseOrders.status || 'all'}
                                            onValueChange={(v) => setFilters({ ...filters, purchaseOrders: { ...filters.purchaseOrders, status: v === 'all' ? '' : v } })}
                                        >
                                            <SelectTrigger className="w-[150px]" data-testid="po-filter-status">
                                                <SelectValue placeholder="All Statuses" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Statuses</SelectItem>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="approved">Approved</SelectItem>
                                                <SelectItem value="received">Received</SelectItem>
                                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={filters.purchaseOrders.vendorId || 'all'}
                                            onValueChange={(v) => setFilters({ ...filters, purchaseOrders: { ...filters.purchaseOrders, vendorId: v === 'all' ? '' : v } })}
                                        >
                                            <SelectTrigger className="w-[180px]" data-testid="po-filter-vendor">
                                                <SelectValue placeholder="All Vendors" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Vendors</SelectItem>
                                                {vendors.map((v) => (
                                                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {(filters.purchaseOrders.status || filters.purchaseOrders.vendorId) && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={() => setFilters({ ...filters, purchaseOrders: { status: '', vendorId: '' } })}
                                            >
                                                Clear Filters
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>PO ID</TableHead>
                                                <TableHead>Vendor</TableHead>
                                                <TableHead>Items</TableHead>
                                                <TableHead>Total</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPurchaseOrders.map((po) => (
                                                <TableRow key={po.id}>
                                                    <TableCell className="font-mono text-sm">{po.id.slice(0, 8)}...</TableCell>
                                                    <TableCell>{getVendorName(po.vendor_id)}</TableCell>
                                                    <TableCell>{po.items.length} items</TableCell>
                                                    <TableCell>{formatCurrency(po.total_amount, store.currency)}</TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={po.status}
                                                            onValueChange={(v) => handleUpdatePOStatus(po.id, v)}
                                                        >
                                                            <SelectTrigger className="w-[120px] h-8" data-testid={`po-status-${po.id}`}>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="pending">Pending</SelectItem>
                                                                <SelectItem value="approved">Approved</SelectItem>
                                                                <SelectItem value="received">Received</SelectItem>
                                                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>{formatDate(po.created_at)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => handleEditPO(po)} data-testid={`edit-po-${po.id}`}>
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeletePO(po.id)} data-testid={`delete-po-${po.id}`}>
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredPurchaseOrders.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                        {purchaseOrders.length === 0 ? 'No purchase orders yet.' : 'No purchase orders match the current filters.'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            {renderPagination('purchaseOrders')}
                        </div>
                    )}

                    {/* Reporting Tab */}
                    {activeTab === 'reporting' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Reporting</h2>
                                    <p className="text-muted-foreground">Sales, expenditure, and profit analytics</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="date"
                                        value={reportPeriod.startDate}
                                        onChange={(e) => setReportPeriod({ ...reportPeriod, startDate: e.target.value })}
                                        className="w-[150px]"
                                        data-testid="report-start-date"
                                    />
                                    <span className="text-muted-foreground">to</span>
                                    <Input
                                        type="date"
                                        value={reportPeriod.endDate}
                                        onChange={(e) => setReportPeriod({ ...reportPeriod, endDate: e.target.value })}
                                        className="w-[150px]"
                                        data-testid="report-end-date"
                                    />
                                    <Button onClick={loadReport} disabled={reportLoading} data-testid="generate-report-btn">
                                        {reportLoading ? 'Loading...' : 'Generate Report'}
                                    </Button>
                                </div>
                            </div>

                            {reportData ? (
                                <div className="space-y-6">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <Card className="luxury-card">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold gold-text">
                                                    {formatCurrency(reportData.total_sales || 0, store.currency)}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Online: {formatCurrency(reportData.online_sales || 0, store.currency)} | POS: {formatCurrency(reportData.pos_sales || 0, store.currency)}
                                                </p>
                                            </CardContent>
                                        </Card>

                                        <Card className="luxury-card">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenditures</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold text-red-500">
                                                    {formatCurrency(reportData.total_expenditures || 0, store.currency)}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">From Purchase Orders</p>
                                            </CardContent>
                                        </Card>

                                        <Card className="luxury-card">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className={`text-2xl font-bold ${(reportData.net_profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {formatCurrency(reportData.net_profit || 0, store.currency)}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">Sales - Expenditures</p>
                                            </CardContent>
                                        </Card>

                                        <Card className="luxury-card">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-muted-foreground">Subscription Revenue</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold gold-text">
                                                    {formatCurrency(reportData.subscription_revenue || 0, store.currency)}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">{reportData.total_subscribers || 0} subscribers</p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Detailed Stats */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg font-serif">Orders Summary</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Online Orders</span>
                                                        <span className="font-medium">{reportData.total_orders || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">POS Transactions</span>
                                                        <span className="font-medium">{reportData.total_pos_transactions || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Total Customers</span>
                                                        <span className="font-medium">{reportData.total_customers || 0}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg font-serif">Period</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">From</span>
                                                        <span className="font-medium">{reportData.period?.start || 'All time'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">To</span>
                                                        <span className="font-medium">{reportData.period?.end || 'Today'}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg font-serif">Quick Actions</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <Button variant="outline" className="w-full" onClick={() => setActiveTab('orders')}>
                                                    View Orders
                                                </Button>
                                                <Button variant="outline" className="w-full" onClick={() => setActiveTab('pos')}>
                                                    View POS Transactions
                                                </Button>
                                                <Button variant="outline" className="w-full" onClick={() => setActiveTab('purchase-orders')}>
                                                    View Purchase Orders
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            ) : (
                                <Card className="py-12">
                                    <CardContent className="text-center">
                                        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                                        <h3 className="text-lg font-medium mb-2">Generate a Report</h3>
                                        <p className="text-muted-foreground mb-4">
                                            Select a date range and click &ldquo;Generate Report&rdquo; to view your sales, expenditure, and profit analytics.
                                        </p>
                                        <Button onClick={loadReport} disabled={reportLoading} className="gold-gradient text-white">
                                            {reportLoading ? 'Loading...' : 'Generate Report for All Time'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* Staff Members Tab */}
                    {activeTab === 'staff' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Staff Members</h2>
                                    <p className="text-muted-foreground">Manage internal workers and their access permissions</p>
                                </div>
                                <Dialog open={staffDialogOpen} onOpenChange={(open) => { setStaffDialogOpen(open); if (!open) { setEditingStaff(null); setNewStaff({ email: '', password: '', name: '', phone: '', menu_access: ['products', 'inventory', 'orders', 'pos'], is_active: true }); } }}>
                                    <DialogTrigger asChild>
                                        <Button className="gold-gradient text-white" data-testid="add-staff-btn">
                                            <Plus className="w-4 h-4 mr-2" /> Add Staff
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle className="font-serif">{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateStaff} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Name *</Label>
                                                    <Input value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} required />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Phone</Label>
                                                    <Input value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} />
                                                </div>
                                            </div>
                                            {!editingStaff ? (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Email *</Label>
                                                        <Input type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} required />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Password *</Label>
                                                        <Input type="password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} required />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>New Password</Label>
                                                        <Input type="password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} placeholder="Leave blank to keep current" />
                                                        <p className="text-xs text-muted-foreground">Leave blank to keep current password</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Status</Label>
                                                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                                                            <Switch
                                                                checked={newStaff.is_active}
                                                                onCheckedChange={(checked) => setNewStaff({ ...newStaff, is_active: checked })}
                                                            />
                                                            <span className={newStaff.is_active ? 'text-green-600' : 'text-red-600'}>
                                                                {newStaff.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <Label>Menu Access</Label>
                                                <p className="text-xs text-muted-foreground mb-2">Select which sections this staff member can access</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                        { key: 'products', label: 'Products', icon: Package },
                                                        { key: 'inventory', label: 'Inventory', icon: Box },
                                                        { key: 'orders', label: 'Orders', icon: ShoppingCart },
                                                        { key: 'pos', label: 'POS', icon: CreditCard },
                                                        { key: 'vendors', label: 'Vendors', icon: Truck },
                                                        { key: 'purchase-orders', label: 'Purchase Orders', icon: Truck },
                                                        { key: 'plans', label: 'Subscription Plans', icon: DollarSign },
                                                        { key: 'reporting', label: 'Reporting', icon: BarChart3 },
                                                    ].map(({ key, label, icon: Icon }) => (
                                                        <div key={key} className="flex items-center gap-2 p-2 border rounded-lg">
                                                            <Switch
                                                                checked={newStaff.menu_access.includes(key)}
                                                                onCheckedChange={() => toggleStaffAccess(key)}
                                                            />
                                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                                            <span className="text-sm">{label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <Button type="submit" className="w-full gold-gradient text-white">
                                                {editingStaff ? 'Update Staff' : 'Add Staff'}
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Phone</TableHead>
                                                <TableHead>Access</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {staff.map((s) => (
                                                <TableRow key={s.id}>
                                                    <TableCell className="font-medium">{s.name}</TableCell>
                                                    <TableCell>{s.email}</TableCell>
                                                    <TableCell>{s.phone || '-'}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {(s.menu_access || []).slice(0, 3).map((m) => (
                                                                <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                                                            ))}
                                                            {(s.menu_access || []).length > 3 && (
                                                                <Badge variant="outline" className="text-xs">+{s.menu_access.length - 3}</Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={s.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                                            {s.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => handleViewStaffActivity(s)}>
                                                            <Activity className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => openEditStaff(s)}>
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteStaff(s.id)}>
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {staff.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                        No staff members yet. Add your first staff member to get started.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            {renderPagination('staff')}
                        </div>
                    )}

                    {/* Website Customers Tab */}
                    {activeTab === 'customers' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-serif font-semibold">Website Customers</h2>
                                <p className="text-muted-foreground">View and manage customers who have placed orders or subscribed</p>
                            </div>

                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Orders</TableHead>
                                                <TableHead>Total Spent</TableHead>
                                                <TableHead>Subscriptions</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {customers.map((c) => (
                                                <TableRow key={c.id}>
                                                    <TableCell className="font-medium">{c.name}</TableCell>
                                                    <TableCell>{c.email}</TableCell>
                                                    <TableCell>{c.order_count || 0}</TableCell>
                                                    <TableCell>{formatCurrency(c.total_spent || 0, store.currency)}</TableCell>
                                                    <TableCell>{c.subscription_count || 0}</TableCell>
                                                    <TableCell>
                                                        <Badge className={c.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                                            {c.is_active !== false ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => handleViewCustomerDetails(c)}>
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => openEditCustomer(c)}>
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCustomer(c.id)}>
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {customers.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                        No customers yet. Customers will appear here once they place orders or subscribe.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            {renderPagination('customers')}
                        </div>
                    )}

                    {/* Subscription Plans Tab */}
                    {activeTab === 'plans' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Subscription Plans</h2>
                                    <p className="text-muted-foreground">Manage Flexi Plans</p>
                                </div>
                                <Dialog open={planDialogOpen} onOpenChange={(open) => { setPlanDialogOpen(open); if (!open) { setEditingPlan(null); setNewPlan({ name: '', plan_type: '', duration_months: 11, min_amount: 500, max_amount: 100000, bonus_percentage: 0, benefits: [], description: '', scheme_type: 'fixed', target_metal: 'gold', metal_purity_key: 'auto' }); } }}>
                                    <DialogTrigger asChild>
                                        <Button className="gold-gradient text-white" data-testid="create-plan-btn">
                                            <Plus className="w-4 h-4 mr-2" /> Create Plan
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle className="font-serif">{editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleCreatePlan} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Plan Name</Label>
                                                    <Input
                                                        value={newPlan.name}
                                                        onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                                                        required
                                                        placeholder="e.g., Gold Flexi Premium"
                                                        data-testid="plan-name-input"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Scheme Type</Label>
                                                    <Select
                                                        value={newPlan.scheme_type || 'fixed'}
                                                        onValueChange={(v) => setNewPlan({ ...newPlan, scheme_type: v })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="fixed">Fixed Monthly</SelectItem>
                                                            <SelectItem value="flexible">Flexible (Pay Any)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Plan Type (Label)</Label>
                                                    <Input
                                                        value={newPlan.plan_type}
                                                        onChange={(e) => setNewPlan({ ...newPlan, plan_type: e.target.value })}
                                                        required
                                                        placeholder="e.g., Gold, Silver"
                                                        data-testid="plan-type-input"
                                                    />
                                                </div>
                                                {newPlan.scheme_type === 'flexible' && (
                                                    <div className="space-y-2">
                                                        <Label>Target Metal</Label>
                                                        <Select
                                                            value={newPlan.target_metal || 'gold'}
                                                            onValueChange={(v) => setNewPlan({ ...newPlan, target_metal: v })}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="gold">Gold</SelectItem>
                                                                <SelectItem value="silver">Silver</SelectItem>
                                                                <SelectItem value="platinum">Platinum</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>
                                            {newPlan.scheme_type === 'fixed' && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Duration (months)</Label>
                                                        <Input
                                                            type="number"
                                                            value={newPlan.duration_months}
                                                            onChange={(e) => setNewPlan({ ...newPlan, duration_months: parseInt(e.target.value) })}
                                                            required
                                                            data-testid="plan-duration-input"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Bonus %</Label>
                                                        <Input
                                                            type="number"
                                                            value={newPlan.bonus_percentage}
                                                            onChange={(e) => setNewPlan({ ...newPlan, bonus_percentage: e.target.value })}
                                                            data-testid="plan-bonus-input"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Min Amount (₹)</Label>
                                                    <Input
                                                        type="number"
                                                        value={newPlan.min_amount}
                                                        onChange={(e) => setNewPlan({ ...newPlan, min_amount: parseFloat(e.target.value) })}
                                                        required
                                                        placeholder="500"
                                                        data-testid="plan-min-amount-input"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Max Amount (₹)</Label>
                                                    <Input
                                                        type="number"
                                                        value={newPlan.max_amount}
                                                        onChange={(e) => setNewPlan({ ...newPlan, max_amount: parseFloat(e.target.value) })}
                                                        required
                                                        placeholder="100000"
                                                        data-testid="plan-max-amount-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Metal Purity Key</Label>
                                                    <Select
                                                        value={newPlan.metal_purity_key || ''}
                                                        onValueChange={(v) => setNewPlan({ ...newPlan, metal_purity_key: v })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="auto">Auto (store default)</SelectItem>
                                                            <SelectItem value="gold_24">gold_24</SelectItem>
                                                            <SelectItem value="gold_22">gold_22</SelectItem>
                                                            <SelectItem value="gold_18">gold_18</SelectItem>
                                                            <SelectItem value="gold_14">gold_14</SelectItem>
                                                            <SelectItem value="silver_1g">silver_1g</SelectItem>
                                                            <SelectItem value="platinum_1g">platinum_1g</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Description</Label>
                                                    <Textarea
                                                        value={newPlan.description}
                                                        onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                                                        placeholder="Describe the plan benefits..."
                                                        data-testid="plan-desc-input"
                                                    />
                                                </div>
                                            </div>
                                            <Button type="submit" className="w-full gold-gradient text-white" data-testid="submit-plan-btn">
                                                {editingPlan ? 'Update Plan' : 'Create Plan'}
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {subscriptionPlans.map((plan) => (
                                    <Card key={plan.id} className="luxury-card">
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <Badge variant="default" className="gold-gradient text-white">
                                                    {plan.plan_type}
                                                </Badge>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={plan.is_active ? 'outline' : 'secondary'}>
                                                        {plan.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                    <Button variant="ghost" size="sm" onClick={() => openEditPlan(plan)} data-testid={`edit-plan-${plan.id}`}>
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <CardTitle className="font-serif mt-2">{plan.name}</CardTitle>
                                            <CardDescription>{plan.description}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Amount Range</span>
                                                    <span className="font-semibold">{formatCurrency(plan.min_amount || 500, store.currency)} - {formatCurrency(plan.max_amount || 100000, store.currency)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Duration</span>
                                                    <span>{plan.duration_months} months</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Bonus</span>
                                                    <span className="gold-text font-semibold">{plan.bonus_percentage}%</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {subscriptionPlans.length === 0 && (
                                    <Card className="col-span-full">
                                        <CardContent className="py-8 text-center text-muted-foreground">
                                            No subscription plans yet. Create your first plan.
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Subscribers Section */}
                            <div className="mt-8">
                                <h3 className="text-xl font-serif font-semibold mb-4">Subscribers</h3>
                                <Card>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>User</TableHead>
                                                    <TableHead>Plan</TableHead>
                                                    <TableHead>Monthly Amount</TableHead>
                                                    <TableHead>Payments Made</TableHead>
                                                    <TableHead>Total Paid</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {subscribers.map((sub) => (
                                                    <TableRow key={sub.id}>
                                                        <TableCell>
                                                            <div>
                                                                <div className="font-medium">{sub.user_name || 'N/A'}</div>
                                                                <div className="text-sm text-muted-foreground">{sub.user_email}</div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{sub.plan_name}</Badge>
                                                            <div className="text-xs text-muted-foreground">{sub.plan_type}</div>
                                                        </TableCell>
                                                        <TableCell>{formatCurrency(sub.monthly_amount, store.currency)}</TableCell>
                                                        <TableCell>{sub.payments_made}</TableCell>
                                                        <TableCell>{formatCurrency(sub.total_paid, store.currency)}</TableCell>
                                                        <TableCell>
                                                            <Select value={sub.status} onValueChange={(value) => handleUpdateSubscriptionStatus(sub.id, value)}>
                                                                <SelectTrigger className="w-[140px] h-8">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="active">Active</SelectItem>
                                                                    <SelectItem value="partially_closed">Partially Closed</SelectItem>
                                                                    <SelectItem value="completed">Completed</SelectItem>
                                                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex gap-1">
                                                                <Button variant="outline" size="sm" onClick={() => handleViewSubscription(sub)}>
                                                                    <Eye className="w-4 h-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteSubscription(sub.id)}>
                                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {subscribers.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                            No subscribers yet.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tax' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Tax Configuration</h2>
                                    <p className="text-muted-foreground">Manage taxes for products and metals.</p>
                                </div>
                            </div>
                            <StoreTaxConfig storeId={store.id} />
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Activity Logs</h2>
                                    <p className="text-muted-foreground">Monitor subscription, payment, and store activities.</p>
                                </div>
                            </div>
                            <StoreLogs storeId={store.id} />
                        </div>
                    )}

                    {activeTab === 'shiprocket-logs' && (
                        <div className="space-y-6">
                            <ShiprocketLogs storeId={store.id} />
                        </div>
                    )}

                    {activeTab === 'media' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Media Library</h2>
                                    <p className="text-muted-foreground">Manage your store images and assets.</p>
                                </div>
                            </div>
                            <MediaLibrary 
                                storeId={store.id} 
                                onSelect={(url) => {
                                    toast.success("Image URL copied to clipboard");
                                    navigator.clipboard.writeText(url);
                                }} 
                            />
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-serif font-semibold">Store Settings</h2>
                                    <p className="text-muted-foreground">Manage order settings, currency, and other configurations.</p>
                                </div>
                            </div>
                            <StoreSettings storeId={store.id} />
                        </div>
                    )}
                </div>
            </main>

            {/* Subscriber Details Dialog */}
            <Dialog open={subscriberDialogOpen} onOpenChange={setSubscriberDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-serif">Subscription Details</DialogTitle>
                    </DialogHeader>
                    {subscriptionDetails && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-muted-foreground">User</Label>
                                    <p className="font-medium">{subscriptionDetails.subscription.user_name || 'N/A'}</p>
                                    <p className="text-sm text-muted-foreground">{subscriptionDetails.subscription.user_email}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Plan</Label>
                                    <p className="font-medium">{subscriptionDetails.subscription.plan_name}</p>
                                    <p className="text-sm text-muted-foreground">{subscriptionDetails.subscription.plan_type}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Monthly Amount</Label>
                                    <p className="font-medium">{formatCurrency(subscriptionDetails.subscription.monthly_amount, store?.currency)}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Total Paid</Label>
                                    <p className="font-medium">{formatCurrency(subscriptionDetails.subscription.total_paid, store?.currency)}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Payments Made</Label>
                                    <p className="font-medium">{subscriptionDetails.subscription.payments_made}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Status</Label>
                                    <Select 
                                        value={subscriptionDetails.subscription.status} 
                                        onValueChange={(value) => handleUpdateSubscriptionStatus(subscriptionDetails.subscription.id, value)}
                                    >
                                        <SelectTrigger className="w-[160px] h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="partially_closed">Partially Closed</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Start Date</Label>
                                    <p className="font-medium">{new Date(subscriptionDetails.subscription.start_date).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Maturity Date</Label>
                                    <p className="font-medium">{new Date(subscriptionDetails.subscription.maturity_date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            
                            <div>
                                <h4 className="font-semibold mb-3">Payment History</h4>
                                {subscriptionDetails.payments && subscriptionDetails.payments.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {subscriptionDetails.payments.map((payment) => (
                                                <TableRow key={payment.id}>
                                                    <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                                                    <TableCell>{formatCurrency(payment.amount, store?.currency)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{payment.status}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-muted-foreground text-center py-4">No payments yet</p>
                                )}
                            </div>

                            <div className="flex justify-end pt-4 border-t">
                                <Button 
                                    variant="destructive" 
                                    onClick={() => handleDeleteSubscription(subscriptionDetails.subscription.id)}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Subscription
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Settings Dialog */}
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Store Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <Select value={currency} onValueChange={setCurrency}>
                                <SelectTrigger data-testid="settings-currency-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INR">INR (₹)</SelectItem>
                                    <SelectItem value="USD">USD ($)</SelectItem>
                                    <SelectItem value="EUR">EUR (€)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <p className="text-sm">Manage market prices inline in the sidebar.</p>
                            <Button className="mt-2" onClick={() => { setSettingsDialogOpen(false); setMarketPricesSidebarOpen(true); }}>Open Market Prices</Button>
                        </div>
                        <Button onClick={handleUpdateSettings} className="w-full gold-gradient text-white" data-testid="save-settings-btn">
                            Save Settings
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Store Edit Dialog */}
            <Dialog open={storeEditDialogOpen} onOpenChange={setStoreEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Edit Store Information</DialogTitle>
                        <DialogDescription>Update your store details</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateStore} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Store Name</Label>
                            <Input
                                value={storeEditForm.name}
                                onChange={(e) => setStoreEditForm({ ...storeEditForm, name: e.target.value })}
                                required
                                data-testid="store-edit-name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={storeEditForm.description}
                                onChange={(e) => setStoreEditForm({ ...storeEditForm, description: e.target.value })}
                                data-testid="store-edit-desc"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Contact Email</Label>
                                <Input
                                    type="email"
                                    value={storeEditForm.contact_email}
                                    onChange={(e) => setStoreEditForm({ ...storeEditForm, contact_email: e.target.value })}
                                    data-testid="store-edit-email"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Contact Phone</Label>
                                <Input
                                    value={storeEditForm.contact_phone}
                                    onChange={(e) => setStoreEditForm({ ...storeEditForm, contact_phone: e.target.value })}
                                    data-testid="store-edit-phone"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Address</Label>
                            <Textarea
                                value={storeEditForm.address}
                                onChange={(e) => setStoreEditForm({ ...storeEditForm, address: e.target.value })}
                                data-testid="store-edit-address"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Address Google Maps URL</Label>
                            <Input
                                type="url"
                                value={storeEditForm.address_map_url}
                                onChange={(e) => setStoreEditForm({ ...storeEditForm, address_map_url: e.target.value })}
                                placeholder="https://maps.google.com/?q=Your+Address"
                                data-testid="store-edit-address-map-url"
                            />
                            <p className="text-xs text-muted-foreground">Makes the address clickable on contact page</p>
                        </div>
                        <Button type="submit" className="w-full gold-gradient text-white" data-testid="save-store-btn">
                            Save Changes
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Staff Activity Dialog */}
            <Dialog open={staffActivityOpen} onOpenChange={setStaffActivityOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-serif">Activity Log - {selectedStaff?.name}</DialogTitle>
                    </DialogHeader>
                    {staffActivityData && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Activity className="w-4 h-4" /> Recent Activity
                                </h3>
                                {staffActivityData.activity_logs?.length > 0 ? (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {staffActivityData.activity_logs.map((log, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                                                <span className="capitalize">{log.action.replace(/_/g, ' ')}</span>
                                                <span className="text-muted-foreground">{formatDateTime(log.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm">No activity logged yet</p>
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" /> POS Transactions
                                </h3>
                                {staffActivityData.pos_transactions?.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>ID</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Payment</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {staffActivityData.pos_transactions.slice(0, 10).map((tx) => (
                                                <TableRow key={tx.id}>
                                                    <TableCell>{tx.id.slice(0, 8)}...</TableCell>
                                                    <TableCell>{formatCurrency(tx.total_amount, store.currency)}</TableCell>
                                                    <TableCell className="capitalize">{tx.payment_method}</TableCell>
                                                    <TableCell>{formatDateTime(tx.created_at)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-muted-foreground text-sm">No POS transactions by this staff member</p>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Customer Details Dialog */}
            <Dialog open={customerDetailOpen} onOpenChange={setCustomerDetailOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-serif">Customer Details - {selectedCustomer?.name}</DialogTitle>
                    </DialogHeader>
                    {customerData && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Customer Info</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div><strong>Name:</strong> {customerData.customer?.name}</div>
                                        <div><strong>Email:</strong> {customerData.customer?.email}</div>
                                        <div><strong>Phone:</strong> {customerData.customer?.phone || '-'}</div>
                                        <div><strong>Joined:</strong> {formatDate(customerData.customer?.created_at)}</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Summary</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div><strong>Total Orders:</strong> {customerData.orders?.length || 0}</div>
                                        <div><strong>Total Spent:</strong> {formatCurrency(customerData.orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0, store.currency)}</div>
                                        <div><strong>Subscriptions:</strong> {customerData.subscriptions?.length || 0}</div>
                                        <div><strong>Payments Made:</strong> {customerData.payments?.length || 0}</div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div>
                                <h3 className="font-semibold mb-3">Orders</h3>
                                {customerData.orders?.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Order ID</TableHead>
                                                <TableHead>Items</TableHead>
                                                <TableHead>Total</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {customerData.orders.map((order) => (
                                                <TableRow key={order.id}>
                                                    <TableCell className="font-mono text-xs">{order.id}</TableCell>
                                                    <TableCell>{order.items?.length || 0} items</TableCell>
                                                    <TableCell>{formatCurrency(order.total_amount, store.currency)}</TableCell>
                                                    <TableCell><Badge className={getStatusColor(order.status)}>{order.status}</Badge></TableCell>
                                                    <TableCell>{formatDate(order.created_at)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-muted-foreground text-sm">No orders yet</p>
                                )}
                            </div>

                            <div>
                                <h3 className="font-semibold mb-3">Subscriptions</h3>
                                {customerData.subscriptions?.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Plan</TableHead>
                                                <TableHead>Monthly Amount</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Start Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {customerData.subscriptions.map((sub) => (
                                                <TableRow key={sub.id}>
                                                    <TableCell>{sub.plan_name || 'Unknown Plan'}</TableCell>
                                                    <TableCell>{formatCurrency(sub.monthly_amount, store.currency)}</TableCell>
                                                    <TableCell><Badge className={getStatusColor(sub.status)}>{sub.status}</Badge></TableCell>
                                                    <TableCell>{formatDate(sub.created_at)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-muted-foreground text-sm">No subscriptions yet</p>
                                )}
                            </div>

                            <div>
                                <h3 className="font-semibold mb-3">Payments</h3>
                                {customerData.payments?.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {customerData.payments.slice(0, 10).map((payment) => (
                                                <TableRow key={payment.id}>
                                                    <TableCell>{formatCurrency(payment.amount, store.currency)}</TableCell>
                                                    <TableCell><Badge className={getStatusColor(payment.status)}>{payment.status}</Badge></TableCell>
                                                    <TableCell>{formatDate(payment.created_at)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-muted-foreground text-sm">No payments yet</p>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Customer Edit Dialog */}
            <Dialog open={customerEditOpen} onOpenChange={setCustomerEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Edit Customer</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpdateCustomer} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={customerEditForm.name} onChange={(e) => setCustomerEditForm({ ...customerEditForm, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input value={customerEditForm.phone} onChange={(e) => setCustomerEditForm({ ...customerEditForm, phone: e.target.value })} />
                        </div>
                        <Button type="submit" className="w-full gold-gradient text-white">
                            Update Customer
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Media Library Select Dialog */}
            <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-serif">Select Image</DialogTitle>
                    </DialogHeader>
                    <MediaLibrary 
                        storeId={store?.id} 
                        selectMode={true}
                        onSelect={(url) => {
                            if (mediaSelectCallback) {
                                mediaSelectCallback(url);
                            }
                            setMediaDialogOpen(false);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StoreAdminDashboard;
