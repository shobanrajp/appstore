import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { getStore, getProducts, getInventory, getSubscriptionPlans } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Grid3X3, List } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import { useCart } from '../context/CartContext';

const StoreProducts = () => {
    const { storeId } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [plans, setPlans] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    // Note: do NOT depend on the `searchParams` object; use `location.search`
    // because `searchParams` identity can change each render causing loops.
    const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
    const [sortBy, setSortBy] = useState('name');
    const [viewMode, setViewMode] = useState('grid');
    const navigate = useNavigate();
    const { cart, setCart, addToCart: contextAddToCart, cartCount } = useCart(storeId);

    const categories = [...new Set(products.filter(p => p.category).map(p => p.category))];

    // Define loadData before effects to avoid temporal dead zone
    const loadData = useCallback(async () => {
        try {
            const [storeRes, productsRes, plansRes, inventoryRes] = await Promise.all([
                getStore(storeId),
                getProducts(storeId),
                getSubscriptionPlans(storeId).catch(() => ({ data: [] })),
                getInventory(storeId).catch(() => ({ data: [] }))
            ]);
            setStore(storeRes.data);
            setProducts(productsRes.data);
            setPlans(plansRes.data || []);
            setInventory(inventoryRes.data || []);
        } catch (error) {
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Ensure component updates when the URL/search params change (SPA navigation)
    useEffect(() => {
        try {
            const params = new URLSearchParams(location.search || window.location.search);
            const s = params.get('search') || '';
            setSearchTerm(s);
        } catch (e) {}
    }, [location.search]);

    
    
    

    // Filter subscription plans by searchTerm as well
    const filteredPlans = plans
        .filter(p => p.is_active !== false)
        .filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())))
        .sort((a, b) => a.name.localeCompare(b.name));

    const getProductStock = (productId) => {
        if (!inventory) return 0;
        if (!Array.isArray(inventory) && typeof inventory === 'object') {
            const inv = inventory[productId] || inventory[productId.toString()];
            return inv ? Number(inv.quantity ?? 0) : 0;
        }
        const inv = inventory.find(i =>
            i.product_id === productId ||
            i.productId === productId ||
            (i.product && (i.product.id === productId || i.product._id === productId))
        );
        return inv ? Number(inv.quantity ?? 0) : 0;
    };

    const getInventoryEntry = (productId) => {
        if (!inventory) return { quantity: 0, min_stock_level: 0 };
        if (!Array.isArray(inventory) && typeof inventory === 'object') {
            const inv = inventory[productId] || inventory[productId.toString()];
            if (!inv) return { quantity: 0, min_stock_level: 0 };
            return { quantity: Number(inv.quantity ?? 0), min_stock_level: Number(inv.min_stock_level ?? 5) };
        }
        const inv = inventory.find(i =>
            i.product_id === productId ||
            i.productId === productId ||
            (i.product && (i.product.id === productId || i.product._id === productId))
        );
        if (!inv) return { quantity: 0, min_stock_level: 0 };
        return { quantity: Number(inv.quantity ?? 0), min_stock_level: Number(inv.min_stock_level ?? 5) };
    };

    const addToCart = (product) => {
        const stock = getProductStock(product.id);
        if (stock <= 0) {
            toast.error(`${product.name} is out of stock`);
            return;
        }
        const existing = cart.find(item => item.product_id === product.id);
        if (existing && existing.quantity >= stock) {
            toast.error(`Only ${stock} items available`);
            return;
        }
        // delegate persistence and updates to CartContext
        contextAddToCart(product, 1);
        toast.success(`${product.name} added to cart`);
    };

    const filteredProducts = products
        .filter(p => p.is_active !== false)
        .filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())))
        .filter(p => !selectedCategory || p.category === selectedCategory)
        .sort((a, b) => {
            if (sortBy === 'price_low') return a.price - b.price;
            if (sortBy === 'price_high') return b.price - a.price;
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            return 0;
        });

    const cartTotal = cartCount;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <StoreHeader store={store} storeId={storeId} cartTotal={cartTotal} activeTab="products" />

            {/* Filters */}
            <div className="border-b bg-card">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[200px] max-w-md">
                            <div className="relative" style={{ minWidth: 240 }}>
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={selectedCategory || 'all'} onValueChange={(v) => setSelectedCategory(v === 'all' ? '' : v)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name">Name</SelectItem>
                                <SelectItem value="price_low">Price: Low to High</SelectItem>
                                <SelectItem value="price_high">Price: High to Low</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex gap-1">
                            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('grid')}>
                                <Grid3X3 className="w-4 h-4" />
                            </Button>
                            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('list')}>
                                <List className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Plans (matching search) */}
            {filteredPlans && filteredPlans.length > 0 && (
                <main className="max-w-7xl mx-auto px-4 py-8">
                    <h2 className="text-2xl font-serif mb-4">Subscription Plans</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {filteredPlans.map(plan => (
                            <Card key={plan.id} className="luxury-card">
                                <CardContent className="p-4">
                                    <h3 className="font-serif font-semibold text-lg">{plan.name}</h3>
                                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{plan.description}</p>
                                    <div className="flex items-center justify-between mt-4">
                                        <div className="text-gold font-semibold">{formatCurrency(plan.min_amount || 0, store?.currency)}+</div>
                                        <Link
                                            to={`/store/${storeId}/plans`}
                                            onClick={(e) => {
                                                // preserve new-tab behavior
                                                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e.button && e.button !== 0)) return;
                                                e.preventDefault();
                                                const target = `/store/${storeId}/plans`;
                                                try {
                                                    navigate(target);
                                                } catch (err) {
                                                    window.location.href = target;
                                                    return;
                                                }
                                            }}
                                        >
                                            <Button size="sm" className="gold-gradient text-white">View Plans</Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </main>
            )}

            {/* Products */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="mb-4 text-muted-foreground">
                    {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                </div>
                
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4' : 'space-y-4'}>
                    {filteredProducts.map((product) => {
                        const inv = getInventoryEntry(product.id);
                        const stock = inv.quantity;
                        const minLevel = inv.min_stock_level;
                        const isOutOfStock = stock <= 0;
                        const isLowStock = stock > 0 && (stock < 10 || (minLevel > 0 && stock <= minLevel));
                        
                        if (viewMode === 'list') {
                                return (
                                    <Link key={product.id} to={`/store/${storeId}/product/${product.id}`}>
                                    <Card className={`hover:shadow-md transition-shadow ${isOutOfStock ? 'opacity-70' : ''}`}>
                                        <CardContent className="p-4 flex gap-4">
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded overflow-hidden flex-shrink-0 relative">
                                                {product.images?.[0] ? (
                                                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full gold-gradient opacity-20" />
                                                )}
                                                {isOutOfStock && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                        <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-serif font-semibold text-lg">{product.name}</h3>
                                                {product.category && <Badge variant="outline" className="text-xs mt-1">{product.category}</Badge>}
                                                {isLowStock && <Badge className="ml-2 text-xs bg-orange-500">Only {stock} left</Badge>}
                                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                                            </div>
                                            <div className="flex flex-col items-end justify-between">
                                                <span className="gold-text text-xl font-semibold">{formatCurrency(product.price, store?.currency)}</span>
                                                <Button
                                                    size="sm"
                                                    onClick={(e) => { e.preventDefault(); if (!isOutOfStock) addToCart(product); }}
                                                    className={isOutOfStock ? 'bg-gray-400 cursor-not-allowed' : 'gold-gradient text-white'}
                                                    disabled={isOutOfStock}
                                                >
                                                    <Plus className="w-4 h-4 mr-1" /> Add
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            );
                        }
                        
                                return (
                            <Link key={product.id} to={`/store/${storeId}/product/${product.id}`}>
                                <Card className={`luxury-card overflow-hidden group cursor-pointer ${isOutOfStock ? 'opacity-70' : ''}`}>
                                    <div className="h-40 sm:h-48 lg:h-56 bg-muted flex items-center justify-center overflow-hidden relative">
                                        {product.images?.[0] ? (
                                            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full gold-gradient opacity-20" />
                                        )}
                                        {isOutOfStock && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <Badge variant="destructive" className="text-sm">Out of Stock</Badge>
                                            </div>
                                        )}
                                        {isLowStock && !isOutOfStock && (
                                            <Badge variant="secondary" className="absolute top-2 right-2 text-xs bg-orange-500 text-white">
                                                Only {stock} left
                                            </Badge>
                                        )}
                                    </div>
                                    <CardContent className="p-4">
                                        <h3 className="font-serif font-semibold text-lg">{product.name}</h3>
                                        {product.category && <Badge variant="outline" className="text-xs mt-1">{product.category}</Badge>}
                                        {product.weight && <p className="text-sm text-muted-foreground">{product.weight}g</p>}
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="gold-text text-xl font-semibold">{formatCurrency(product.price, store?.currency)}</span>
                                            <Button
                                                size="sm"
                                                onClick={(e) => { e.preventDefault(); if (!isOutOfStock) addToCart(product); }}
                                                className={isOutOfStock ? 'bg-gray-400 cursor-not-allowed' : 'gold-gradient text-white'}
                                                disabled={isOutOfStock}
                                            >
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
                
                {filteredProducts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No products found matching your criteria.
                    </div>
                )}
            </main>
            
            <StoreFooter store={store} storeId={storeId} />
        </div>
    );
};

export default StoreProducts;
