import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ShoppingCart, User, LogIn, Search, Menu } from 'lucide-react';
import { useCartContext } from '../context/CartContext';

const StoreHeader = ({ 
    store, 
    storeId, 
    cartTotal = 0, 
    activeTab = '', 
    showSearch = true,
    searchTerm = undefined,
    onSearchChange = undefined,
    style = {},
    iconColor = undefined,
    showLogo: overrideShowLogo,
    showTitle: overrideShowTitle,
    logoUrl: overrideLogoUrl,
    logoScale: overrideLogoScale,
    title: overrideTitle
}) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { setCartOpen } = useCartContext();
    const [localSearch, setLocalSearch] = useState(searchTerm || '');
    
    // Get stored header style from localStorage (set by StoreFront from Page Editor config)
    const [headerStyle, setHeaderStyle] = useState(style);
    const [storedIconColor, setStoredIconColor] = useState(iconColor);
    const [logoConfig, setLogoConfig] = useState({
        showLogo: true,
        showTitle: true,
        logoUrl: undefined,
        logoScale: 1,
        title: undefined
    });
    
    useEffect(() => {
        if (Object.keys(style).length === 0 && !iconColor) {
            const storedData = localStorage.getItem(`header_style_${storeId}`);
            if (storedData) {
                try {
                    const parsed = JSON.parse(storedData);
                    // Handle both old format (direct style object) and new format (with style and iconColor)
                    if (parsed.style) {
                        setHeaderStyle(parsed.style);
                        setStoredIconColor(parsed.iconColor);
                        setLogoConfig({
                            showLogo: parsed.showLogo !== false,
                            showTitle: parsed.showTitle !== false,
                            logoUrl: parsed.logoUrl,
                            logoScale: parsed.logoScale,
                            title: parsed.title
                        });
                    } else {
                        setHeaderStyle(parsed);
                    }
                } catch (e) {}
            }
        } else {
            // Store the style for other pages to use
            const headerData = {
                style: style,
                iconColor: iconColor,
                showLogo: overrideShowLogo,
                showTitle: overrideShowTitle,
                logoUrl: overrideLogoUrl,
                logoScale: overrideLogoScale,
                title: overrideTitle
            };
            localStorage.setItem(`header_style_${storeId}`, JSON.stringify(headerData));
            setHeaderStyle(style);
            setStoredIconColor(iconColor);
            setLogoConfig({
                showLogo: overrideShowLogo !== false,
                showTitle: overrideShowTitle !== false,
                logoUrl: overrideLogoUrl,
                logoScale: overrideLogoScale,
                title: overrideTitle
            });
        }
    }, [storeId, style, iconColor]);

    useEffect(() => {
        // keep localSearch in sync when parent provides a controlled searchTerm
        if (typeof searchTerm === 'string') setLocalSearch(searchTerm);
    }, [searchTerm]);

    const triggerSearch = (value) => {
        if (typeof onSearchChange === 'function') {
            try { onSearchChange(value); } catch (e) {}
        } else {
            // client-side navigate to products page with query param
            navigate(`/store/${storeId}/products?search=${encodeURIComponent(value)}`);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            triggerSearch(localSearch);
        }
    };

    const navItems = [
        { label: 'Home', path: `/store/${storeId}`, key: 'home' },
        { label: 'Products', path: `/store/${storeId}/products`, key: 'products' },
        { label: 'Plans', path: `/store/${storeId}/plans`, key: 'plans' },
        { label: 'Contact', path: `/store/${storeId}/contact`, key: 'contact' },
    ];

    const handleNavClick = (path, e) => {
        if (e) e.preventDefault();
        setMobileMenuOpen(false);
        // Debug log to check if storeId is available
        if (!storeId && path.includes('/store/')) {
            console.warn('[StoreHeader] storeId is undefined, cannot navigate to:', path);
        }
        navigate(path);
    };

    const logoSource = (overrideLogoUrl || logoConfig.logoUrl || store?.logo_url);
    const parsedScale = Number(overrideLogoScale ?? logoConfig.logoScale);
    const logoScale = Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : 1;
    const logoHeight = 40 * logoScale;

    return (
        <header className="bg-primary text-primary-foreground sticky top-0 z-50" style={headerStyle}>
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                {/* Logo / Title */}
                <div className="flex-shrink-0 cursor-pointer flex items-center gap-3" onClick={(e) => handleNavClick(`/store/${storeId}`, e)}>
                    {logoConfig.showLogo !== false && logoSource && (
                        <img
                            src={logoSource}
                            alt={store?.name || 'Store logo'}
                            className="w-auto object-contain"
                            style={{ height: `${logoHeight}px` }}
                        />
                    )}
                    {logoConfig.showTitle !== false && (
                        <h1 className="text-xl md:text-2xl font-serif hover:opacity-80 transition-opacity">
                            {overrideTitle || logoConfig.title || store?.name || 'Store'}
                        </h1>
                    )}
                </div>

                {/* Global Search - Center (Desktop) */}
                {showSearch && (
                    <div className="hidden md:flex flex-1 max-w-md mx-4">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
                            <Input
                                placeholder="Search products & plans..."
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20"
                            />
                            <button
                                aria-label="Search"
                                onClick={() => triggerSearch(localSearch)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                            >
                                <Search className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Desktop Navigation */}
                <nav className="hidden md:flex gap-6 items-center">
                    {navItems.map((item) => (
                        <a 
                            key={item.key} 
                            href={item.path}
                            onClick={(e) => handleNavClick(item.path, e)}
                            className={`hover:opacity-80 transition-opacity cursor-pointer ${activeTab === item.key ? 'font-semibold' : ''}`}
                        >
                            {item.label}
                        </a>
                    ))}
                </nav>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                    {user ? (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary-foreground hover:bg-white/10"
                            onClick={(e) => handleNavClick(`/store/${storeId}/portal`, e)}
                            style={(iconColor || storedIconColor) ? { color: iconColor || storedIconColor } : {}}
                        >
                            <User className="w-4 h-4 md:mr-2" />
                            <span className="hidden md:inline">Account</span>
                        </Button>
                    ) : (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary-foreground hover:bg-white/10"
                            onClick={(e) => handleNavClick(`/store/${storeId}/login`, e)}
                            style={(iconColor || storedIconColor) ? { color: iconColor || storedIconColor } : {}}
                        >
                            <LogIn className="w-4 h-4 md:mr-2" />
                            <span className="hidden md:inline">Login</span>
                        </Button>
                    )}
                    
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary-foreground hover:bg-white/10 relative"
                        onClick={(e) => { e.preventDefault(); setCartOpen(true); navigate(`/store/${storeId}/cart`); }}
                        style={(iconColor || storedIconColor) ? { color: iconColor || storedIconColor } : {}}
                    >
                        <ShoppingCart className="w-4 h-4" />
                        {Number(cartTotal) > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-gold text-white text-[11px] rounded-full flex items-center justify-center">
                                {cartTotal}
                            </span>
                        )}
                    </Button>

                    {/* Mobile Menu */}
                    <div className="md:hidden">
                        <button 
                            onClick={() => setMobileMenuOpen(true)}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 text-primary-foreground hover:bg-white/10"
                            style={(iconColor || storedIconColor) ? { color: iconColor || storedIconColor } : {}}
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
                                        {navItems.map((item) => (
                                            <a 
                                                key={item.key} 
                                                href={item.path}
                                                onClick={(e) => handleNavClick(item.path, e)}
                                                className={`hover:opacity-80 transition-opacity block py-2 cursor-pointer text-foreground ${activeTab === item.key ? 'font-semibold' : ''}`}
                                            >
                                                {item.label}
                                            </a>
                                        ))}
                                    </nav>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Search */}
            {showSearch && (
                <div className="md:hidden px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products & plans..."
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-10 bg-background text-foreground border-input placeholder:text-muted-foreground"
                        />
                        <button
                            aria-label="Search"
                            onClick={() => triggerSearch(localSearch)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
};

export default StoreHeader;
