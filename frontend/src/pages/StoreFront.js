import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStore, getProducts, getSubscriptionPlans, getPageConfig, subscribeToPlan, createPaymentOrder, verifyPayment, getInventory } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { ShoppingCart, User, Plus, Minus, X, CreditCard, LogIn, Search, MessageCircle, Phone, Mail, MapPin, AlertTriangle, Menu } from 'lucide-react';
import { formatCurrency, setPageTitle } from '../lib/utils';
import { useCart } from '../context/CartContext';

// Dynamic Component Renderer - renders components based on page config
const DynamicComponent = ({ component, products, filteredProducts, plans, store, addToCart, onSubscribe, user, categories, selectedCategory, onCategorySelect, searchTerm, onSearchChange, storeId, inventory, globalSearchTerm, onGlobalSearch, onNavigate, recentlyViewedPlans }) => {
    const { type, props = {} } = component;
    const [localSearch, setLocalSearch] = useState(globalSearchTerm || '');
    const [suggestions, setSuggestions] = useState([]);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [heroIndex, setHeroIndex] = useState(0);
    const suggestionsRef = useRef(null);
    // Use store-specific cart context so we can show live count badge
    const { cartCount } = useCart(storeId);
    const navigate = useNavigate();

    useEffect(() => {
        if (globalSearchTerm !== undefined) setLocalSearch(globalSearchTerm || '');
    }, [globalSearchTerm]);

    const triggerSearch = (value) => {
        if (typeof onGlobalSearch === 'function') {
            try { onGlobalSearch(value); } catch (e) {}
        }
        if (typeof onNavigate === 'function') {
            onNavigate(`/store/${storeId}/products?search=${encodeURIComponent(value)}`);
        }
    };

    const handleKeyDownSearch = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(i => Math.min(i + 1, suggestions.length - 1));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(i => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter') {
            if (highlightIndex >= 0 && suggestions[highlightIndex]) {
                const s = suggestions[highlightIndex];
                if (s.type === 'product') {
                    if (typeof onNavigate === 'function') onNavigate(`/store/${storeId}/product/${s.id}`);
                } else {
                    if (typeof onNavigate === 'function') onNavigate(`/store/${storeId}/plans`);
                }
                return;
            }
            triggerSearch(localSearch);
        }
    };

    // Debounced suggestions from available products and plans
    useEffect(() => {
        const t = setTimeout(() => {
            const q = (localSearch || '').trim().toLowerCase();
            if (!q) {
                setSuggestions([]);
                setHighlightIndex(-1);
                return;
            }
            const prodMatches = (products || [])
                .filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
                .slice(0, 6)
                .map(p => ({ type: 'product', id: p.id, title: p.name, subtitle: p.category }));
            const planMatches = (plans || [])
                .filter(pl => (pl.name || '').toLowerCase().includes(q) || (pl.description || '').toLowerCase().includes(q))
                .slice(0, 4)
                .map(pl => ({ type: 'plan', id: pl.id, title: pl.name, subtitle: `${formatCurrency(pl.min_amount || 0, store?.currency)}+` }));
            setSuggestions([...prodMatches, ...planMatches].slice(0, 8));
            setHighlightIndex(-1);
        }, 160);
        return () => clearTimeout(t);
    }, [localSearch, products, plans, store]);

    // Hero carousel data (memoized)
    const heroSlides = useMemo(() => {
        if (type !== 'hero') return [];
        if (Array.isArray(props.heroSlides) && props.heroSlides.length > 0) {
            return props.heroSlides
                .map(sl => ({
                    image: sl.image || sl,
                    category: sl.category || '',
                    title: sl.title || '',
                    subtitle: sl.subtitle || '',
                    titleColor: sl.titleColor || ''
                }))
                .filter(sl => sl.image);
        }
        const imgs = Array.isArray(props.heroImages) ? props.heroImages.filter(Boolean) : [];
        if (imgs.length > 0) return imgs.map(img => ({ image: img, category: '', title: '', subtitle: '', titleColor: '' }));
        if (props.backgroundImage) return [{ image: props.backgroundImage, category: '', title: '', subtitle: '', titleColor: '' }];
        return [];
    }, [type, props.heroSlides, props.heroImages, props.backgroundImage]);

    const useCarousel = type === 'hero' && props.heroCarousel && heroSlides.length > 1;
    const heroCategorySet = useMemo(() => new Set((categories || []).map((c) => (c || '').toLowerCase())), [categories]);
    const heroIntervalMs = useMemo(() => {
        const val = Number(props.heroInterval);
        if (!Number.isFinite(val)) return 4000;
        return Math.min(10000, Math.max(1500, val));
    }, [props.heroInterval]);

    const heroActiveSlide = useMemo(() => {
        if (type !== 'hero') return null;
        if (useCarousel) return heroSlides[heroIndex];
        if (heroSlides[0]) return heroSlides[0];
        if (props.backgroundImage) return { image: props.backgroundImage, category: '', title: '', subtitle: '', titleColor: '' };
        return null;
    }, [type, useCarousel, heroSlides, heroIndex, props.backgroundImage]);

    const heroActiveCategory = useMemo(
        () => (heroActiveSlide?.category || '').trim(),
        [heroActiveSlide]
    );

    const heroHasCategoryMatch = useMemo(
        () => heroActiveCategory && heroCategorySet.has(heroActiveCategory.toLowerCase()),
        [heroActiveCategory, heroCategorySet]
    );

    const handleHeroNavigate = useCallback(() => {
        if (type !== 'hero') return;
        if (heroHasCategoryMatch && typeof onNavigate === 'function') {
            onNavigate(`/store/${storeId}/category/${encodeURIComponent(heroActiveCategory)}`);
        }
    }, [type, heroHasCategoryMatch, heroActiveCategory, onNavigate, storeId]);

    useEffect(() => {
        if (!useCarousel) {
            setHeroIndex(0);
            return undefined;
        }
        setHeroIndex(0);
        const id = setInterval(() => {
            setHeroIndex((idx) => (idx + 1) % heroSlides.length);
        }, heroIntervalMs);
        return () => clearInterval(id);
    }, [useCarousel, heroSlides.length, heroIntervalMs]);

    // Helper to get stock for a product
    const getProductStock = (productId) => {
        if (!inventory) return 0;
        // If inventory stored as a map/object keyed by product_id
        if (!Array.isArray(inventory) && typeof inventory === 'object') {
            const inv = inventory[productId] || inventory[productId.toString()];
            if (inv) return Number(inv.quantity ?? 0);
            return 0;
        }
        // Array fallback with tolerant key matching
        const inv = inventory.find(i =>
            i.product_id === productId ||
            i.productId === productId ||
            (i.product && (i.product.id === productId || i.product._id === productId))
        );
        return inv ? Number(inv.quantity ?? 0) : 0;
    };

    // Helper to get full inventory entry (quantity + min_stock_level)
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

    // Build style object from props
    const getStyleFromProps = () => {
        const style = {};
        if (props.scale && props.scale !== 100) {
            style.transform = `scale(${props.scale / 100})`;
            style.transformOrigin = 'center';
        }
        if (props.opacity !== undefined && props.opacity !== 100) {
            style.opacity = props.opacity / 100;
        }
        if (props.padding) {
            style.padding = `${props.padding}px`;
        }
        if (props.margin) {
            style.margin = `${props.margin}px`;
        }
        if (props.backgroundColor && props.backgroundColor !== '#ffffff' && props.backgroundColor !== 'transparent') {
            style.backgroundColor = props.backgroundColor;
        }
        if (props.fontColor && props.fontColor !== '#000000') {
            style.color = props.fontColor;
        }
        if (props.borderRadius) {
            style.borderRadius = `${props.borderRadius}px`;
        }
        if (props.shadow && props.shadow !== 'none') {
            const shadows = {
                sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
            };
            style.boxShadow = shadows[props.shadow];
        }
        return style;
    };

    const wrapperStyle = getStyleFromProps();

    switch (type) {
        case 'header': {
            // Save header style and key display prefs to localStorage for other pages (e.g., product detail)
            if (typeof window !== 'undefined') {
                const headerData = {
                    style: wrapperStyle,
                    iconColor: props.iconColor,
                    showLogo: props.showLogo,
                    showTitle: props.showTitle,
                    logoUrl: props.logoUrl,
                    logoScale: props.logoScale,
                    title: props.title
                };
                localStorage.setItem(`header_style_${storeId}`, JSON.stringify(headerData));
            }

            const logoSource = props.logoUrl || store?.logo_url;
            const parsedScale = Number(props.logoScale);
            const logoScale = Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : 1;
            const logoHeight = 40 * logoScale;

            return (
                <header className="bg-primary text-primary-foreground sticky top-0 z-40" style={wrapperStyle}>
                    <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                        {/* Logo/Title */}
                        <Link to={`/store/${storeId}`} className="flex-shrink-0 flex items-center gap-3">
                            {props.showLogo !== false && logoSource && (
                                <img 
                                    src={logoSource} 
                                    alt={store?.name || 'Store logo'} 
                                    className="w-auto object-contain"
                                    style={{ height: `${logoHeight}px` }}
                                />
                            )}
                            {props.showTitle !== false && (
                                <h1 className="text-xl md:text-2xl font-serif hover:opacity-80 transition-opacity">
                                    {props.title || store?.name || 'Store'}
                                </h1>
                            )}
                        </Link>
                        
                        {/* Global Search Bar - Center (Desktop) */}
                        {props.showSearch !== false && (
                            <div className="hidden md:flex flex-1 max-w-md mx-4">
                                <div className="relative w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
                                    <Input
                                        placeholder="Search products & plans..."
                                        value={localSearch}
                                        onChange={(e) => { setLocalSearch(e.target.value); setHighlightIndex(-1); }}
                                        onKeyDown={handleKeyDownSearch}
                                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20"
                                    />
                                    <button
                                        aria-label="Search"
                                        onClick={() => triggerSearch(localSearch)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                                    >
                                        <Search className="w-4 h-4" />
                                    </button>
                                    {/* Suggestions dropdown */}
                                    {suggestions.length > 0 && (
                                        <div ref={suggestionsRef} className="absolute left-0 right-0 mt-1 bg-white/95 text-foreground border rounded shadow-lg z-50 max-h-64 overflow-auto">
                                            {suggestions.map((s, idx) => (
                                                <div
                                                    key={`${s.type}-${s.id}`}
                                                    role="button"
                                                    tabIndex={0}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        if (s.type === 'product') {
                                                            if (typeof onNavigate === 'function') onNavigate(`/store/${storeId}/product/${s.id}`);
                                                        } else {
                                                            if (typeof onNavigate === 'function') onNavigate(`/store/${storeId}/plans`);
                                                        }
                                                    }}
                                                    onMouseEnter={() => setHighlightIndex(idx)}
                                                    className={`px-3 py-2 cursor-pointer ${highlightIndex === idx ? 'bg-muted/80' : 'hover:bg-muted'}`}
                                                >
                                                    <div className="text-sm font-medium">{s.title}</div>
                                                    {s.subtitle && <div className="text-xs text-muted-foreground">{s.subtitle}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
            
                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex gap-6 items-center">
                            <Link to={`/store/${storeId}`} className="hover:opacity-80 cursor-pointer">Home</Link>
                            <Link to={`/store/${storeId}/products`} className="hover:opacity-80 cursor-pointer">Products</Link>
                            <Link to={`/store/${storeId}/plans`} className="hover:opacity-80 cursor-pointer">Plans</Link>
                            <Link to={`/store/${storeId}/contact`} className="hover:opacity-80 cursor-pointer">Contact</Link>
                        </nav>

                        {/* Right Actions */}
                        <div className="flex items-center gap-2">
                            {user ? (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-primary-foreground hover:bg-white/10"
                                    onClick={() => navigate(`/store/${storeId}/portal`)}
                                    style={props.iconColor ? { color: props.iconColor } : {}}
                                >
                                    <User className="w-4 h-4 md:mr-2" />
                                    <span className="hidden md:inline">Account</span>
                                </Button>
                            ) : (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-primary-foreground hover:bg-white/10"
                                    onClick={() => navigate(`/store/${storeId}/login`)}
                                    style={props.iconColor ? { color: props.iconColor } : {}}
                                >
                                    <LogIn className="w-4 h-4 md:mr-2" />
                                    <span className="hidden md:inline">Login</span>
                                </Button>
                            )}
                            
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-primary-foreground hover:bg-white/10 relative"
                                onClick={() => navigate(`/store/${storeId}/cart`)}
                                style={props.iconColor ? { color: props.iconColor } : {}}
                            >
                                <ShoppingCart className="w-4 h-4" />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-white text-xs rounded-full flex items-center justify-center">
                                        {cartCount}
                                    </span>
                                )}
                            </Button>

                            {/* Mobile Menu */}
                            <div className="md:hidden">
                                <button 
                                    onClick={() => setMobileMenuOpen(true)}
                                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 text-primary-foreground hover:bg-white/10"
                                    style={props.iconColor ? { color: props.iconColor } : {}}
                                >
                                    <Menu className="w-5 h-5" />
                                </button>
                                {mobileMenuOpen && (
                                    <>
                                        {/* Overlay */}
                                        <div 
                                            className="fixed inset-0 z-50 bg-black/80"
                                            onClick={() => setMobileMenuOpen(false)}
                                        />
                                        {/* Menu Panel */}
                                        <div className="fixed inset-y-0 right-0 z-50 w-[250px] bg-background p-6 shadow-lg text-foreground">
                                            <button 
                                                onClick={() => setMobileMenuOpen(false)}
                                                className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 text-foreground"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </button>
                                            <nav className="flex flex-col gap-4 mt-8">
                                                <Link to={`/store/${storeId}`} onClick={() => setMobileMenuOpen(false)} className="hover:opacity-80 transition-opacity block py-2 cursor-pointer text-foreground">
                                                    Home
                                                </Link>
                                                <Link to={`/store/${storeId}/products`} onClick={() => setMobileMenuOpen(false)} className="hover:opacity-80 transition-opacity block py-2 cursor-pointer text-foreground">
                                                    Products
                                                </Link>
                                                <Link to={`/store/${storeId}/plans`} onClick={() => setMobileMenuOpen(false)} className="hover:opacity-80 transition-opacity block py-2 cursor-pointer text-foreground">
                                                    Plans
                                                </Link>
                                                <Link to={`/store/${storeId}/contact`} onClick={() => setMobileMenuOpen(false)} className="hover:opacity-80 transition-opacity block py-2 cursor-pointer text-foreground">
                                                    Contact
                                                </Link>
                                            </nav>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Mobile Search */}
                    {props.showSearch !== false && (
                        <div className="md:hidden px-4 pb-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search products & plans..."
                                    value={localSearch}
                                    onChange={(e) => { setLocalSearch(e.target.value); setHighlightIndex(-1); }}
                                    onKeyDown={handleKeyDownSearch}
                                    className="pl-10 bg-background text-foreground border-input placeholder:text-muted-foreground"
                                />
                                <button
                                    aria-label="Search"
                                    onClick={() => triggerSearch(localSearch)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <Search className="w-4 h-4" />
                                </button>
                                {/* Mobile Suggestions dropdown */}
                                {suggestions.length > 0 && (
                                    <div ref={suggestionsRef} className="absolute left-0 right-0 mt-1 bg-background text-foreground border rounded shadow-lg z-50 max-h-64 overflow-auto">
                                        {suggestions.map((s, idx) => (
                                            <div
                                                key={`${s.type}-${s.id}-mobile`}
                                                role="button"
                                                tabIndex={0}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    if (s.type === 'product') {
                                                        if (typeof onNavigate === 'function') onNavigate(`/store/${storeId}/product/${s.id}`);
                                                    } else {
                                                        if (typeof onNavigate === 'function') onNavigate(`/store/${storeId}/plans`);
                                                    }
                                                }}
                                                onMouseEnter={() => setHighlightIndex(idx)}
                                                className={`px-3 py-2 cursor-pointer ${highlightIndex === idx ? 'bg-muted/80' : 'hover:bg-muted'}`}
                                            >
                                                <div className="text-sm font-medium">{s.title}</div>
                                                {s.subtitle && <div className="text-xs text-muted-foreground">{s.subtitle}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </header>
            );
        }
        case 'footer':
            // Save footer style to localStorage for other pages
            if (typeof window !== 'undefined' && Object.keys(wrapperStyle).length > 0) {
                localStorage.setItem(`footer_style_${storeId}`, JSON.stringify(wrapperStyle));
            }
            return (
                <footer className="bg-primary text-primary-foreground py-12" style={wrapperStyle}>
                    <div className="max-w-7xl mx-auto px-4 text-center">
                        <h2 className="text-2xl font-serif mb-4">{store?.name}</h2>
                        {store?.address && <p className="text-sm opacity-80 mb-2">{store.address}</p>}
                        {store?.contact_email && <p className="text-sm opacity-80">{store.contact_email}</p>}
                        <p className="mt-8 text-sm opacity-60">{props.text || `© 2025 ${store?.name}. All rights reserved.`}</p>
                    </div>
                </footer>
            );
        case 'hero':
            {
                const activeImage = heroActiveSlide?.image;
                const activeCategory = heroActiveCategory;
                const hasCategoryMatch = heroHasCategoryMatch;

                return (
                    <div 
                        className={`relative h-96 bg-cover bg-center flex items-center justify-center overflow-hidden ${hasCategoryMatch ? 'cursor-pointer' : ''}`}
                        onClick={handleHeroNavigate}
                        style={{ 
                            backgroundImage: activeImage ? `url(${activeImage})` : 'linear-gradient(135deg, #D4AF37 0%, #F2D06B 50%, #B5942F 100%)',
                            ...wrapperStyle 
                        }}
                    >
                        {useCarousel && (
                            <>
                                <div className="absolute inset-0">
                                    {heroSlides.map((slide, idx) => (
                                        <div
                                            key={idx}
                                            className="absolute inset-0 transition-opacity duration-700"
                                            style={{
                                                backgroundImage: `url(${slide.image})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                opacity: idx === heroIndex ? 1 : 0,
                                            }}
                                        />
                                    ))}
                                </div>
                                {props.heroArrows !== false && (
                                    <div className="absolute inset-0 flex items-center justify-between px-4 md:px-8 z-10">
                                        <button
                                            aria-label="Previous slide"
                                            onClick={(e) => { e.stopPropagation(); setHeroIndex((idx) => (idx - 1 + heroSlides.length) % heroSlides.length); }}
                                            className="h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                                        >
                                            <span className="sr-only">Previous</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <button
                                            aria-label="Next slide"
                                            onClick={(e) => { e.stopPropagation(); setHeroIndex((idx) => (idx + 1) % heroSlides.length); }}
                                            className="h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                                        >
                                            <span className="sr-only">Next</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                                {props.heroDots !== false && heroSlides.length > 1 && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                                        {heroSlides.map((_, idx) => (
                                            <button
                                                key={idx}
                                                aria-label={`Go to slide ${idx + 1}`}
                                                onClick={(e) => { e.stopPropagation(); setHeroIndex(idx); }}
                                                className={`h-2.5 w-2.5 rounded-full transition ${idx === heroIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/80'}`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        {/* No shadow overlay on carousel images */}
                        {!useCarousel && <div className="absolute inset-0 bg-black/40" />}
                        <div className="relative text-center text-white px-4">
                            {(() => {
                                const slideTitle = (heroActiveSlide?.title || '').trim();
                                const style = (heroActiveSlide?.titleColor || '').trim() ? { color: heroActiveSlide.titleColor } : undefined;
                                if (slideTitle) {
                                    return <h1 className="text-4xl md:text-6xl font-serif mb-4" style={style}>{slideTitle}</h1>;
                                }
                                if (props.showHeroTitle !== false) {
                                    return <h1 className="text-4xl md:text-6xl font-serif mb-4" style={style}>{props.title || `Welcome to ${store?.name}`}</h1>;
                                }
                                return null;
                            })()}
                            {(() => {
                                const slideSubtitle = (heroActiveSlide?.subtitle || '').trim();
                                if (slideSubtitle) {
                                    return <p className="text-lg md:text-xl mb-6">{slideSubtitle}</p>;
                                }
                                if (props.showHeroSubtitle !== false) {
                                    return <p className="text-lg md:text-xl mb-6">{props.subtitle || 'Discover exquisite jewelry'}</p>;
                                }
                                return null;
                            })()}
                            {props.buttonText && (
                                <Button
                                    className="gold-gradient text-white"
                                    onClick={() => {
                                        if (hasCategoryMatch && typeof onNavigate === 'function') {
                                            onNavigate(`/store/${storeId}/category/${encodeURIComponent(activeCategory)}`);
                                        }
                                    }}
                                >
                                    {hasCategoryMatch ? `Shop ${activeCategory}` : props.buttonText}
                                </Button>
                            )}
                            {!props.buttonText && hasCategoryMatch && (
                                <Button
                                    variant="outline"
                                    className="mt-4 border-white/60 text-white hover:bg-white/10"
                                    onClick={() => {
                                        if (typeof onNavigate === 'function') {
                                            onNavigate(`/store/${storeId}/category/${encodeURIComponent(activeCategory)}`);
                                        }
                                    }}
                                >
                                    Explore {activeCategory}
                                </Button>
                            )}
                        </div>
                    </div>
                );
            }
        case 'text':
            return (
                <div className="py-12 px-4" style={wrapperStyle}>
                    <div className="max-w-4xl mx-auto text-center">
                        {props.title && <h2 className="text-3xl font-serif mb-4">{props.title}</h2>}
                        <p className="text-muted-foreground">{props.content || 'Add your text content here...'}</p>
                    </div>
                </div>
            );
        case 'grid':
            return (
                <div className={`grid gap-4 p-4`} style={{ gridTemplateColumns: `repeat(${props.columns || 3}, 1fr)`, ...wrapperStyle }}>
                    {Array(props.columns || 3).fill(0).map((_, i) => (
                        <div key={i} className="bg-muted h-32 rounded-lg flex items-center justify-center text-muted-foreground">
                            Column {i + 1}
                        </div>
                    ))}
                </div>
            );
        case 'card':
            return (
                <div className="py-8 px-4" style={wrapperStyle}>
                    <Card className="max-w-sm mx-auto luxury-card">
                        <CardHeader>
                            <CardTitle className="font-serif">{props.title || 'Card Title'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">{props.content || 'Card content goes here...'}</p>
                        </CardContent>
                    </Card>
                </div>
            );
        case 'divider':
            return <div style={{ height: `${props.height || 32}px`, ...wrapperStyle }} />;
        case 'products':
            {
                const productLimit = Math.min(props.limit || 8, 100);
                // Start from server-filtered list or full products
                let productSource = filteredProducts || products;
                // If a global search term is provided (from header), apply it here as well
                if (globalSearchTerm) {
                    const q = globalSearchTerm.toLowerCase();
                    productSource = (productSource || []).filter(p =>
                        p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
                    );
                }
                if (props.featuredOnly) productSource = productSource.filter(p => p.featured);
                const displayProducts = (productSource || []).slice(0, productLimit);

                // Also filter plans when a global search exists so the landing page shows plan matches
                let planMatches = [];
                if (globalSearchTerm && Array.isArray(plans)) {
                    const q = globalSearchTerm.toLowerCase();
                    planMatches = plans.filter(pl => pl.is_active !== false && (pl.name.toLowerCase().includes(q) || (pl.description && pl.description.toLowerCase().includes(q))));
                }

                return (
                    <section className="py-16 px-4" style={wrapperStyle}>
                        <div className="max-w-7xl mx-auto">
                            <h2 className="text-4xl font-serif text-center mb-8">{props.title || 'Our Collection'}</h2>

                            {planMatches.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-2xl font-serif mb-4">Subscription Plans</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                        {planMatches.map(plan => (
                                            <Card key={plan.id} className="luxury-card">
                                                <CardContent className="p-4">
                                                    <h3 className="font-serif font-semibold text-lg">{plan.name}</h3>
                                                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{plan.description}</p>
                                                    <div className="flex items-center justify-between mt-4">
                                                        <div className="text-gold font-semibold">{formatCurrency(plan.min_amount || 0, store?.currency)}+</div>
                                                        <button onClick={() => {
                                                            const target = `/store/${storeId}/plans`;
                                                            if (typeof onNavigate === 'function') onNavigate(target);
                                                        }} className="gold-gradient text-white px-3 py-1 rounded">View Plans</button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {displayProducts.map((product) => {
                                    const inv = getInventoryEntry(product.id);
                                    const stock = inv.quantity;
                                    const minLevel = inv.min_stock_level;
                                    const isOutOfStock = stock <= 0;
                                    const isLowStock = stock > 0 && (stock < 10 || (minLevel > 0 && stock <= minLevel));

                                    const handleCardClick = (e) => {
                                        const target = `/store/${storeId}/product/${product.id}`;
                                        try {
                                            if (typeof onNavigate === 'function') {
                                                onNavigate(target);
                                                return;
                                            }
                                        } catch (e) {}
                                    };

                                    return (
                                        <div key={product.id} onClick={handleCardClick}>
                                            <Card className={`luxury-card overflow-hidden group cursor-pointer ${isOutOfStock ? 'opacity-70' : ''}`} data-testid={`product-card-${product.id}`}>
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
                                                    {product.category && (
                                                        <Badge variant="outline" className="text-xs mt-1">{product.category}</Badge>
                                                    )}
                                                    {product.weight && (
                                                        <p className="text-sm text-muted-foreground">{product.weight}g</p>
                                                    )}
                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className="gold-text text-xl font-semibold">
                                                            {formatCurrency(product.price, store?.currency)}
                                                        </span>
                                                        <Button
                                                            size="sm"
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isOutOfStock) addToCart(product); }}
                                                            className={isOutOfStock ? 'bg-gray-400 cursor-not-allowed' : 'gold-gradient text-white'}
                                                            disabled={isOutOfStock}
                                                            data-testid={`add-to-cart-${product.id}`}
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    );
                                })}
                                {displayProducts.length === 0 && (
                                    <div className="col-span-full text-center py-12 text-muted-foreground">
                                        {searchTerm || selectedCategory ? 'No products match your search.' : 'No products available yet.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                );
            }
        case 'scrolling_text':
            return (
                <div className="bg-gold text-white py-3 overflow-hidden" style={wrapperStyle}>
                    <div className="scrolling-text-container">
                        <div className="scrolling-text">
                            <span>{props.text || 'Welcome to our store! Check out our latest collection and exclusive offers.'}</span>
                            <span>{props.text || 'Welcome to our store! Check out our latest collection and exclusive offers.'}</span>
                        </div>
                    </div>
                </div>
            );
        case 'subscription_plans':
            return (
                <section className="py-16 px-4 bg-muted/30" style={wrapperStyle}>
                    <div className="max-w-5xl mx-auto">
                        <h2 className="text-4xl font-serif text-center mb-4">{props.title || 'Gold Savings Plans'}</h2>
                        <p className="text-center text-muted-foreground mb-12">
                            Start your gold savings journey with our flexible plans
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plans.map((plan) => (
                                <Card key={plan.id} className="luxury-card" data-testid={`plan-card-${plan.id}`}>
                                    <CardHeader>
                                        <Badge className="w-fit gold-gradient text-white">
                                            {plan.plan_type}
                                        </Badge>
                                        <CardTitle className="font-serif text-2xl mt-2">{plan.name}</CardTitle>
                                        <CardDescription>{plan.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-serif gold-text mb-1">
                                            {formatCurrency(plan.min_amount || 500, store?.currency)} - {formatCurrency(plan.max_amount || 100000, store?.currency)}
                                            <span className="text-base text-muted-foreground">/month</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            {plan.duration_months} months • {plan.bonus_percentage}% bonus
                                        </p>
                                        <ul className="space-y-2 mb-6">
                                            <li className="flex items-center text-sm">
                                                <span className="w-2 h-2 bg-gold rounded-full mr-2" />
                                            Lock gold weight at today&apos;s rate
                                            </li>
                                            <li className="flex items-center text-sm">
                                                <span className="w-2 h-2 bg-gold rounded-full mr-2" />
                                                Zero making charges up to {plan.bonus_percentage}%
                                            </li>
                                            <li className="flex items-center text-sm">
                                                <span className="w-2 h-2 bg-gold rounded-full mr-2" />
                                                Choose your own monthly amount
                                            </li>
                                        </ul>
                                        <Button
                                            className="w-full gold-gradient text-white"
                                            onClick={() => onSubscribe(plan)}
                                            disabled={!user}
                                            data-testid={`subscribe-btn-${plan.id}`}
                                        >
                                            {user ? 'Subscribe Now' : 'Login to Subscribe'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                            {plans.length === 0 && (
                                <div className="col-span-full text-center py-12 text-muted-foreground">
                                    No subscription plans available.
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            );
        case 'menu':
            // Only show categories that exist in products
            const productCategories = categories && categories.length > 0 ? categories : [];
            return (
                <nav className="bg-card border-y py-3" style={wrapperStyle}>
                    <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-4 md:gap-8 px-4">
                        {productCategories.length > 0 ? (
                            productCategories.map((cat, i) => (
                                <Link 
                                    key={i}
                                    to={`/store/${storeId}/category/${encodeURIComponent(cat)}`}
                                    className="hover:text-gold cursor-pointer transition-colors text-sm md:text-base"
                                >
                                    {cat}
                                </Link>
                            ))
                        ) : (
                            <span className="text-muted-foreground text-sm">No categories available</span>
                        )}
                    </div>
                </nav>
            );
        case 'search_bar':
            return (
                <div className="py-6 px-4" style={wrapperStyle}>
                    <div className="max-w-md mx-auto">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder={props.placeholder || "Search products..."}
                                value={searchTerm || ''}
                                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
                            />
                        </div>
                    </div>
                </div>
            );
        case 'map_link':
            // Don't render if explicitly hidden from home page
            if (props.visible_home === false) return null;
            
            return (
                <div className="py-8 px-4" style={wrapperStyle}>
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-3xl font-serif mb-2">{props.title || 'Find Us on Google Maps'}</h2>
                        {props.subtitle && (
                            <p className="text-muted-foreground mb-4">{props.subtitle}</p>
                        )}
                        {props.embed_url ? (
                            <div className="rounded-lg overflow-hidden border">
                                <iframe
                                    src={props.embed_url}
                                    width="100%"
                                    height={props.height || 360}
                                    style={{ border: 0 }}
                                    allowFullScreen=""
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    title="Google Maps"
                                ></iframe>
                            </div>
                        ) : props.map_url ? (
                            <a
                                href={props.map_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 gold-gradient text-white px-4 py-2 rounded"
                            >
                                <MapPin className="w-4 h-4" />
                                Open in Google Maps
                            </a>
                        ) : (
                            <p className="text-sm text-muted-foreground">Set a Google Maps embed URL in Properties</p>
                        )}
                    </div>
                </div>
            );
        default:
            return null;
    }
};

const StoreFront = () => {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [plans, setPlans] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [pageConfig, setPageConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const { cart, setCart, loadCart, addToCart: contextAddToCart, updateQuantityLocal, removeFromCart: removeFromCartLocal, cartCount, cartTotal } = useCart(storeId);
    const [subscribeOpen, setSubscribeOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [chosenMonthlyAmount, setChosenMonthlyAmount] = useState('');
    const [processingPayment, setProcessingPayment] = useState(false);
    
    // Search and filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');
    const location = useLocation();
    
    // Recently viewed plans (for Plans page)
    const [recentlyViewedPlans, setRecentlyViewedPlans] = useState([]);
    
    // Derive unique categories from products
    const categories = [...new Set(products.filter(p => p.category).map(p => p.category))];
    
    // Filter products based on search and category
    const filteredProducts = products.filter(product => {
        const matchesSearch = !searchTerm || 
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = !selectedCategory || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    
    // Helper to get full inventory entry (quantity + min_stock_level)
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

    // Helper to get numeric stock for a product
    const getProductStock = (productId) => getInventoryEntry(productId).quantity;

    // Define loadData before effects to avoid temporal dead zone issues
    const loadData = useCallback(async () => {
        try {
            const [storeRes, productsRes, plansRes, inventoryRes] = await Promise.all([
                getStore(storeId),
                getProducts(storeId),
                getSubscriptionPlans(storeId),
                getInventory(storeId).catch(() => ({ data: [] }))
            ]);
            setStore(storeRes.data);
            setPageTitle(storeRes.data, 'Home');
            setProducts(productsRes.data);
            setPlans(plansRes.data);
            setInventory(inventoryRes.data || []);
            
            // Save last visited store for CustomerPortal navigation
            localStorage.setItem('lastVisitedStore', storeId);

            try {
                const configRes = await getPageConfig(storeId, 'home');
                if (configRes.data && configRes.data.components && configRes.data.components.length > 0) {
                    setPageConfig(configRes.data);

                    // If any products component requests featured-only, re-fetch products with server-side filter and capped limit
                    try {
                        const productComps = (configRes.data.components || []).filter(c => c.type === 'products' && c.props && c.props.featuredOnly);
                        if (productComps.length > 0) {
                            const maxLimit = Math.min(100, Math.max(...productComps.map(c => (c.props?.limit || 8))));
                            const featuredRes = await getProducts(storeId, null, true, true, maxLimit).catch(() => ({ data: [] }));
                            setProducts(featuredRes.data || []);
                        }
                    } catch (e) {
                        // ignore and continue with already fetched products
                    }
                }
            } catch (e) {
                // No page config yet, will use default layout
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load store');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Load cart from backend on mount or storeId change
    useEffect(() => {
        if (storeId) {
            loadCart(storeId);
        }
    }, [storeId, loadCart]);

    // Set document title to store name
    useEffect(() => {
        if (store?.name) {
            document.title = store.name;
        }
        return () => {
            document.title = 'Store';
        };
    }, [store?.name]);

    // Load Razorpay script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => {
            try { document.body.removeChild(script); } catch {}
        };
    }, []);

    // Previously handled checkout modal via URL params; now checkout lives inline on CartPage.
    // Keep global search state in sync with the URL (react when query param changes)
    useEffect(() => {
        try {
            const params = new URLSearchParams(location.search || window.location.search);
            const s = params.get('search') || '';
            setGlobalSearchTerm(s);
            setSearchTerm(s);
        } catch (e) {}
    }, [location.search]);
    
    useEffect(() => {
        // Load recently viewed plans from localStorage
        const recentKey = `recent_plans_${storeId}`;
        const recentIds = JSON.parse(localStorage.getItem(recentKey) || '[]');
        const recentPlansList = recentIds.map(id => plans.find(p => p.id === id)).filter(Boolean);
        setRecentlyViewedPlans(recentPlansList);
    }, [plans, storeId]);

    // (loadData defined earlier)

    const addToCart = async (product) => {
        // Check inventory before adding to cart
        const stock = getProductStock(product.id);
        if (stock <= 0) {
            toast.error(`${product.name} is out of stock`);
            return;
        }

        const cartItems = cart.items || [];
        const existing = cartItems.find(item => item.product_id === product.id);
        const currentQtyInCart = existing ? existing.quantity : 0;

        if (currentQtyInCart + 1 > stock) {
            toast.error(`Only ${stock} items available in stock`);
            return;
        }

        // Delegate persistence and updates to CartContext
        await contextAddToCart(product, 1);
        toast.success(`${product.name} added to cart`);
    };

    const updateQuantity = (productId, delta) => {
        const stock = getProductStock(productId);
        const items = cart.items || [];
        const item = items.find(it => it.product_id === productId);
        if (item) {
            const newQty = item.quantity + delta;
            if (newQty > stock && delta > 0) {
                toast.error(`Only ${stock} items available in stock`);
                return;
            }
            if (newQty > 0) {
                updateQuantityLocal(productId, delta);
            } else {
                removeFromCartLocal(productId);
            }
        }
    };

    const removeFromCart = (productId) => {
        removeFromCartLocal(productId);
    };

    // cartCount and cartTotal provided by CartContext

    const handleSubscribe = async () => {
        if (!selectedPlan) return;

        const amount = parseFloat(chosenMonthlyAmount);
        const minAmount = selectedPlan.min_amount || 500;
        const maxAmount = selectedPlan.max_amount || 100000;

        if (!amount || amount < minAmount || amount > maxAmount) {
            toast.error(`Please enter an amount between ₹${minAmount} and ₹${maxAmount}`);
            return;
        }

        if (!store || !store.razorpay_key_id) {
            toast.error('Payment gateway not configured for this store');
            return;
        }

        setProcessingPayment(true);

        try {
            const subRes = await subscribeToPlan(storeId, {
                plan_id: selectedPlan.id,
                monthly_amount: amount
            });

            const paymentRes = await createPaymentOrder({
                amount: amount,
                currency: store.currency || 'INR',
                description: `${selectedPlan.name} - First Installment`,
                store_id: storeId,
                subscription_id: subRes.data.id
            });

            // Open Razorpay checkout
            const options = {
                key: store.razorpay_key_id,
                amount: Math.round(amount * 100), // Amount in paise
                currency: store.currency || 'INR',
                name: store.name || 'Store',
                description: `${selectedPlan.name} - First Installment`,
                order_id: paymentRes.data.razorpay_order_id,
                handler: async function (response) {
                    try {
                        await verifyPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            payment_id: paymentRes.data.id,
                        });
                        toast.success('Subscribed successfully! First payment completed.');
                        setSubscribeOpen(false);
                        setSelectedPlan(null);
                        setChosenMonthlyAmount('');
                        navigate(`/store/${storeId}/portal?tab=subscriptions`);
                    } catch (error) {
                        toast.error('Payment verification failed');
                    } finally {
                        setProcessingPayment(false);
                    }
                },
                prefill: {
                    name: user.name,
                    email: user.email,
                },
                theme: {
                    color: '#D4AF37',
                },
                modal: {
                    ondismiss: function() {
                        setProcessingPayment(false);
                        toast.error('Payment cancelled');
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            setProcessingPayment(false);
            toast.error(error.response?.data?.detail || 'Subscription failed');
        }
    };

    const openSubscribeDialog = (plan) => {
        setSelectedPlan(plan);
        setChosenMonthlyAmount(plan.min_amount?.toString() || '500');
        setSubscribeOpen(true);
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
                <Card>
                    <CardContent className="p-8 text-center">
                        <h2 className="text-xl font-serif mb-2">Store Not Found</h2>
                        <Link to="/">
                            <Button>Go Home</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Check if we have a page config with components
    const hasPageConfig = pageConfig && pageConfig.components && pageConfig.components.length > 0;

    return (
        <div className="min-h-screen bg-background">
            {/* Render page config components if available, otherwise show default layout */}
            {hasPageConfig ? (
                <>
                    {pageConfig.components
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((component, index) => (
                            <DynamicComponent
                                key={component.id || index}
                                component={component}
                                products={products}
                                filteredProducts={filteredProducts}
                                plans={plans}
                                store={store}
                                addToCart={addToCart}
                                onSubscribe={openSubscribeDialog}
                                user={user}
                                categories={categories}
                                selectedCategory={selectedCategory}
                                onCategorySelect={setSelectedCategory}
                                searchTerm={searchTerm}
                                onSearchChange={setSearchTerm}
                                storeId={storeId}
                                inventory={inventory}
                                globalSearchTerm={globalSearchTerm}
                                onGlobalSearch={setGlobalSearchTerm}
                                onNavigate={navigate}
                                recentlyViewedPlans={recentlyViewedPlans}
                            />
                        ))}
                </>
            ) : (
                <>
                    {/* Default Layout when no page config */}
                    <header className="bg-primary text-primary-foreground sticky top-0 z-40">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                            <h1 className="text-2xl font-serif">{store.name}</h1>
                            <nav className="hidden md:flex gap-6">
                                <Link to={`/store/${storeId}`} className="hover:opacity-80 cursor-pointer">Home</Link>
                                <Link to={`/store/${storeId}/products`} className="hover:opacity-80 cursor-pointer">Products</Link>
                                <Link to={`/store/${storeId}/plans`} className="hover:opacity-80 cursor-pointer">Plans</Link>
                                <Link to={`/store/${storeId}/contact`} className="hover:opacity-80 cursor-pointer">Contact</Link>
                            </nav>
                        </div>
                    </header>

                    {/* Hero Section */}
                    <section className="relative h-96 bg-cover bg-center flex items-center justify-center gold-gradient">
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="relative text-center text-white px-4">
                            <h1 className="text-4xl md:text-6xl font-serif mb-4">Welcome to {store.name}</h1>
                            <p className="text-lg md:text-xl mb-6">Discover exquisite gold jewelry and savings plans</p>
                            <Button className="bg-white text-primary hover:bg-white/90" data-testid="shop-now-btn">
                                Shop Now
                            </Button>
                        </div>
                    </section>

                    {/* Products Section */}
                    <section className="py-16 px-4">
                        <div className="max-w-7xl mx-auto">
                            <h2 className="text-4xl font-serif text-center mb-8">Our Collection</h2>
                            
                            {/* Category Filter */}
                            {categories.length > 0 && (
                                <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mb-8">
                                    <span 
                                        className={`hover:text-gold cursor-pointer transition-colors text-sm md:text-base ${!selectedCategory ? 'text-gold font-semibold' : ''}`}
                                        onClick={() => setSelectedCategory('')}
                                    >
                                        All
                                    </span>
                                    {categories.map((cat, i) => (
                                        <span 
                                            key={i} 
                                            className={`hover:text-gold cursor-pointer transition-colors text-sm md:text-base ${cat === selectedCategory ? 'text-gold font-semibold' : ''}`}
                                            onClick={() => setSelectedCategory(cat)}
                                        >
                                            {cat}
                                        </span>
                                    ))}
                                </nav>
                            )}
                            
                            {/* Search Bar */}
                            <div className="max-w-md mx-auto mb-8">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search products..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {filteredProducts.map((product) => {
                                    const inv = getInventoryEntry(product.id);
                                    const stock = inv.quantity;
                                    const minLevel = inv.min_stock_level;
                                    const isOutOfStock = stock <= 0;
                                    const isLowStock = stock > 0 && (stock < 10 || (minLevel > 0 && stock <= minLevel));

                                    return (
                                        <Link key={product.id} to={`/store/${storeId}/product/${product.id}`}>
                                            <Card className={`luxury-card overflow-hidden group cursor-pointer ${isOutOfStock ? 'opacity-70' : ''}`} data-testid={`product-card-${product.id}`}>
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
                                                    {product.category && (
                                                        <Badge variant="outline" className="text-xs mt-1">{product.category}</Badge>
                                                    )}
                                                    {product.weight && (
                                                        <p className="text-sm text-muted-foreground">{product.weight}g</p>
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
                                                            data-testid={`add-to-cart-${product.id}`}
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    );
                                })}
                                {filteredProducts.length === 0 && (
                                    <div className="col-span-full text-center py-12 text-muted-foreground">
                                        {searchTerm || selectedCategory ? 'No products match your search.' : 'No products available yet.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Subscription Plans Section */}
                    {plans.length > 0 && (
                        <section className="py-16 px-4 bg-muted/30">
                            <div className="max-w-5xl mx-auto">
                                <h2 className="text-4xl font-serif text-center mb-4">Gold Savings Plans</h2>
                                <p className="text-center text-muted-foreground mb-12">
                                    Start your gold savings journey with our flexible plans
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {plans.map((plan) => (
                                        <Card key={plan.id} className="luxury-card" data-testid={`plan-card-${plan.id}`}>
                                            <CardHeader>
                                                <Badge className="w-fit gold-gradient text-white">
                                                    {plan.plan_type === 'gold_flexi' ? 'Gold Flexi' : 'Silver Flexi'}
                                                </Badge>
                                                <CardTitle className="font-serif text-2xl mt-2">{plan.name}</CardTitle>
                                                <CardDescription>{plan.description}</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-4xl font-serif gold-text mb-1">
                                                    {formatCurrency(plan.monthly_amount, store.currency)}
                                                    <span className="text-base text-muted-foreground">/month</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {plan.duration_months} months • {plan.bonus_percentage}% bonus
                                                </p>
                                                <Button
                                                    className="w-full gold-gradient text-white"
                                                    onClick={() => openSubscribeDialog(plan)}
                                                    disabled={!user}
                                                    data-testid={`subscribe-btn-${plan.id}`}
                                                >
                                                    {user ? 'Subscribe Now' : 'Login to Subscribe'}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Footer */}
                    <footer className="bg-primary text-primary-foreground py-12">
                        <div className="max-w-7xl mx-auto px-4 text-center">
                            <h2 className="text-2xl font-serif mb-4">{store.name}</h2>
                            {store.address && <p className="text-sm opacity-80 mb-2">{store.address}</p>}
                            {store.contact_email && <p className="text-sm opacity-80">{store.contact_email}</p>}
                            <p className="mt-8 text-sm opacity-60">© 2025 {store.name}. All rights reserved.</p>
                        </div>
                    </footer>
                </>
            )}

            {/* Cart Drawer is rendered globally via CartDrawer component */}

            {/* Subscribe Dialog */}
            <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Subscribe to {selectedPlan?.name}</DialogTitle>
                        <DialogDescription>Choose your monthly investment amount</DialogDescription>
                    </DialogHeader>
                    {selectedPlan && (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg">
                                <div className="flex justify-between mb-2">
                                    <span>Plan Type</span>
                                    <span className="font-semibold">{selectedPlan.plan_type}</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span>Duration</span>
                                    <span>{selectedPlan.duration_months} months</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span>Amount Range</span>
                                    <span>{formatCurrency(selectedPlan.min_amount || 500, store.currency)} - {formatCurrency(selectedPlan.max_amount || 100000, store.currency)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Bonus</span>
                                    <span className="gold-text font-semibold">{selectedPlan.bonus_percentage}%</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Your Monthly Amount (₹)</Label>
                                <Input
                                    type="number"
                                    value={chosenMonthlyAmount}
                                    onChange={(e) => setChosenMonthlyAmount(e.target.value)}
                                    placeholder={`Min: ${selectedPlan.min_amount || 500}, Max: ${selectedPlan.max_amount || 100000}`}
                                    min={selectedPlan.min_amount || 500}
                                    max={selectedPlan.max_amount || 100000}
                                    data-testid="subscription-amount-input"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Choose any amount between ₹{selectedPlan.min_amount || 500} and ₹{selectedPlan.max_amount || 100000}
                                </p>
                            </div>

                            <Button
                                className="w-full gold-gradient text-white"
                                onClick={handleSubscribe}
                                disabled={processingPayment}
                                data-testid="confirm-subscribe-btn"
                            >
                                {processingPayment ? 'Processing...' : `Subscribe & Pay ${formatCurrency(parseFloat(chosenMonthlyAmount) || 0, store.currency)}`}
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                                Secure payment powered by Razorpay
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StoreFront;
