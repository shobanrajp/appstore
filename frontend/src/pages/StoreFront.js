import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStore, getProducts, getSubscriptionPlans, getPageConfig, createOrder, subscribeToPlan, createPaymentOrder, completePayment, getAddresses, createAddress } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { ShoppingCart, User, Plus, Minus, X, CreditCard, LogIn } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

// Dynamic Component Renderer - renders components based on page config
const DynamicComponent = ({ component, products, plans, store, addToCart, onSubscribe, user }) => {
    const { type, props = {} } = component;

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
        case 'header':
            return (
                <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-40" style={wrapperStyle}>
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <h1 className="text-2xl font-serif">{props.title || store?.name || 'Store'}</h1>
                        <nav className="hidden md:flex gap-6">
                            {(props.menuItems || ['Home', 'Products', 'Plans', 'Contact']).map((item, i) => (
                                <span key={i} className="hover:opacity-80 cursor-pointer">{item}</span>
                            ))}
                        </nav>
                    </div>
                </header>
            );
        case 'footer':
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
            return (
                <div 
                    className="relative h-96 bg-cover bg-center flex items-center justify-center"
                    style={{ 
                        backgroundImage: props.backgroundImage ? `url(${props.backgroundImage})` : 'linear-gradient(135deg, #D4AF37 0%, #F2D06B 50%, #B5942F 100%)',
                        ...wrapperStyle 
                    }}
                >
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="relative text-center text-white px-4">
                        <h1 className="text-4xl md:text-6xl font-serif mb-4">{props.title || `Welcome to ${store?.name}`}</h1>
                        <p className="text-lg md:text-xl mb-6">{props.subtitle || 'Discover exquisite jewelry'}</p>
                        <Button className="gold-gradient text-white">{props.buttonText || 'Shop Now'}</Button>
                    </div>
                </div>
            );
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
            return (
                <section className="py-16 px-4" style={wrapperStyle}>
                    <div className="max-w-7xl mx-auto">
                        <h2 className="text-4xl font-serif text-center mb-12">{props.title || 'Our Collection'}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {products.slice(0, props.limit || 8).map((product) => (
                                <Card key={product.id} className="luxury-card overflow-hidden group" data-testid={`product-card-${product.id}`}>
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
                                        {product.weight && (
                                            <p className="text-sm text-muted-foreground">{product.weight}g</p>
                                        )}
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="gold-text text-xl font-semibold">
                                                {formatCurrency(product.price, store?.currency)}
                                            </span>
                                            <Button
                                                size="sm"
                                                onClick={() => addToCart(product)}
                                                className="gold-gradient text-white"
                                                data-testid={`add-to-cart-${product.id}`}
                                            >
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {products.length === 0 && (
                                <div className="col-span-full text-center py-12 text-muted-foreground">
                                    No products available yet.
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            );
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
                                            {plan.plan_type === 'gold_flexi' ? 'Gold Flexi' : 'Silver Flexi'}
                                        </Badge>
                                        <CardTitle className="font-serif text-2xl mt-2">{plan.name}</CardTitle>
                                        <CardDescription>{plan.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-4xl font-serif gold-text mb-1">
                                            {formatCurrency(plan.monthly_amount, store?.currency)}
                                            <span className="text-base text-muted-foreground">/month</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            {plan.duration_months} months • {plan.bonus_percentage}% bonus
                                        </p>
                                        <ul className="space-y-2 mb-6">
                                            <li className="flex items-center text-sm">
                                                <span className="w-2 h-2 bg-gold rounded-full mr-2" />
                                                Lock gold weight at today's rate
                                            </li>
                                            <li className="flex items-center text-sm">
                                                <span className="w-2 h-2 bg-gold rounded-full mr-2" />
                                                Zero making charges up to {plan.bonus_percentage}%
                                            </li>
                                            <li className="flex items-center text-sm">
                                                <span className="w-2 h-2 bg-gold rounded-full mr-2" />
                                                Flexible redemption options
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
            return (
                <nav className="bg-card border-y py-3" style={wrapperStyle}>
                    <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-4 md:gap-8 px-4">
                        {(props.categories || ['Necklaces', 'Rings', 'Earrings', 'Bangles', 'Chains']).map((cat, i) => (
                            <span key={i} className="hover:text-gold cursor-pointer transition-colors text-sm md:text-base">{cat}</span>
                        ))}
                    </div>
                </nav>
            );
        default:
            return null;
    }
};

const StoreFront = () => {
    const { storeId } = useParams();
    const { user } = useAuth();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [plans, setPlans] = useState([]);
    const [pageConfig, setPageConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [selectedAddress, setSelectedAddress] = useState('');
    const [newAddressOpen, setNewAddressOpen] = useState(false);
    const [newAddress, setNewAddress] = useState({
        label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '',
        city: '', state: '', postal_code: '', country: 'India', is_default: false
    });
    const [subscribeOpen, setSubscribeOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paymentType, setPaymentType] = useState('value');

    useEffect(() => {
        loadData();
    }, [storeId]);

    useEffect(() => {
        if (user) {
            loadAddresses();
        }
    }, [user]);

    const loadData = async () => {
        try {
            const [storeRes, productsRes, plansRes] = await Promise.all([
                getStore(storeId),
                getProducts(storeId),
                getSubscriptionPlans(storeId)
            ]);
            setStore(storeRes.data);
            setProducts(productsRes.data);
            setPlans(plansRes.data);

            try {
                const configRes = await getPageConfig(storeId, 'home');
                if (configRes.data && configRes.data.components && configRes.data.components.length > 0) {
                    setPageConfig(configRes.data);
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
    };

    const loadAddresses = async () => {
        try {
            const res = await getAddresses();
            setAddresses(res.data);
            if (res.data.length > 0) {
                const defaultAddr = res.data.find(a => a.is_default) || res.data[0];
                setSelectedAddress(defaultAddr.id);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const addToCart = (product) => {
        const existing = cart.find(item => item.product_id === product.id);
        if (existing) {
            setCart(cart.map(item =>
                item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            ));
        } else {
            setCart([...cart, { product_id: product.id, product_name: product.name, quantity: 1, price: product.price }]);
        }
        toast.success(`${product.name} added to cart`);
    };

    const updateQuantity = (productId, delta) => {
        setCart(cart.map(item => {
            if (item.product_id === productId) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const removeFromCart = (productId) => {
        setCart(cart.filter(item => item.product_id !== productId));
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const handleAddAddress = async (e) => {
        e.preventDefault();
        try {
            const res = await createAddress(newAddress);
            setAddresses([...addresses, res.data]);
            setSelectedAddress(res.data.id);
            setNewAddressOpen(false);
            setNewAddress({
                label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '',
                city: '', state: '', postal_code: '', country: 'India', is_default: false
            });
            toast.success('Address added');
        } catch (error) {
            toast.error('Failed to add address');
        }
    };

    const handleCheckout = async () => {
        if (!selectedAddress) {
            toast.error('Please select a delivery address');
            return;
        }

        try {
            const orderRes = await createOrder(storeId, {
                items: cart.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: item.price
                })),
                shipping_address_id: selectedAddress
            });

            const paymentRes = await createPaymentOrder({
                amount: cartTotal,
                description: `Order ${orderRes.data.id}`,
                order_id: orderRes.data.id
            });

            await completePayment(paymentRes.data.id);

            toast.success('Order placed successfully!');
            setCart([]);
            setCheckoutOpen(false);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Checkout failed');
        }
    };

    const handleSubscribe = async () => {
        if (!selectedPlan) return;

        try {
            const subRes = await subscribeToPlan(storeId, {
                plan_id: selectedPlan.id,
                payment_type: paymentType,
                monthly_amount: selectedPlan.monthly_amount
            });

            const paymentRes = await createPaymentOrder({
                amount: selectedPlan.monthly_amount,
                description: `${selectedPlan.name} - First Installment`,
                subscription_id: subRes.data.id
            });

            await completePayment(paymentRes.data.id);

            toast.success('Subscribed successfully! First payment completed.');
            setSubscribeOpen(false);
            setSelectedPlan(null);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Subscription failed');
        }
    };

    const openSubscribeDialog = (plan) => {
        setSelectedPlan(plan);
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
            {/* Fixed Cart Button */}
            <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
                {user ? (
                    <Link to="/portal">
                        <Button variant="secondary" className="shadow-lg" data-testid="my-account-btn">
                            <User className="w-4 h-4 mr-2" /> My Account
                        </Button>
                    </Link>
                ) : (
                    <Link to="/login">
                        <Button variant="secondary" className="shadow-lg" data-testid="login-btn">
                            <LogIn className="w-4 h-4 mr-2" /> Login
                        </Button>
                    </Link>
                )}
                <Button
                    variant="secondary"
                    className="shadow-lg relative"
                    onClick={() => setCartOpen(true)}
                    data-testid="cart-btn"
                >
                    <ShoppingCart className="w-5 h-5" />
                    {cart.length > 0 && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-gold text-white text-xs rounded-full flex items-center justify-center">
                            {cart.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                    )}
                </Button>
            </div>

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
                                plans={plans}
                                store={store}
                                addToCart={addToCart}
                                onSubscribe={openSubscribeDialog}
                                user={user}
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
                                <span className="hover:opacity-80 cursor-pointer">Home</span>
                                <span className="hover:opacity-80 cursor-pointer">Products</span>
                                <span className="hover:opacity-80 cursor-pointer">Plans</span>
                                <span className="hover:opacity-80 cursor-pointer">Contact</span>
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
                            <h2 className="text-4xl font-serif text-center mb-12">Our Collection</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {products.map((product) => (
                                    <Card key={product.id} className="luxury-card overflow-hidden group" data-testid={`product-card-${product.id}`}>
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
                                            {product.weight && (
                                                <p className="text-sm text-muted-foreground">{product.weight}g</p>
                                            )}
                                            <div className="flex items-center justify-between mt-3">
                                                <span className="gold-text text-xl font-semibold">
                                                    {formatCurrency(product.price, store.currency)}
                                                </span>
                                                <Button
                                                    size="sm"
                                                    onClick={() => addToCart(product)}
                                                    className="gold-gradient text-white"
                                                    data-testid={`add-to-cart-${product.id}`}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {products.length === 0 && (
                                    <div className="col-span-full text-center py-12 text-muted-foreground">
                                        No products available yet.
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

            {/* Cart Drawer */}
            <Dialog open={cartOpen} onOpenChange={setCartOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif">Shopping Cart</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {cart.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">Your cart is empty</p>
                        ) : (
                            <>
                                {cart.map((item) => (
                                    <div key={item.product_id} className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{item.product_name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatCurrency(item.price, store.currency)} × {item.quantity}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => updateQuantity(item.product_id, -1)}>
                                                <Minus className="w-3 h-3" />
                                            </Button>
                                            <span className="w-8 text-center">{item.quantity}</span>
                                            <Button variant="outline" size="sm" onClick={() => updateQuantity(item.product_id, 1)}>
                                                <Plus className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.product_id)}>
                                                <X className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <div className="border-t pt-4">
                                    <div className="flex justify-between text-lg font-semibold">
                                        <span>Total</span>
                                        <span className="gold-text">{formatCurrency(cartTotal, store.currency)}</span>
                                    </div>
                                </div>
                                {user ? (
                                    <Button
                                        className="w-full gold-gradient text-white"
                                        onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                                        data-testid="checkout-btn"
                                    >
                                        <CreditCard className="w-4 h-4 mr-2" /> Checkout
                                    </Button>
                                ) : (
                                    <Link to="/login" className="block">
                                        <Button className="w-full">Login to Checkout</Button>
                                    </Link>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Checkout Dialog */}
            <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Checkout</DialogTitle>
                        <DialogDescription>Select delivery address and complete payment</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Delivery Address</Label>
                            {addresses.length > 0 ? (
                                <Select value={selectedAddress} onValueChange={setSelectedAddress}>
                                    <SelectTrigger data-testid="address-select">
                                        <SelectValue placeholder="Select address" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {addresses.map((addr) => (
                                            <SelectItem key={addr.id} value={addr.id}>
                                                {addr.label}: {addr.address_line1}, {addr.city}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-sm text-muted-foreground">No addresses saved</p>
                            )}
                            <Button variant="outline" size="sm" onClick={() => setNewAddressOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" /> Add New Address
                            </Button>
                        </div>

                        <div className="border-t pt-4 space-y-2">
                            <div className="flex justify-between">
                                <span>Items ({cart.length})</span>
                                <span>{formatCurrency(cartTotal, store.currency)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-semibold">
                                <span>Total</span>
                                <span className="gold-text">{formatCurrency(cartTotal, store.currency)}</span>
                            </div>
                        </div>

                        <Button
                            className="w-full gold-gradient text-white"
                            onClick={handleCheckout}
                            disabled={!selectedAddress || cart.length === 0}
                            data-testid="place-order-btn"
                        >
                            Place Order (Mock Payment)
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                            This is a demo checkout with mock payment processing
                        </p>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Address Dialog */}
            <Dialog open={newAddressOpen} onOpenChange={setNewAddressOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Add New Address</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddAddress} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Label</Label>
                                <Select value={newAddress.label} onValueChange={(v) => setNewAddress({ ...newAddress, label: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Home">Home</SelectItem>
                                        <SelectItem value="Work">Work</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input
                                    value={newAddress.full_name}
                                    onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input
                                value={newAddress.phone}
                                onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Address Line 1</Label>
                            <Input
                                value={newAddress.address_line1}
                                onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Address Line 2</Label>
                            <Input
                                value={newAddress.address_line2}
                                onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>City</Label>
                                <Input
                                    value={newAddress.city}
                                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>State</Label>
                                <Input
                                    value={newAddress.state}
                                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Postal Code</Label>
                                <Input
                                    value={newAddress.postal_code}
                                    onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Country</Label>
                                <Input value={newAddress.country} disabled />
                            </div>
                        </div>
                        <Button type="submit" className="w-full gold-gradient text-white">
                            Save Address
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Subscribe Dialog */}
            <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Subscribe to {selectedPlan?.name}</DialogTitle>
                        <DialogDescription>Choose your preferred payment type</DialogDescription>
                    </DialogHeader>
                    {selectedPlan && (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg">
                                <div className="flex justify-between mb-2">
                                    <span>Monthly Payment</span>
                                    <span className="font-semibold">{formatCurrency(selectedPlan.monthly_amount, store.currency)}</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span>Duration</span>
                                    <span>{selectedPlan.duration_months} months</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Bonus</span>
                                    <span className="gold-text font-semibold">{selectedPlan.bonus_percentage}%</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Payment Type</Label>
                                <Select value={paymentType} onValueChange={setPaymentType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="value">Value Based (Fixed Amount)</SelectItem>
                                        <SelectItem value="weight">Weight Based (Fixed Gold Weight)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button
                                className="w-full gold-gradient text-white"
                                onClick={handleSubscribe}
                                data-testid="confirm-subscribe-btn"
                            >
                                Subscribe & Pay First Installment (Mock)
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                                This is a demo subscription with mock payment
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StoreFront;
