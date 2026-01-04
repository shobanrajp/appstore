import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ShoppingCart, User, LogIn, Search, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

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

    const NavLinks = ({ mobile = false }) => (
        <>
            {navItems.map((item) => (
                <Link 
                    key={item.key} 
                    to={item.path} 
                    className={`hover:opacity-80 transition-opacity ${activeTab === item.key ? 'font-semibold' : ''} ${mobile ? 'block py-2' : ''}`}
                    onClick={mobile ? () => document.body.click() : undefined}
                >
                    {item.label}
                </Link>
            ))}
        </>
    );

    return (
        <header className="bg-primary text-primary-foreground sticky top-0 z-50" style={style}>
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                {/* Logo */}
                <Link to={`/store/${storeId}`} className="flex-shrink-0">
                    <h1 className="text-xl md:text-2xl font-serif hover:opacity-80 transition-opacity">
                        {store?.name || 'Store'}
                    </h1>
                </Link>

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
                    <NavLinks />
                </nav>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                    {user ? (
                        <Link to="/portal">
                            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
                                <User className="w-4 h-4 md:mr-2" />
                                <span className="hidden md:inline">Account</span>
                            </Button>
                        </Link>
                    ) : (
                        <Link to="/login">
                            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
                                <LogIn className="w-4 h-4 md:mr-2" />
                                <span className="hidden md:inline">Login</span>
                            </Button>
                        </Link>
                    )}
                    
                    <Link to={`/store/${storeId}`}>
                        <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10 relative">
                            <ShoppingCart className="w-5 h-5" />
                            {cartTotal > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-white text-xs rounded-full flex items-center justify-center">
                                    {cartTotal}
                                </span>
                            )}
                        </Button>
                    </Link>

                    {/* Mobile Menu */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="sm" className="md:hidden text-primary-foreground hover:bg-white/10">
                                <Menu className="w-5 h-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[250px]">
                            <nav className="flex flex-col gap-4 mt-8">
                                <NavLinks mobile />
                            </nav>
                        </SheetContent>
                    </Sheet>
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
