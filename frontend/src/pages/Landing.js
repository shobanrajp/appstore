import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStores } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ShoppingBag, Store, Users, Shield, ArrowRight, Sparkles } from 'lucide-react';

const Landing = () => {
    const [stores, setStores] = useState([]);

    useEffect(() => {
        loadStores();
    }, []);

    const loadStores = async () => {
        try {
            const res = await getStores();
            setStores(res.data.filter(s => s.is_active));
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 gold-gradient opacity-90" />
                <div className="absolute inset-0 noise-overlay" />
                <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full mb-8">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm">Multi-Store E-commerce Platform</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-serif tracking-tight mb-6 animate-fade-in">
                        Dynamic Web App<br />Configurator
                    </h1>
                    <p className="text-xl md:text-2xl mb-8 opacity-90 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        Create and manage jewelry stores with visual page builders,<br />
                        gold savings plans, and complete e-commerce functionality.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <Link to="/login">
                            <Button size="lg" className="bg-white text-primary hover:bg-white/90 h-14 px-8 text-lg" data-testid="login-hero-btn">
                                Get Started <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                        </Link>
                        <Link to="/register">
                            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 h-14 px-8 text-lg" data-testid="register-hero-btn">
                                Create Account
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-serif mb-4">Platform Features</h2>
                        <p className="text-xl text-muted-foreground">Everything you need to run a modern jewelry business</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card className="luxury-card group">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-lg gold-gradient flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="font-serif">Multi-Role Access</CardTitle>
                                <CardDescription>
                                    Super Admin, Store Admin, Store User, and End User roles with granular permissions
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="luxury-card group">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-lg gold-gradient flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Store className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="font-serif">Store Management</CardTitle>
                                <CardDescription>
                                    Products, inventory, orders, POS, vendors, and purchase orders in one place
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="luxury-card group">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-lg gold-gradient flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <ShoppingBag className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="font-serif">Visual Page Editor</CardTitle>
                                <CardDescription>
                                    Drag-and-drop components to build stunning storefronts without coding
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="luxury-card group">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-lg gold-gradient flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                <CardTitle className="font-serif">Gold Savings Plans</CardTitle>
                                <CardDescription>
                                    Flexible subscription plans for customers to save and invest in gold
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Available Stores */}
            {stores.length > 0 && (
                <section className="py-24 px-4 bg-muted/30">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-serif mb-4">Browse Stores</h2>
                            <p className="text-xl text-muted-foreground">Explore our partner jewelry stores</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {stores.map((store) => (
                                <Card key={store.id} className="luxury-card overflow-hidden" data-testid={`store-card-${store.id}`}>
                                    <div className="h-40 gold-gradient opacity-80" />
                                    <CardHeader>
                                        <CardTitle className="font-serif">{store.name}</CardTitle>
                                        <CardDescription>{store.description || 'Fine jewelry and gold savings'}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Link to={`/store/${store.id}`}>
                                            <Button className="w-full gold-gradient text-white" data-testid={`visit-store-${store.id}`}>
                                                Visit Store <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </Link>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* CTA Section */}
            <section className="py-24 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-5xl font-serif mb-6">Ready to Get Started?</h2>
                    <p className="text-xl text-muted-foreground mb-8">
                        Login with the demo credentials or create your account to explore the platform
                    </p>
                    <Card className="bg-muted/50 border-gold/20">
                        <CardContent className="py-8">
                            <p className="text-lg mb-4">
                                <strong>Demo Super Admin:</strong><br />
                                Email: admin@admin.com<br />
                                Password: admin123
                            </p>
                            <Link to="/login">
                                <Button size="lg" className="gold-gradient text-white" data-testid="try-demo-btn">
                                    Try Demo <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-primary text-primary-foreground py-12">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <h2 className="text-2xl font-serif mb-4">Dynamic Web App Configurator</h2>
                    <p className="opacity-80 mb-4">Multi-Store E-commerce Platform for Jewelry Businesses</p>
                    <p className="text-sm opacity-60">© 2025 All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
