import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getStore, getProducts, getProduct, getInventory } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Minus, ChevronRight, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';

const ProductDetail = () => {
    const { storeId, productId } = useParams();
    const [store, setStore] = useState(null);
    const [product, setProduct] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [recentlyViewed, setRecentlyViewed] = useState([]);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [cart, setCart] = useState(() => {
        const saved = localStorage.getItem(`cart_${storeId}`);
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        loadData();
    }, [storeId, productId]);

    useEffect(() => {
        // Save cart to localStorage
        localStorage.setItem(`cart_${storeId}`, JSON.stringify(cart));
    }, [cart, storeId]);

    useEffect(() => {
        // Add to recently viewed
        if (product) {
            const recentKey = `recent_${storeId}`;
            const recent = JSON.parse(localStorage.getItem(recentKey) || '[]');
            const filtered = recent.filter(id => id !== product.id);
            const updated = [product.id, ...filtered].slice(0, 10);
            localStorage.setItem(recentKey, JSON.stringify(updated));
        }
    }, [product, storeId]);

    const loadData = async () => {
        try {
            const [storeRes, productRes, productsRes, inventoryRes] = await Promise.all([
                getStore(storeId),
                getProduct(storeId, productId),
                getProducts(storeId),
                getInventory(storeId).catch(() => ({ data: [] }))
            ]);
            setStore(storeRes.data);
            setProduct(productRes.data);
            setAllProducts(productsRes.data);
            setInventory(inventoryRes.data || []);

            // Load recently viewed products
            const recentKey = `recent_${storeId}`;
            const recentIds = JSON.parse(localStorage.getItem(recentKey) || '[]');
            const recentProducts = recentIds
                .filter(id => id !== productId)
                .map(id => productsRes.data.find(p => p.id === id))
                .filter(Boolean)
                .slice(0, 4);
            setRecentlyViewed(recentProducts);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load product');
        } finally {
            setLoading(false);
        }
    };
    
    const getProductStock = (prodId) => {
        const inv = inventory.find(i => i.product_id === prodId);
        return inv ? inv.quantity : 0;
    };

    const addToCart = () => {
        const stock = getProductStock(product.id);
        if (stock <= 0) {
            toast.error('This product is out of stock');
            return;
        }
        
        const existing = cart.find(item => item.product_id === product.id);
        const currentQtyInCart = existing ? existing.quantity : 0;
        
        if (currentQtyInCart + quantity > stock) {
            toast.error(`Only ${stock} items available in stock`);
            return;
        }
        
        let newCart;
        if (existing) {
            newCart = cart.map(item =>
                item.product_id === product.id 
                    ? { ...item, quantity: item.quantity + quantity } 
                    : item
            );
        } else {
            newCart = [...cart, { 
                product_id: product.id, 
                product_name: product.name, 
                quantity: quantity, 
                price: product.price,
                image: product.images?.[0]
            }];
        }
        setCart(newCart);
        toast.success(`${product.name} added to cart`);
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Get featured products (excluding current product)
    const featuredProducts = allProducts
        .filter(p => p.id !== productId && p.is_active)
        .slice(0, 4);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    if (!product || !store) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card>
                    <CardContent className="p-8 text-center">
                        <h2 className="text-xl font-serif mb-4">Product Not Found</h2>
                        <Link to={`/store/${storeId}`}>
                            <Button>Back to Store</Button>
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

            {/* Breadcrumb */}
            <div className="bg-muted/50 border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Link to={`/store/${storeId}`} className="hover:text-foreground">Home</Link>
                        <ChevronRight className="w-4 h-4" />
                        <Link to={`/store/${storeId}/category/${encodeURIComponent(product.category || 'All')}`} className="hover:text-foreground">
                            {product.category || 'Products'}
                        </Link>
                        <ChevronRight className="w-4 h-4" />
                        <span className="text-foreground">{product.name}</span>
                    </div>
                </div>
            </div>

            {/* Product Detail */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Product Image */}
                    <div className="space-y-4">
                        <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                            {product.images?.[selectedImageIndex] || product.images?.[0] ? (
                                <img 
                                    src={product.images[selectedImageIndex] || product.images[0]} 
                                    alt={product.name} 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full gold-gradient opacity-30 flex items-center justify-center">
                                    <span className="text-muted-foreground">No Image</span>
                                </div>
                            )}
                        </div>
                        {/* Thumbnail gallery if multiple images */}
                        {product.images?.length > 1 && (
                            <div className="flex gap-2 flex-wrap">
                                {product.images.map((img, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`w-20 h-20 rounded border overflow-hidden cursor-pointer transition-all ${
                                            selectedImageIndex === idx ? 'ring-2 ring-gold border-gold' : 'hover:ring-2 ring-gold/50'
                                        }`}
                                        onClick={() => setSelectedImageIndex(idx)}
                                    >
                                        <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <div className="space-y-6">
                        <div>
                            {product.category && (
                                <Badge variant="outline" className="mb-2">{product.category}</Badge>
                            )}
                            <h1 className="text-4xl font-serif font-semibold mb-2">{product.name}</h1>
                            {product.sku && (
                                <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                            )}
                        </div>

                        <div className="text-4xl font-serif gold-text">
                            {formatCurrency(product.price, store.currency)}
                        </div>

                        {product.weight && (
                            <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">Weight:</span>
                                <span className="font-medium">{product.weight}g</span>
                            </div>
                        )}

                        {product.description && (
                            <div>
                                <h3 className="font-semibold mb-2">Description</h3>
                                <p className="text-muted-foreground leading-relaxed">{product.description}</p>
                            </div>
                        )}

                        <div className="border-t pt-6 space-y-4">
                            {/* Stock Status */}
                            {(() => {
                                const stock = getProductStock(product.id);
                                const isOutOfStock = stock <= 0;
                                const isLowStock = stock > 0 && stock < 10;
                                
                                return (
                                    <>
                                        {isOutOfStock && (
                                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                                <AlertTriangle className="w-5 h-5" />
                                                <span className="font-medium">Out of Stock</span>
                                            </div>
                                        )}
                                        {isLowStock && (
                                            <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-700">
                                                <AlertTriangle className="w-5 h-5" />
                                                <span className="font-medium">Only {stock} left in stock - Order soon!</span>
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-medium">Quantity:</span>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                    disabled={quantity <= 1 || isOutOfStock}
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </Button>
                                                <span className="w-12 text-center font-medium">{quantity}</span>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => setQuantity(Math.min(stock || 99, quantity + 1))}
                                                    disabled={isOutOfStock || quantity >= stock}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <Button 
                                            className={`w-full h-14 text-lg ${isOutOfStock ? 'bg-gray-400 cursor-not-allowed' : 'gold-gradient text-white'}`}
                                            onClick={addToCart}
                                            disabled={isOutOfStock}
                                            data-testid="add-to-cart-btn"
                                        >
                                            <ShoppingCart className="w-5 h-5 mr-2" />
                                            {isOutOfStock ? 'Out of Stock' : `Add to Cart - ${formatCurrency(product.price * quantity, store.currency)}`}
                                        </Button>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="border-t pt-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                        <span className="text-green-600">✓</span>
                                    </div>
                                    <span>Free Shipping</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                        <span className="text-blue-600">✓</span>
                                    </div>
                                    <span>Certified Jewelry</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                        <span className="text-purple-600">✓</span>
                                    </div>
                                    <span>Easy Returns</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                                        <span className="text-gold">✓</span>
                                    </div>
                                    <span>Hallmarked Gold</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recently Viewed */}
                {recentlyViewed.length > 0 && (
                    <section className="mt-16">
                        <h2 className="text-2xl font-serif mb-6">Recently Viewed</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {recentlyViewed.map((item) => (
                                <Link key={item.id} to={`/store/${storeId}/product/${item.id}`}>
                                    <Card className="luxury-card overflow-hidden group cursor-pointer">
                                        <div className="aspect-square bg-muted overflow-hidden">
                                            {item.images?.[0] ? (
                                                <img 
                                                    src={item.images[0]} 
                                                    alt={item.name} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="w-full h-full gold-gradient opacity-20" />
                                            )}
                                        </div>
                                        <CardContent className="p-3">
                                            <h3 className="font-medium text-sm truncate">{item.name}</h3>
                                            <p className="gold-text font-semibold">{formatCurrency(item.price, store.currency)}</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Featured Products */}
                {featuredProducts.length > 0 && (
                    <section className="mt-16">
                        <h2 className="text-2xl font-serif mb-6">You May Also Like</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {featuredProducts.map((item) => (
                                <Link key={item.id} to={`/store/${storeId}/product/${item.id}`}>
                                    <Card className="luxury-card overflow-hidden group cursor-pointer">
                                        <div className="aspect-square bg-muted overflow-hidden">
                                            {item.images?.[0] ? (
                                                <img 
                                                    src={item.images[0]} 
                                                    alt={item.name} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="w-full h-full gold-gradient opacity-20" />
                                            )}
                                        </div>
                                        <CardContent className="p-3">
                                            <h3 className="font-medium text-sm truncate">{item.name}</h3>
                                            <p className="gold-text font-semibold">{formatCurrency(item.price, store.currency)}</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            {/* Footer */}
            <footer className="bg-primary text-primary-foreground py-8 mt-16">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-sm opacity-60">© 2025 {store.name}. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default ProductDetail;
