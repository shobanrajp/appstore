import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getStore } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Phone, Mail, MapPin, Clock, MessageCircle } from 'lucide-react';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';

const StoreContact = () => {
    const { storeId } = useParams();
    const [store, setStore] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState(() => {
        const saved = localStorage.getItem(`cart_${storeId}`);
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        loadData();
    }, [storeId]);

    const loadData = async () => {
        try {
            const storeRes = await getStore(storeId);
            setStore(storeRes.data);
        } catch (error) {
            toast.error('Failed to load store information');
        } finally {
            setLoading(false);
        }
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.quantity, 0);

    const getWhatsAppLink = () => {
        if (!store?.contact_phone) return null;
        const phone = store.contact_phone.replace(/[^0-9]/g, '');
        const message = encodeURIComponent(`Hi! I'm interested in your products at ${store.name}.`);
        return `https://wa.me/${phone}?text=${message}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <StoreHeader store={store} storeId={storeId} cartTotal={cartTotal} activeTab="contact" />

            <main className="max-w-4xl mx-auto px-4 py-12 flex-1">
                <h2 className="text-4xl font-serif text-center mb-4">Contact Us</h2>
                <p className="text-center text-muted-foreground mb-12">We'd love to hear from you. Reach out to us through any of the following channels.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Store Info Card */}
                    <Card className="luxury-card">
                        <CardHeader>
                            <CardTitle className="font-serif flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-gold" /> Store Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-lg">{store?.name}</h3>
                                {store?.description && (
                                    <p className="text-muted-foreground mt-1">{store.description}</p>
                                )}
                            </div>
                            {store?.address && (
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                    <p className="text-muted-foreground">{store.address}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Contact Details Card */}
                    <Card className="luxury-card">
                        <CardHeader>
                            <CardTitle className="font-serif flex items-center gap-2">
                                <Phone className="w-5 h-5 text-gold" /> Get in Touch
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {store?.contact_phone && (
                                <div className="flex items-center gap-3">
                                    <Phone className="w-5 h-5 text-muted-foreground" />
                                    <a href={`tel:${store.contact_phone}`} className="text-muted-foreground hover:text-foreground transition-colors">
                                        {store.contact_phone}
                                    </a>
                                </div>
                            )}
                            {store?.contact_email && (
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-muted-foreground" />
                                    <a href={`mailto:${store.contact_email}`} className="text-muted-foreground hover:text-foreground transition-colors">
                                        {store.contact_email}
                                    </a>
                                </div>
                            )}
                            {store?.business_hours && (
                                <div className="flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-muted-foreground">{store.business_hours}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* WhatsApp CTA */}
                {store?.contact_phone && (
                    <Card className="mt-8 luxury-card bg-gradient-to-r from-green-500/10 to-green-600/10 border-green-500/30">
                        <CardContent className="py-8 text-center">
                            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                            <h3 className="text-2xl font-serif mb-2">Chat with us on WhatsApp</h3>
                            <p className="text-muted-foreground mb-6">Get instant responses to your queries</p>
                            <a href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer">
                                <Button className="bg-green-500 hover:bg-green-600 text-white px-8 py-6 text-lg">
                                    <MessageCircle className="w-5 h-5 mr-2" /> Start WhatsApp Chat
                                </Button>
                            </a>
                        </CardContent>
                    </Card>
                )}

                {/* Store Currency Info */}
                {store?.currency && (
                    <div className="mt-8 text-center text-muted-foreground text-sm">
                        All prices are listed in {store.currency}
                    </div>
                )}
            </main>
        </div>
    );
};

export default StoreContact;
