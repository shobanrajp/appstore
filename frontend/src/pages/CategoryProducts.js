import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStore, getProducts, getInventory } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Plus, Search, ArrowLeft, User, LogIn, ShoppingCart } from 'lucide-react';
import { formatCurrency, setPageTitle } from '../lib/utils';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import { useCart } from '../context/CartContext';

const CategoryProducts = () => {
    const { storeId, category } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [allCategories, setAllCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { cart, setCart, addToCart: contextAddToCart, cartCount } = useCart(storeId);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [storeRes, productsRes, inventoryRes] = await Promise.all([
                    getStore(storeId),
                    getProducts(storeId),
                    getInventory(storeId).catch(() => ({ data: [] }))
                ]);
                setStore(storeRes.data);
                setPageTitle(storeRes.data, 'Products');
                // normalize inventory into a map by product_id for reliable lookups
                const invArray = inventoryRes.data || [];
                const invMap = invArray.reduce((m, i) => {
                    m[i.product_id] = i;
                    return m;
                }, {});
                setInventory(invMap);
                
                // Get all unique categories
                const categories = [...new Set(productsRes.data.filter(p => p.category).map(p => p.category))];
                setAllCategories(categories);
                
                // Filter products by category
                const decodedCategory = decodeURIComponent(category);
                const filteredProducts = productsRes.data.filter(p => p.category === decodedCategory);
                setProducts(filteredProducts);
            } catch (error) {
                toast.error('Failed to load products');
            } finally {
                setLoading(false);
            }
        };
    
        loadData();
    }, [storeId, category]);

    // cart is provided by CartContext

    // returns numeric stock quantity
    const getProductStock = (productId) => {
        const inv = inventory[productId];
        return inv ? inv.quantity : 0;
    };
    
    // helper to get inventory entry (quantity + min_stock_level)
    const getInventoryEntry = (productId) => {
        return inventory[productId] || null;
    };

    const addToCart = (product) => {
        const stock = getProductStock(product.id);
        if (stock <= 0) {
            toast.error(`${product.name} is out of stock`);
            return;
        }
        // let context handle cart updates/persistence
        contextAddToCart(product, 1);
        toast.success(`${product.name} added to cart`);
    };

    const cartTotal = cartCount;

    // Filter products by search term
    const filteredProducts = products.filter(product => {
        if (!searchTerm) return true;
        return product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    const decodedCategory = decodeURIComponent(category);

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
                <Card>
                    <CardContent className="p-8 text-center">
                        <h2 className="text-xl font-serif mb-4">Store Not Found</h2>
                        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
                            <Button>Go Home</Button>
                        </a>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col w-full overflow-x-hidden">
            <StoreHeader store={store} storeId={storeId} cartTotal={cartTotal} activeTab="products" />

            {/* Category Navigation */}
            <nav className="bg-card border-b py-3">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-4 md:gap-8 px-4">
                    <a 
                        href={`/store/${storeId}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/store/${storeId}`); }}
                        className="hover:text-gold cursor-pointer transition-colors text-sm md:text-base"
                    >
                        All Products
                    </a>
                    {allCategories.map((cat, i) => (
                        <a 
                            key={i}
                            href={`/store/${storeId}/category/${encodeURIComponent(cat)}`}
                            onClick={(e) => { e.preventDefault(); navigate(`/store/${storeId}/category/${encodeURIComponent(cat)}`); }}
                            className={`hover:text-gold cursor-pointer transition-colors text-sm md:text-base ${
                                cat === decodedCategory ? 'text-gold font-semibold' : ''
                            }`}
                        >
                            {cat}
                        </a>
                    ))}
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Title */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-serif mb-2">{decodedCategory}</h1>
                    <p className="text-muted-foreground">{filteredProducts.length} products found</p>
                </div>

                {/* Search Bar */}
                <div className="max-w-md mx-auto mb-8">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={`Search in ${decodedCategory}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredProducts.map((product) => {
                        const inv = getInventoryEntry(product.id);
                        const stock = inv ? inv.quantity : 0;
                        const minLevel = inv ? (inv.min_stock_level ?? 5) : 0;
                        const isOutOfStock = stock <= 0;
                        const isLowStock = stock > 0 && (stock < 10 || (minLevel > 0 && stock <= minLevel));
                        
                        return (
                            <Link key={product.id} to={`/store/${storeId}/product/${product.id}`}>
                                <Card className={`luxury-card overflow-hidden group cursor-pointer h-full ${isOutOfStock ? 'opacity-70' : ''}`}>
                                    <div className="h-40 sm:h-48 lg:h-56 bg-muted flex items-center justify-center overflow-hidden relative">
                                        {product.images?.[0] ? (
                                            <img 
                                                src={product.images[0]} 
                                                alt={product.name} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
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
                                        <Badge variant="outline" className="text-xs mt-1">{product.category}</Badge>
                                        {product.weight && (
                                            <p className="text-sm text-muted-foreground mt-1">{product.weight}g</p>
                                        )}
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="gold-text text-xl font-semibold">
                                                {formatCurrency(product.price, store.currency)}
                                            </span>
                                            <Button
                                                size="sm"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isOutOfStock) addToCart(product); }}
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
                    <div className="text-center py-16">
                        <p className="text-muted-foreground text-lg mb-4">
                            {searchTerm 
                                ? `No products found matching "${searchTerm}" in ${decodedCategory}`
                                : `No products available in ${decodedCategory}`
                            }
                        </p>
                        <a href={`/store/${storeId}`} onClick={(e) => { e.preventDefault(); navigate(`/store/${storeId}`); }}>
                            <Button variant="outline">View All Products</Button>
                        </a>
                    </div>
                )}
            </main>

            <StoreFooter store={store} storeId={storeId} />
        </div>
    );
};

export default CategoryProducts;
