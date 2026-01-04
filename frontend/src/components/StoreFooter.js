import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, MessageCircle } from 'lucide-react';

const StoreFooter = ({ store, storeId, style = {} }) => {
    const getWhatsAppLink = () => {
        if (!store?.contact_phone) return null;
        const phone = store.contact_phone.replace(/[^0-9]/g, '');
        const message = encodeURIComponent(`Hi! I'm interested in your products at ${store?.name}.`);
        return `https://wa.me/${phone}?text=${message}`;
    };

    const whatsAppLink = getWhatsAppLink();

    return (
        <footer className="bg-primary text-primary-foreground py-12" style={style}>
            <div className="max-w-7xl mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Store Info */}
                    <div className="md:col-span-2">
                        <h2 className="text-2xl font-serif mb-4">{store?.name}</h2>
                        {store?.description && (
                            <p className="text-sm opacity-80 mb-4">{store.description}</p>
                        )}
                        {store?.address && (
                            <div className="flex items-start gap-2 text-sm opacity-80">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{store.address}</span>
                            </div>
                        )}
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-semibold mb-4">Quick Links</h3>
                        <nav className="flex flex-col gap-2 text-sm opacity-80">
                            <Link to={`/store/${storeId}`} className="hover:opacity-100 transition-opacity">Home</Link>
                            <Link to={`/store/${storeId}/products`} className="hover:opacity-100 transition-opacity">Products</Link>
                            <Link to={`/store/${storeId}/plans`} className="hover:opacity-100 transition-opacity">Plans</Link>
                            <Link to={`/store/${storeId}/contact`} className="hover:opacity-100 transition-opacity">Contact</Link>
                        </nav>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="font-semibold mb-4">Contact Us</h3>
                        <div className="flex flex-col gap-3 text-sm opacity-80">
                            {store?.contact_phone && (
                                <a href={`tel:${store.contact_phone}`} className="flex items-center gap-2 hover:opacity-100 transition-opacity">
                                    <Phone className="w-4 h-4" />
                                    <span>{store.contact_phone}</span>
                                </a>
                            )}
                            {store?.contact_email && (
                                <a href={`mailto:${store.contact_email}`} className="flex items-center gap-2 hover:opacity-100 transition-opacity">
                                    <Mail className="w-4 h-4" />
                                    <span>{store.contact_email}</span>
                                </a>
                            )}
                            {whatsAppLink && (
                                <a href={whatsAppLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-100 transition-opacity">
                                    <MessageCircle className="w-4 h-4" />
                                    <span>WhatsApp Chat</span>
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="border-t border-white/20 mt-8 pt-8 text-center text-sm opacity-60">
                    <p>© {new Date().getFullYear()} {store?.name}. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default StoreFooter;
