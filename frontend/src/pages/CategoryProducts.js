import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStore, getProducts } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { ShoppingCart, User, Plus, ArrowLeft, LogIn, Search } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

const CategoryProducts = () => {
    const { storeId, category } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [allCategories, setAllCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState(() => {
        const saved = localStorage.getItem(`cart_${storeId}`);
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        loadData();
    }, [storeId, category]);

    useEffect(() => {
        localStorage.setItem(`cart_${storeId}`, JSON.stringify(cart));
    }, [cart, storeId]);

    const loadData = async () => {
        try {
            const [storeRes, productsRes] = await Promise.all([
                getStore(storeId),
                getProducts(storeId)
            ]);
            setStore(storeRes.data);
            
            // Get all unique categories
            const categories = [...new Set(productsRes.data.filter(p => p.category).map(p => p.category))];
            setAllCategories(categories);
            
            // Filter products by category
            const decodedCategory = decodeURIComponent(category);
            const filteredProducts = productsRes.data.filter(p => p.category === decodedCategory);
            setProducts(filteredProducts);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product) => {
        const existing = cart.find(item => item.product_id === product.id);
        let newCart;
        if (existing) {
            newCart = cart.map(item =>
                item.product_id === product.id 
                    ? { ...item, quantity: item.quantity + 1 } 
                    : item
            );
        } else {
            newCart = [...cart, { 
                product_id: product.id, 
                product_name: product.name, 
                quantity: 1, 
                price: product.price,
                image: product.images?.[0]
            }];
        }
        setCart(newCart);
        toast.success(`${product.name} added to cart`);
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.quantity, 0);

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
                        <Link to="/">
                            <Button>Go Home</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="bg-primary text-primary-foreground sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => navigate(`/store/${storeId}`)}
                            className="text-primary-foreground hover:bg-white/10"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                        <Link to={`/store/${storeId}`}>
                            <h1 className="text-xl font-serif">{store.name}</h1>
                        </Link>
                    </div>
                    <div className="flex items-center gap-2">
                        {user ? (
                            <Link to="/portal">
                                <Button variant="ghost" className="text-primary-foreground hover:bg-white/10">
                                    <User className="w-4 h-4 mr-2" /> Account
                                </Button>
                            </Link>
                        ) : (
                            <Link to="/login">
                                <Button variant="ghost" className="text-primary-foreground hover:bg-white/10">
                                    <LogIn className="w-4 h-4 mr-2" /> Login
                                </Button>
                            </Link>
                        )}
                        <Link to={`/store/${storeId}`}>
                            <Button variant="ghost" className="text-primary-foreground hover:bg-white/10 relative">
                                <ShoppingCart className="w-5 h-5" />
                                {cartTotal > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-white text-xs rounded-full flex items-center justify-center">
                                        {cartTotal}
                                    </span>
                                )}
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Category Navigation */}
            <nav className="bg-card border-b py-3">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-4 md:gap-8 px-4">
                    <Link 
                        to={`/store/${storeId}`}
                        className="hover:text-gold cursor-pointer transition-colors text-sm md:text-base"
                    >
                        All Products
                    </Link>
                    {allCategories.map((cat, i) => (
                        <Link 
                            key={i}
                            to={`/store/${storeId}/category/${encodeURIComponent(cat)}`}
                            className={`hover:text-gold cursor-pointer transition-colors text-sm md:text-base ${
                                cat === decodedCategory ? 'text-gold font-semibold' : ''
                            }`}
                        >
                            {cat}
                        </Link>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredProducts.map((product) => (
                        <Link key={product.id} to={`/store/${storeId}/product/${product.id}`}>
                            <Card className="luxury-card overflow-hidden group cursor-pointer h-full">
                                <div className="h-56 bg-muted flex items-center justify-center overflow-hidden">
                                    {product.images?.[0] ? (
                                        <img 
                                            src={product.images[0]} 
                                            alt={product.name} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full gold-gradient opacity-20" />
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
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}
                                            className="gold-gradient text-white"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {filteredProducts.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-muted-foreground text-lg mb-4">
                            {searchTerm 
                                ? `No products found matching "${searchTerm}" in ${decodedCategory}`
                                : `No products available in ${decodedCategory}`
                            }
                        </p>
                        <Link to={`/store/${storeId}`}>
                            <Button variant="outline">View All Products</Button>
                        </Link>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="bg-primary text-primary-foreground py-8 mt-16">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <h2 className="text-xl font-serif mb-2">{store.name}</h2>
                    <p className="text-sm opacity-60">© 2025 {store.name}. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default CategoryProducts;
