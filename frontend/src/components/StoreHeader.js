import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ShoppingCart, User, LogIn, Search, Menu } from 'lucide-react';

const StoreHeader = ({ 
    store, 
    storeId, 
    cartTotal = 0, 
    activeTab = '', 
    showSearch = false,
    searchTerm = '',
    onSearchChange = () => {},
    style = {}
}) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    // Get stored header style from localStorage (set by StoreFront from Page Editor config)
    const [headerStyle, setHeaderStyle] = useState(style);
    
    useEffect(() => {
        if (Object.keys(style).length === 0) {
            const storedStyle = localStorage.getItem(`header_style_${storeId}`);
            if (storedStyle) {
                try {
                    setHeaderStyle(JSON.parse(storedStyle));
                } catch (e) {}
            }
        } else {
            // Store the style for other pages to use
            localStorage.setItem(`header_style_${storeId}`, JSON.stringify(style));
            setHeaderStyle(style);
        }
    }, [storeId, style]);

    const navItems = [
        { label: 'Home', path: `/store/${storeId}`, key: 'home' },
        { label: 'Products', path: `/store/${storeId}/products`, key: 'products' },
        { label: 'Plans', path: `/store/${storeId}/plans`, key: 'plans' },
        { label: 'Contact', path: `/store/${storeId}/contact`, key: 'contact' },
    ];

    const handleNavClick = (path, e) => {
        if (e) e.preventDefault();
        setMobileMenuOpen(false);
        // Use window.location for reliable navigation
        window.location.href = path;
    };

    return (
        <header className="bg-primary text-primary-foreground sticky top-0 z-50" style={headerStyle}>
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                {/* Logo */}
                <div className="flex-shrink-0 cursor-pointer" onClick={(e) => handleNavClick(`/store/${storeId}`, e)}>
                    <h1 className="text-xl md:text-2xl font-serif hover:opacity-80 transition-opacity">
                        {store?.name || 'Store'}
                    </h1>
                </div>

                {/* Global Search - Center (Desktop) */}
                {showSearch && (
                    <div className="hidden md:flex flex-1 max-w-md mx-4">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
                            <Input
                                placeholder="Search products & plans..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20"
                            />
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
                            onClick={(e) => handleNavClick('/portal', e)}
                        >
                            <User className="w-4 h-4 md:mr-2" />
                            <span className="hidden md:inline">Account</span>
                        </Button>
                    ) : (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary-foreground hover:bg-white/10"
                            onClick={(e) => handleNavClick('/login', e)}
                        >
                            <LogIn className="w-4 h-4 md:mr-2" />
                            <span className="hidden md:inline">Login</span>
                        </Button>
                    )}
                    
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary-foreground hover:bg-white/10 relative"
                        onClick={(e) => handleNavClick(`/store/${storeId}`, e)}
                    >
                        <ShoppingCart className="w-5 h-5" />
                        {cartTotal > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-white text-xs rounded-full flex items-center justify-center">
                                {cartTotal}
                            </span>
                        )}
                    </Button>

                    {/* Mobile Menu */}
                    <div className="md:hidden">
                        <button 
                            onClick={() => setMobileMenuOpen(true)}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 text-primary-foreground hover:bg-white/10"
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
                                <div className="fixed inset-y-0 right-0 z-50 w-[250px] bg-background p-6 shadow-lg">
                                    <button 
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
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
                                                className={`hover:opacity-80 transition-opacity block py-2 cursor-pointer ${activeTab === item.key ? 'font-semibold' : ''}`}
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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
                        <Input
                            placeholder="Search products & plans..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                        />
                    </div>
                </div>
            )}
        </header>
    );
};

export default StoreHeader;
