import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getPageConfigs, updatePageConfig, createPageConfig, getStore, getProducts, getSubscriptionPlans } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { setPageTitle, getImageUrl } from '../lib/utils';
import {
    ArrowLeft, Save, Eye, Layout, Type, Image, Grid3X3, Columns, Square, 
    Menu, ListOrdered, ChevronDown, SeparatorHorizontal, Trash2, GripVertical,
    Monitor, Smartphone, Plus, Search, Palette, MapPin
} from 'lucide-react';

// Predefined Theme Presets
const THEME_PRESETS = [
    {
        id: 'luxury-gold',
        name: 'Luxury Gold',
        description: 'Elegant gold tones with dark accents',
        primaryColor: '#D4AF37',
        secondaryColor: '#1a1a2e',
        backgroundColor: '#ffffff',
        textColor: '#1a1a2e',
        accentColor: '#F2D06B',
        fontFamily: 'serif'
    },
    {
        id: 'modern-minimal',
        name: 'Modern Minimal',
        description: 'Clean and contemporary',
        primaryColor: '#000000',
        secondaryColor: '#f5f5f5',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        accentColor: '#666666',
        fontFamily: 'sans-serif'
    },
    {
        id: 'royal-blue',
        name: 'Royal Blue',
        description: 'Rich blue with silver accents',
        primaryColor: '#1e3a5f',
        secondaryColor: '#c0c0c0',
        backgroundColor: '#f8f9fa',
        textColor: '#1e3a5f',
        accentColor: '#4a90d9',
        fontFamily: 'serif'
    },
    {
        id: 'rose-gold',
        name: 'Rose Gold',
        description: 'Warm rose gold elegance',
        primaryColor: '#b76e79',
        secondaryColor: '#f5e6e8',
        backgroundColor: '#fffaf0',
        textColor: '#4a4a4a',
        accentColor: '#d4a5a5',
        fontFamily: 'serif'
    },
    {
        id: 'emerald-luxe',
        name: 'Emerald Luxe',
        description: 'Deep green sophistication',
        primaryColor: '#046307',
        secondaryColor: '#d4af37',
        backgroundColor: '#fefefe',
        textColor: '#1a1a1a',
        accentColor: '#2d6a4f',
        fontFamily: 'serif'
    }
];

// Component Types
const COMPONENT_TYPES = [
    { type: 'header', label: 'Header', icon: Layout },
    { type: 'footer', label: 'Footer', icon: Layout },
    { type: 'hero', label: 'Hero Banner', icon: Image },
    { type: 'text', label: 'Text Block', icon: Type },
    { type: 'grid', label: 'Grid (1-12 cols)', icon: Grid3X3 },
    { type: 'row', label: 'Row', icon: Columns },
    { type: 'card', label: 'Card', icon: Square },
    { type: 'tabs', label: 'Tabs', icon: ListOrdered },
    { type: 'accordion', label: 'Accordion', icon: ChevronDown },
    { type: 'divider', label: 'Divider/Spacer', icon: SeparatorHorizontal },
    { type: 'menu', label: 'Menu Categories', icon: Menu },
    { type: 'search_bar', label: 'Search Bar', icon: Type },
    { type: 'products', label: 'Product Grid', icon: Grid3X3 },
    { type: 'scrolling_text', label: 'Scrolling Text', icon: Type },
    { type: 'subscription_plans', label: 'Subscription Plans', icon: Square },
    { type: 'map_link', label: 'Map Link', icon: MapPin },
];

// Sortable Component Wrapper
const SortableComponent = ({ component, onSelect, selected, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: component.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`component-wrapper p-4 bg-card border rounded-lg mb-2 ${selected ? 'selected ring-2 ring-gold' : ''}`}
            onClick={() => onSelect(component)}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-muted rounded">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <span className="font-medium capitalize">{component.type.replace('_', ' ')}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(component.id); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
            </div>
            {component.props?.title && (
                <p className="text-sm text-muted-foreground mt-1 truncate">{component.props.title}</p>
            )}
        </div>
    );
};

// Component Preview Renderer
const ComponentPreview = ({ component, products, plans }) => {
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

    // Map high-level visual effects and entrance animations to classes/styles
    const getEffectAttributes = (props = {}) => {
        const effect = props.effect || 'none';
        const animation = props.animation || 'none';
        let className = '';
        const style = {};

        switch (effect) {
            case 'elevated':
                className += ' shadow-2xl rounded-xl overflow-hidden transform-gpu hover:-translate-y-2 hover:shadow-[0_25px_60px_rgba(0,0,0,0.18)] transition-transform duration-500';
                break;
            case 'glass':
                className += ' backdrop-blur-md bg-white/20 border border-white/10 rounded-xl overflow-hidden';
                break;
            case 'glow':
                className += ' rounded-lg';
                style.boxShadow = '0 12px 30px rgba(212,175,55,0.12), 0 4px 10px rgba(0,0,0,0.06)';
                break;
            case 'tilt':
                className += ' transform-gpu hover:rotate-1 hover:scale-102 transition-transform duration-500';
                break;
            case 'none':
            default:
                break;
        }

        // Simple entrance animations using Tailwind where available
        switch (animation) {
            case 'pulse':
                className += ' animate-pulse';
                break;
            case 'pop':
                className += ' transition-transform duration-500 ease-out hover:scale-105';
                break;
            case 'slide':
                className += ' transition-transform duration-700 ease-out transform translate-y-0';
                break;
            case 'none':
            default:
                break;
        }

        return { className: className.trim(), style };
    };

    const wrapperStyle = getStyleFromProps();
    const effectAttrs = getEffectAttributes(props);

    switch (type) {
        case 'header':
            return (
                <header className={`bg-primary text-primary-foreground p-4 ${effectAttrs.className}`} style={{ ...wrapperStyle, ...effectAttrs.style }}>
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <h1 className="text-2xl font-serif">{props.title || 'Store Name'}</h1>
                        <div className="flex items-center gap-4">
                            {props.showSearch && (
                                <div className="hidden md:block">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input placeholder="Search products..." className="pl-10" readOnly />
                                    </div>
                                </div>
                            )}
                            <nav className="flex gap-4">
                                {(props.menuItems || ['Home', 'Products', 'Plans', 'Contact']).map((item, i) => (
                                    <span key={i} className="hover:opacity-80 cursor-pointer">{item}</span>
                                ))}
                            </nav>
                        </div>
                    </div>
                </header>
            );
        case 'footer':
            return (
                <footer className="bg-primary text-primary-foreground p-8" style={wrapperStyle}>
                    <div className="max-w-7xl mx-auto text-center">
                        <p>{props.text || '© 2025 Your Store. All rights reserved.'}</p>
                    </div>
                </footer>
            );
        case 'hero':
            return (
                <div 
                    className={`relative h-80 bg-cover bg-center flex items-center justify-center ${effectAttrs.className}`}
                    style={{ 
                        backgroundImage: props.backgroundImage ? `url("${getImageUrl(props.backgroundImage)}")` : 'linear-gradient(135deg, #D4AF37 0%, #F2D06B 50%, #B5942F 100%)',
                        ...wrapperStyle,
                        ...effectAttrs.style
                    }}
                >
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="relative text-center text-white">
                        <h1 className="text-5xl font-serif mb-4">{props.title || 'Welcome to Our Store'}</h1>
                        <p className="text-xl mb-6">{props.subtitle || 'Discover exquisite jewelry'}</p>
                        {props.buttonText && (
                            <Button className="gold-gradient text-white">{props.buttonText}</Button>
                        )}
                    </div>
                </div>
            );
        case 'text':
            return (
                <div className="py-8 px-4" style={wrapperStyle}>
                    <div className="max-w-4xl mx-auto">
                        {props.title && <h2 className="text-3xl font-serif mb-4">{props.title}</h2>}
                        <p className="text-muted-foreground">{props.content || 'Add your text content here...'}</p>
                    </div>
                </div>
            );
        case 'grid':
            return (
                <div className={`grid grid-cols-${props.columns || 3} gap-4 p-4`} style={wrapperStyle}>
                    {Array(props.columns || 3).fill(0).map((_, i) => (
                        <div key={i} className="bg-muted h-32 rounded-lg flex items-center justify-center text-muted-foreground">
                            Column {i + 1}
                        </div>
                    ))}
                </div>
            );
        case 'card':
            return (
                <Card className={`max-w-sm mx-auto my-4 luxury-card ${effectAttrs.className}`} style={{ ...wrapperStyle, ...effectAttrs.style }}>
                    <CardHeader>
                        <CardTitle className="font-serif">{props.title || 'Card Title'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">{props.content || 'Card content goes here...'}</p>
                    </CardContent>
                </Card>
            );
        case 'divider':
            return <div className={`h-${props.height || 8}`} style={wrapperStyle} />;
        case 'products':
            return (
                <div className={`py-8 px-4 ${effectAttrs.className}`} style={{ ...wrapperStyle, ...effectAttrs.style }}>
                    <h2 className="text-3xl font-serif text-center mb-8">{props.title || 'Featured Products'}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
                        {(() => {
                            const limit = Math.min(props.limit || 4, 100);
                            const filtered = props.featuredOnly ? products.filter(p => p.featured) : products;
                            return filtered.slice(0, limit).map((product) => (
                            <Card key={product.id} className="luxury-card overflow-hidden">
                                <div className="h-32 md:h-48 bg-muted flex items-center justify-center">
                                    {product.images?.[0] ? (
                                        <img src={getImageUrl(product.images[0])} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-muted-foreground">No Image</span>
                                    )}
                                </div>
                                <CardContent className="p-4">
                                    <h3 className="font-serif font-semibold">{product.name}</h3>
                                    <p className="gold-text font-semibold">₹{product.price.toLocaleString()}</p>
                                </CardContent>
                            </Card>
                            ));
                        })()}
                        {products.length === 0 && (
                            <div className="col-span-full text-center py-12 text-muted-foreground">
                                No products to display. Add products in the Store Management portal.
                            </div>
                        )}
                    </div>
                </div>
            );
        case 'scrolling_text':
            return (
                <div className="bg-gold text-white py-2 overflow-hidden" style={wrapperStyle}>
                    <div className="animate-marquee whitespace-nowrap">
                        {props.text || 'Add your scrolling announcement here...'}
                    </div>
                </div>
            );
        case 'subscription_plans':
            return (
                <div className={`py-12 px-4 bg-muted/30 ${effectAttrs.className}`} style={{ ...wrapperStyle, ...effectAttrs.style }}>
                    <h2 className="text-3xl font-serif text-center mb-8">{props.title || 'Gold Savings Plans'}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {plans.map((plan) => (
                            <Card key={plan.id} className="luxury-card">
                                <CardHeader>
                                    <div className="gold-gradient text-white text-xs px-2 py-1 rounded w-fit mb-2">
                                        {plan.plan_type || 'Flexi Plan'}
                                    </div>
                                    <CardTitle className="font-serif">{plan.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-serif gold-text mb-2">
                                        ₹{(plan.min_amount || 500).toLocaleString()} - ₹{(plan.max_amount || 100000).toLocaleString()}<span className="text-sm text-muted-foreground">/month</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">{plan.duration_months} months • {plan.bonus_percentage}% bonus</p>
                                    <Button className="w-full gold-gradient text-white">Subscribe Now</Button>
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
            );
        case 'map_link':
            const isHidden = props.visible_home === false || props.visible_contact === false;
            const hiddenPages = [];
            if (props.visible_home === false) hiddenPages.push('Home');
            if (props.visible_contact === false) hiddenPages.push('Contact');
            
            return (
                <div className={`py-8 px-4 ${effectAttrs.className} ${isHidden ? 'opacity-50 border-2 border-dashed border-muted' : ''}`} style={{ ...wrapperStyle, ...effectAttrs.style }}>
                    <div className="max-w-3xl mx-auto text-center">
                        {hiddenPages.length > 0 && (
                            <div className="text-xs text-muted-foreground mb-2 bg-muted px-2 py-1 rounded inline-block">
                                Hidden on: {hiddenPages.join(', ')}
                            </div>
                        )}
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
        case 'menu':
            // Derive categories from actual products
            const productCategories = [...new Set(products.filter(p => p.category).map(p => p.category))];
            const displayCategories = productCategories.length > 0 ? productCategories : ['No categories yet'];
            return (
                <nav className={`bg-card border-y py-2 ${effectAttrs.className}`} style={{ ...wrapperStyle, ...effectAttrs.style }}>
                    <div className="max-w-7xl mx-auto flex items-center justify-center gap-8">
                        {displayCategories.map((cat, i) => (
                            <span key={i} className="hover:gold-text cursor-pointer transition-colors">{cat}</span>
                        ))}
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
                                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
                                readOnly
                            />
                        </div>
                    </div>
                </div>
            );
        default:
            return (
                <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground" style={wrapperStyle}>
                    {type} component
                </div>
            );
    }
};

const PageEditor = () => {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [plans, setPlans] = useState([]);
    const [pageConfig, setPageConfig] = useState(null);
    const [components, setComponents] = useState([]);
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState('desktop');
    const [isPublished, setIsPublished] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState(null);
    const [showThemePanel, setShowThemePanel] = useState(false);
    const [heroSlidesDraft, setHeroSlidesDraft] = useState([]);
    const [previewHeroIndex, setPreviewHeroIndex] = useState(0);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    useEffect(() => {
        loadData();
    }, [storeId]);

    useEffect(() => {
        if (selectedComponent?.type === 'hero') {
            const normalized = normalizeHeroSlides(
                (Array.isArray(selectedComponent.props?.heroSlides) && selectedComponent.props.heroSlides.length > 0)
                    ? selectedComponent.props.heroSlides
                    : (Array.isArray(selectedComponent.props?.heroImages) && selectedComponent.props.heroImages.length > 0)
                        ? selectedComponent.props.heroImages.map((img) => ({ image: img, category: '' }))
                        : [{ image: '', category: '' }]
            );
            setHeroSlidesDraft(normalized);
            setPreviewHeroIndex(0);
        } else {
            setHeroSlidesDraft([]);
            setPreviewHeroIndex(0);
        }
    }, [selectedComponent]);

    useEffect(() => {
        // Autoplay the preview when carousel is enabled
        if (!selectedComponent || selectedComponent.type !== 'hero') return;
        const slides = heroSlidesDraft;
        const useCarousel = !!selectedComponent.props?.heroCarousel && slides.length > 1;
        setPreviewHeroIndex(0);
        if (!useCarousel) return;
        const val = Number(selectedComponent.props?.heroInterval);
        const intervalMs = Number.isFinite(val) ? Math.min(10000, Math.max(1500, val)) : 4000;
        const id = setInterval(() => {
            setPreviewHeroIndex((idx) => (idx + 1) % slides.length);
        }, intervalMs);
        return () => clearInterval(id);
    }, [selectedComponent, heroSlidesDraft]);

    const loadData = async () => {
        try {
            const [storeRes, productsRes, plansRes, configsRes] = await Promise.all([
                getStore(storeId),
                getProducts(storeId),
                getSubscriptionPlans(storeId),
                getPageConfigs(storeId)
            ]);

            setStore(storeRes.data);
            setPageTitle(storeRes.data, 'Editor');
            setProducts(productsRes.data);
            setPlans(plansRes.data);

            const homeConfig = configsRes.data.find(c => c.page_name === 'home');
            if (homeConfig) {
                setPageConfig(homeConfig);
                setComponents(homeConfig.components || []);
                setIsPublished(homeConfig.is_published);
            } else {
                // Create default home page config
                const defaultComponents = [
                    { id: uuidv4(), type: 'header', props: { title: storeRes.data.name }, order: 0 },
                    { id: uuidv4(), type: 'hero', props: { title: 'Welcome', subtitle: 'Discover exquisite jewelry' }, order: 1 },
                    { id: uuidv4(), type: 'products', props: { title: 'Featured Products', limit: 4 }, order: 2 },
                    { id: uuidv4(), type: 'subscription_plans', props: { title: 'Gold Savings Plans' }, order: 3 },
                    { id: uuidv4(), type: 'footer', props: { text: `© 2025 ${storeRes.data.name}` }, order: 4 },
                ];
                setComponents(defaultComponents);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load page data');
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = components.findIndex(c => c.id === active.id);
            const newIndex = components.findIndex(c => c.id === over.id);
            setComponents(arrayMove(components, oldIndex, newIndex));
        }
    };

    const addComponent = (type) => {
        const newComponent = {
            id: uuidv4(),
            type,
            props: {},
            order: components.length
        };
        setComponents([...components, newComponent]);
        setSelectedComponent(newComponent);
    };

    const normalizeHeroSlides = (slides) => {
        const base = Array.isArray(slides) && slides.length > 0 ? slides : [{ image: '', category: '' }];
        return base.map((slide) => {
            if (typeof slide === 'string') return { image: slide, category: '', title: '', subtitle: '', titleColor: '' };
            return {
                image: slide?.image || '',
                category: slide?.category || '',
                title: slide?.title || '',
                subtitle: slide?.subtitle || '',
                titleColor: slide?.titleColor || '',
            };
        });
    };

    const updateComponentProps = (keyOrObj, value) => {
        if (!selectedComponent) return;
        const patch = typeof keyOrObj === 'object' ? keyOrObj : { [keyOrObj]: value };
        const updated = components.map((c) =>
            c.id === selectedComponent.id ? { ...c, props: { ...c.props, ...patch } } : c
        );
        setComponents(updated);
        setSelectedComponent({ ...selectedComponent, props: { ...selectedComponent.props, ...patch } });
    };

    const deleteComponent = (id) => {
        setComponents(components.filter(c => c.id !== id));
        if (selectedComponent?.id === id) setSelectedComponent(null);
    };

    const applyTheme = (theme) => {
        // Apply theme colors to all components
        const updatedComponents = components.map(c => ({
            ...c,
            props: {
                ...c.props,
                // Apply theme colors based on component type
                ...(c.type === 'header' || c.type === 'footer' 
                    ? { backgroundColor: theme.primaryColor, fontColor: '#ffffff' }
                    : {}),
                ...(c.type === 'hero' 
                    ? { backgroundColor: theme.primaryColor }
                    : {}),
            }
        }));
        setComponents(updatedComponents);
        setSelectedTheme(theme);
        toast.success(`Applied "${theme.name}" theme`);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const data = {
                page_name: 'home',
                components: components.map((c, i) => ({ ...c, order: i })),
                is_published: isPublished
            };

            if (pageConfig?.id) {
                await updatePageConfig(storeId, pageConfig.id, data);
            } else {
                const res = await createPageConfig(storeId, data);
                setPageConfig(res.data);
            }
            toast.success('Page saved successfully');
        } catch (error) {
            toast.error('Failed to save page');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col w-full overflow-x-hidden">
            {/* Header */}
            <header className="border-b bg-card sticky top-0 z-50 overflow-x-hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/store/${storeId}/admin`)} data-testid="back-btn">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                        <div className="min-w-0">
                            <h1 className="font-serif font-semibold truncate">Page Editor</h1>
                            <p className="text-sm text-muted-foreground truncate">{store?.name} - Home Page</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 border rounded-lg p-1">
                            <Button
                                variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setPreviewMode('desktop')}
                            >
                                <Monitor className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setPreviewMode('mobile')}
                            >
                                <Smartphone className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="publish" className="text-sm">Published</Label>
                            <Switch id="publish" checked={isPublished} onCheckedChange={setIsPublished} />
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowThemePanel(!showThemePanel)}
                            className={showThemePanel ? 'bg-accent' : ''}
                            data-testid="theme-btn"
                        >
                            <Palette className="w-4 h-4 mr-2" /> Themes
                        </Button>
                        <Link to={`/store/${storeId}`} target="_blank">
                            <Button variant="outline" size="sm" data-testid="preview-store-btn">
                                <Eye className="w-4 h-4 mr-2" /> Preview
                            </Button>
                        </Link>
                        <Button onClick={handleSave} disabled={saving} className="gold-gradient text-white" data-testid="save-page-btn">
                            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Theme Selection Panel */}
            {showThemePanel && (
                <div className="border-b bg-card p-4">
                    <div className="max-w-7xl mx-auto">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Palette className="w-4 h-4" /> Choose a Theme
                        </h3>
                        <div className="flex gap-4 overflow-x-auto pb-2">
                            {THEME_PRESETS.map((theme) => (
                                <button
                                    key={theme.id}
                                    onClick={() => applyTheme(theme)}
                                    className={`flex-shrink-0 p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                                        selectedTheme?.id === theme.id ? 'border-gold ring-2 ring-gold/30' : 'border-muted'
                                    }`}
                                    data-testid={`theme-${theme.id}`}
                                >
                                    <div className="flex gap-1 mb-2">
                                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
                                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                                    </div>
                                    <p className="text-sm font-medium">{theme.name}</p>
                                    <p className="text-xs text-muted-foreground">{theme.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Editor */}
            <div className="flex-1 flex">
                {/* Component Library */}
                <aside className="w-64 border-r bg-card">
                    <div className="p-4 border-b">
                        <h2 className="font-semibold">Components</h2>
                    </div>
                    <ScrollArea className="h-[calc(100vh-200px)]">
                        <div className="p-4 space-y-2">
                            {COMPONENT_TYPES.map(({ type, label, icon: Icon }) => (
                                <Button
                                    key={type}
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => addComponent(type)}
                                    data-testid={`add-${type}-btn`}
                                >
                                    <Icon className="w-4 h-4 mr-2" />
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </ScrollArea>
                </aside>

                {/* Canvas */}
                <main className={`flex-1 overflow-auto bg-muted/30 ${previewMode === 'mobile' ? 'flex justify-center' : ''}`}>
                    <div className={`${previewMode === 'mobile' ? 'w-[375px] bg-white shadow-xl my-4' : 'w-full'}`}>
                        {components.map((component) => (
                            <div
                                key={component.id}
                                className={`relative ${selectedComponent?.id === component.id ? 'ring-2 ring-gold ring-inset' : ''}`}
                                onClick={() => setSelectedComponent(component)}
                            >
                                <ComponentPreview component={component} products={products} plans={plans} />
                            </div>
                        ))}
                        {components.length === 0 && (
                            <div className="h-96 flex items-center justify-center text-muted-foreground">
                                <div className="text-center">
                                    <Plus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Add components from the left panel</p>
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {/* Properties Panel */}
                <aside className="w-80 border-l bg-card">
                    <div className="p-4 border-b">
                        <h2 className="font-semibold">Properties</h2>
                    </div>
                    <ScrollArea className="h-[calc(100vh-200px)]">
                        {selectedComponent ? (
                            <div className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium capitalize">{selectedComponent.type.replace('_', ' ')}</span>
                                    <Button variant="ghost" size="sm" onClick={() => deleteComponent(selectedComponent.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>

                                {/* Common Props */}
                                {['header', 'hero', 'text', 'card', 'products', 'subscription_plans', 'menu', 'map_link'].includes(selectedComponent.type) && (
                                    <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input
                                            value={selectedComponent.props?.title || ''}
                                            onChange={(e) => updateComponentProps('title', e.target.value)}
                                            data-testid="prop-title-input"
                                        />
                                    </div>
                                )}

                                {selectedComponent.type === 'header' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Logo URL</Label>
                                            <Input
                                                value={selectedComponent.props?.logoUrl || ''}
                                                onChange={(e) => updateComponentProps('logoUrl', e.target.value)}
                                                placeholder="https://example.com/logo.png"
                                            />
                                            <span className="text-xs text-muted-foreground">Optional custom logo URL</span>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Logo Scale</Label>
                                            <Input
                                                type="number"
                                                min="0.25"
                                                max="3"
                                                step="0.05"
                                                value={selectedComponent.props?.logoScale ?? ''}
                                                onChange={(e) => updateComponentProps('logoScale', e.target.value)}
                                                placeholder="1.0"
                                            />
                                            <span className="text-xs text-muted-foreground">Adjust logo size (1 = default)</span>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Show Logo</Label>
                                            <div className="flex items-center">
                                                <Switch
                                                    checked={selectedComponent.props?.showLogo !== false}
                                                    onCheckedChange={(v) => updateComponentProps('showLogo', v)}
                                                />
                                                <span className="ml-2 text-sm text-muted-foreground">Shows store logo if available</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Show Store Title</Label>
                                            <div className="flex items-center">
                                                <Switch
                                                    checked={selectedComponent.props?.showTitle !== false}
                                                    onCheckedChange={(v) => updateComponentProps('showTitle', v)}
                                                />
                                                <span className="ml-2 text-sm text-muted-foreground">Shows store name as text</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Show Search</Label>
                                            <div className="flex items-center">
                                                <Switch
                                                    checked={!!selectedComponent.props?.showSearch}
                                                    onCheckedChange={(v) => updateComponentProps('showSearch', !!v)}
                                                />
                                                <span className="ml-2 text-sm text-muted-foreground">Displays search bar in header</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Icon Color</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="color"
                                                    value={selectedComponent.props?.iconColor || '#ffffff'}
                                                    onChange={(e) => updateComponentProps('iconColor', e.target.value)}
                                                    className="w-12 h-10 p-1 cursor-pointer"
                                                />
                                                <Input
                                                    value={selectedComponent.props?.iconColor || ''}
                                                    onChange={(e) => updateComponentProps('iconColor', e.target.value)}
                                                    placeholder="#ffffff"
                                                    className="flex-1"
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">Color for Account, Cart, and Menu icons</p>
                                        </div>
                                    </>
                                )}

                                {selectedComponent.type === 'hero' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Subtitle</Label>
                                            <Input
                                                value={selectedComponent.props?.subtitle || ''}
                                                onChange={(e) => updateComponentProps('subtitle', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Button Text</Label>
                                            <Input
                                                value={selectedComponent.props?.buttonText || ''}
                                                onChange={(e) => updateComponentProps('buttonText', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Show Title</Label>
                                                <div className="flex items-center">
                                                    <Switch
                                                        checked={selectedComponent.props?.showHeroTitle !== false}
                                                        onCheckedChange={(v) => updateComponentProps('showHeroTitle', v)}
                                                    />
                                                    <span className="ml-2 text-sm text-muted-foreground">Toggle hero title visibility</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Show Subtitle</Label>
                                                <div className="flex items-center">
                                                    <Switch
                                                        checked={selectedComponent.props?.showHeroSubtitle !== false}
                                                        onCheckedChange={(v) => updateComponentProps('showHeroSubtitle', v)}
                                                    />
                                                    <span className="ml-2 text-sm text-muted-foreground">Toggle hero subtitle visibility</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Use Image Carousel</Label>
                                            <div className="flex items-center">
                                                <Switch
                                                    checked={!!selectedComponent.props?.heroCarousel}
                                                    onCheckedChange={(v) => updateComponentProps('heroCarousel', !!v)}
                                                />
                                                <span className="ml-2 text-sm text-muted-foreground">Scroll through multiple images</span>
                                            </div>
                                        </div>
                                        {selectedComponent.props?.heroCarousel ? (() => {
                                            const slides = heroSlidesDraft.length > 0
                                                ? heroSlidesDraft
                                                : [{ image: '', category: '' }];

                                            const setSlides = (nextSlides) => {
                                                const normalized = normalizeHeroSlides(nextSlides || []);
                                                setHeroSlidesDraft(normalized);
                                                updateComponentProps({
                                                    heroSlides: normalized,
                                                    heroImages: normalized.map((s) => s.image),
                                                });
                                            };

                                            return (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Carousel Images</Label>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            type="button"
                                                            onClick={() => setSlides([...slides, { image: '', category: '', title: '', subtitle: '', titleColor: '' }])}
                                                        >
                                                            + Add image
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {slides.map((slide, idx) => (
                                                            <div key={idx} className="space-y-3 border rounded-md p-3 bg-muted/40">
                                                                <div className="flex gap-2 items-center">
                                                                    <Input
                                                                        value={slide.image}
                                                                        onChange={(e) => {
                                                                            const next = [...slides];
                                                                            next[idx] = { ...(next[idx] || {}), image: e.target.value };
                                                                            setSlides(next);
                                                                        }}
                                                                        placeholder={`https://example.com/hero${idx + 1}.jpg`}
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                            const next = slides.filter((_, i) => i !== idx);
                                                                            setSlides(next);
                                                                        }}
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs">Title (optional)</Label>
                                                                        <Input
                                                                            value={slide.title || ''}
                                                                            onChange={(e) => {
                                                                                const next = [...slides];
                                                                                next[idx] = { ...(next[idx] || {}), title: e.target.value };
                                                                                setSlides(next);
                                                                            }}
                                                                            placeholder="e.g., New Arrivals"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs">Subtitle (optional)</Label>
                                                                        <Input
                                                                            value={slide.subtitle || ''}
                                                                            onChange={(e) => {
                                                                                const next = [...slides];
                                                                                next[idx] = { ...(next[idx] || {}), subtitle: e.target.value };
                                                                                setSlides(next);
                                                                            }}
                                                                            placeholder="e.g., Discover the latest collection"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label className="text-xs">Title Color (optional)</Label>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input
                                                                            type="color"
                                                                            value={slide.titleColor || '#ffffff'}
                                                                            onChange={(e) => {
                                                                                const next = [...slides];
                                                                                next[idx] = { ...(next[idx] || {}), titleColor: e.target.value };
                                                                                setSlides(next);
                                                                            }}
                                                                            className="w-12 h-10 p-1 cursor-pointer"
                                                                        />
                                                                        <Input
                                                                            value={slide.titleColor || ''}
                                                                            onChange={(e) => {
                                                                                const next = [...slides];
                                                                                next[idx] = { ...(next[idx] || {}), titleColor: e.target.value };
                                                                                setSlides(next);
                                                                            }}
                                                                            placeholder="#ffffff"
                                                                            className="flex-1"
                                                                        />
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground">Overrides the hero title color for this slide</p>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label className="text-xs">Category (optional)</Label>
                                                                    <Input
                                                                        value={slide.category || ''}
                                                                        onChange={(e) => {
                                                                            const next = [...slides];
                                                                            next[idx] = { ...(next[idx] || {}), category: e.target.value };
                                                                            setSlides(next);
                                                                        }}
                                                                        placeholder="e.g., Rings"
                                                                    />
                                                                    <p className="text-xs text-muted-foreground">If it matches a product category, clicking the slide will filter by it.</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Leave empty to fall back to single image</p>
                                                </div>
                                            );
                                        })() : (
                                            <div className="space-y-2">
                                                <Label>Background Image URL</Label>
                                                <Input
                                                    value={selectedComponent.props?.backgroundImage || ''}
                                                    onChange={(e) => updateComponentProps('backgroundImage', e.target.value)}
                                                    placeholder="https://example.com/hero.jpg"
                                                />
                                            </div>
                                        )}
                                        {selectedComponent.props?.heroCarousel && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Slide Interval (ms)</Label>
                                                    <Input
                                                        type="number"
                                                        min="1500"
                                                        max="10000"
                                                        step="250"
                                                        value={selectedComponent.props?.heroInterval ?? 4000}
                                                        onChange={(e) => updateComponentProps('heroInterval', Number(e.target.value) || 4000)}
                                                    />
                                                    <p className="text-xs text-muted-foreground">Time between slides (default 4000)</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Show Arrows</Label>
                                                    <div className="flex items-center">
                                                        <Switch
                                                            checked={selectedComponent.props?.heroArrows !== false}
                                                            onCheckedChange={(v) => updateComponentProps('heroArrows', v)}
                                                        />
                                                        <span className="ml-2 text-sm text-muted-foreground">Display next/prev controls</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Show Dots</Label>
                                                    <div className="flex items-center">
                                                        <Switch
                                                            checked={selectedComponent.props?.heroDots !== false}
                                                            onCheckedChange={(v) => updateComponentProps('heroDots', v)}
                                                        />
                                                        <span className="ml-2 text-sm text-muted-foreground">Show slide position indicators</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Preview */}
                                        <div className="mt-4 border rounded-md overflow-hidden bg-muted/40">
                                            <div className="relative h-48 flex items-center justify-center text-center text-white">
                                                {selectedComponent.props?.heroCarousel && heroSlidesDraft.length > 0 && heroSlidesDraft.some(s => s.image) ? (
                                                    <>
                                                        <div className="absolute inset-0">
                                                            {heroSlidesDraft.map((slide, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="absolute inset-0 transition-opacity duration-700"
                                                                    style={{
                                                                        backgroundImage: `url(${slide.image})`,
                                                                        backgroundSize: 'cover',
                                                                        backgroundPosition: 'center',
                                                                        opacity: idx === previewHeroIndex ? 1 : 0,
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                        {selectedComponent.props?.heroArrows !== false && heroSlidesDraft.filter(s => s.image).length > 1 && (
                                                            <div className="absolute inset-0 flex items-center justify-between px-3 z-10">
                                                                <button
                                                                    aria-label="Previous slide"
                                                                    onClick={() => setPreviewHeroIndex((idx) => (idx - 1 + heroSlidesDraft.length) % heroSlidesDraft.length)}
                                                                    className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                                                                >
                                                                    <span className="sr-only">Previous</span>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    aria-label="Next slide"
                                                                    onClick={() => setPreviewHeroIndex((idx) => (idx + 1) % heroSlidesDraft.length)}
                                                                    className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                                                                >
                                                                    <span className="sr-only">Next</span>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                        {selectedComponent.props?.heroDots !== false && heroSlidesDraft.filter(s => s.image).length > 1 && (
                                                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                                                                {heroSlidesDraft.map((_, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        aria-label={`Go to slide ${idx + 1}`}
                                                                        onClick={() => setPreviewHeroIndex(idx)}
                                                                        className={`h-2 w-2 rounded-full transition ${idx === previewHeroIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/80'}`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="absolute inset-0" style={{
                                                        backgroundImage: (() => {
                                                            const slides = heroSlidesDraft.length > 0
                                                                ? heroSlidesDraft
                                                                : (Array.isArray(selectedComponent.props?.heroSlides) && selectedComponent.props.heroSlides.length > 0
                                                                    ? selectedComponent.props.heroSlides
                                                                    : (Array.isArray(selectedComponent.props?.heroImages) && selectedComponent.props?.heroImages.length > 0
                                                                        ? selectedComponent.props.heroImages.map((img) => ({ image: img, category: '' }))
                                                                        : []));
                                                            const first = slides[0]?.image || selectedComponent.props?.backgroundImage;
                                                            return first ? `url(${first})` : 'linear-gradient(135deg, #D4AF37 0%, #F2D06B 50%, #B5942F 100%)';
                                                        })(),
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center'
                                                    }} />
                                                )}
                                                {selectedComponent.props?.heroCarousel && heroSlidesDraft.length > 0 && heroSlidesDraft.some(s => s.image) ? null : <div className="absolute inset-0 bg-black/40" />}
                                                <div className="relative px-4">
                                                    {(() => {
                                                        const s = (selectedComponent.props?.heroCarousel && heroSlidesDraft.length > 0 && heroSlidesDraft.some(sl => sl.image))
                                                            ? heroSlidesDraft[previewHeroIndex] || {}
                                                            : heroSlidesDraft[0] || {};
                                                        const slideTitle = (s.title || '').trim();
                                                        const style = s.titleColor ? { color: s.titleColor } : undefined;
                                                        if (slideTitle) {
                                                            return <div className="text-xl font-serif" style={style}>{slideTitle}</div>;
                                                        }
                                                        if (selectedComponent.props?.showHeroTitle !== false) {
                                                            return <div className="text-xl font-serif" style={style}>{selectedComponent.props?.title || 'Hero Title'}</div>;
                                                        }
                                                        return null;
                                                    })()}
                                                    {(() => {
                                                        const s = (selectedComponent.props?.heroCarousel && heroSlidesDraft.length > 0 && heroSlidesDraft.some(sl => sl.image))
                                                            ? heroSlidesDraft[previewHeroIndex] || {}
                                                            : heroSlidesDraft[0] || {};
                                                        const slideSubtitle = (s.subtitle || '').trim();
                                                        if (slideSubtitle) {
                                                            return <div className="text-sm text-white/80 mt-1">{slideSubtitle}</div>;
                                                        }
                                                        if (selectedComponent.props?.showHeroSubtitle !== false) {
                                                            return <div className="text-sm text-white/80 mt-1">{selectedComponent.props?.subtitle || 'Hero subtitle'}</div>;
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {selectedComponent.type === 'map_link' && (
                                    <>
                                        <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                                            <Label className="text-sm font-semibold">Page Visibility</Label>
                                            <div className="space-y-2">
                                                <div className="flex items-center">
                                                    <Switch
                                                        checked={selectedComponent.props?.visible_home !== false}
                                                        onCheckedChange={(v) => updateComponentProps('visible_home', v)}
                                                        data-testid="prop-map-visible-home-switch"
                                                    />
                                                    <span className="ml-2 text-sm text-muted-foreground">Show on Home Page</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <Switch
                                                        checked={selectedComponent.props?.visible_contact !== false}
                                                        onCheckedChange={(v) => updateComponentProps('visible_contact', v)}
                                                        data-testid="prop-map-visible-contact-switch"
                                                    />
                                                    <span className="ml-2 text-sm text-muted-foreground">Show on Contact Page</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Subtitle</Label>
                                            <Input
                                                value={selectedComponent.props?.subtitle || ''}
                                                onChange={(e) => updateComponentProps('subtitle', e.target.value)}
                                                placeholder="e.g., Click to view our location"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Google Maps Embed URL</Label>
                                            <Input
                                                value={selectedComponent.props?.embed_url || ''}
                                                onChange={(e) => updateComponentProps('embed_url', e.target.value)}
                                                placeholder="https://www.google.com/maps/embed?pb=..."
                                                data-testid="prop-map-embed-url-input"
                                            />
                                            <p className="text-xs text-muted-foreground">Paste the embed URL (opens inside the page)</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Height (px)</Label>
                                            <Input
                                                type="number"
                                                min={200}
                                                max={800}
                                                value={selectedComponent.props?.height ?? ''}
                                                onChange={(e) => updateComponentProps('height', parseInt(e.target.value || '0'))}
                                                placeholder="360"
                                            />
                                            <p className="text-xs text-muted-foreground">Adjust the embedded map height</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Fallback Google Maps URL</Label>
                                            <Input
                                                value={selectedComponent.props?.map_url || ''}
                                                onChange={(e) => updateComponentProps('map_url', e.target.value)}
                                                placeholder="https://maps.google.com/?q=Your+Address"
                                                data-testid="prop-map-url-input"
                                            />
                                            <p className="text-xs text-muted-foreground">Optional: used if embed URL is not set</p>
                                        </div>
                                    </>
                                )}

                                {selectedComponent.type === 'text' && (
                                    <div className="space-y-2">
                                        <Label>Content</Label>
                                        <textarea
                                            className="w-full min-h-[100px] p-2 border rounded-md"
                                            value={selectedComponent.props?.content || ''}
                                            onChange={(e) => updateComponentProps('content', e.target.value)}
                                        />
                                    </div>
                                )}

                                {selectedComponent.type === 'grid' && (
                                    <div className="space-y-2">
                                        <Label>Columns (1-12)</Label>
                                        <Select
                                            value={String(selectedComponent.props?.columns || 3)}
                                            onValueChange={(v) => updateComponentProps('columns', parseInt(v))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[1, 2, 3, 4, 5, 6, 12].map(n => (
                                                    <SelectItem key={n} value={String(n)}>{n} columns</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {selectedComponent.type === 'products' && (
                                    <div className="space-y-2">
                                        <Label>Products to Show</Label>
                                        <Select
                                            value={String(selectedComponent.props?.limit || 4)}
                                            onValueChange={(v) => updateComponentProps('limit', parseInt(v))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[4, 6, 8, 12].map(n => (
                                                    <SelectItem key={n} value={String(n)}>{n} products</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {selectedComponent.type === 'products' && (
                                    <div className="space-y-2">
                                        <Label>Featured Only</Label>
                                        <div className="flex items-center">
                                            <Switch
                                                checked={!!selectedComponent.props?.featuredOnly}
                                                onCheckedChange={(v) => updateComponentProps('featuredOnly', !!v)}
                                            />
                                            <span className="ml-2 text-sm text-muted-foreground">Show only products marked as featured</span>
                                        </div>

                                        <Label>Max Items (1-100)</Label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={selectedComponent.props?.limit || 4}
                                            onChange={(e) => {
                                                const raw = parseInt(e.target.value) || 1;
                                                const clamped = Math.max(1, Math.min(100, raw));
                                                updateComponentProps('limit', clamped);
                                            }}
                                            className="w-full p-2 border rounded-md"
                                        />
                                    </div>
                                )}

                                {selectedComponent.type === 'scrolling_text' && (
                                    <div className="space-y-2">
                                        <Label>Scrolling Text</Label>
                                        <Input
                                            value={selectedComponent.props?.text || ''}
                                            onChange={(e) => updateComponentProps('text', e.target.value)}
                                        />
                                    </div>
                                )}

                                {selectedComponent.type === 'footer' && (
                                    <div className="space-y-2">
                                        <Label>Footer Text</Label>
                                        <Input
                                            value={selectedComponent.props?.text || ''}
                                            onChange={(e) => updateComponentProps('text', e.target.value)}
                                        />
                                    </div>
                                )}

                                {selectedComponent.type === 'divider' && (
                                    <div className="space-y-2">
                                        <Label>Height (pixels)</Label>
                                        <Select
                                            value={String(selectedComponent.props?.height || 8)}
                                            onValueChange={(v) => updateComponentProps('height', parseInt(v))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[4, 8, 12, 16, 24, 32].map(n => (
                                                    <SelectItem key={n} value={String(n)}>{n}px</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Common Styling Properties for ALL components */}
                                <div className="border-t pt-4 mt-4">
                                    <h4 className="font-medium text-sm mb-3 text-muted-foreground">Styling Properties</h4>
                                    
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Scale</Label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="range"
                                                    min="50"
                                                    max="150"
                                                    value={selectedComponent.props?.scale || 100}
                                                    onChange={(e) => updateComponentProps('scale', parseInt(e.target.value))}
                                                    className="flex-1"
                                                />
                                                <span className="text-sm w-12 text-right">{selectedComponent.props?.scale || 100}%</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Opacity</Label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={selectedComponent.props?.opacity || 100}
                                                    onChange={(e) => updateComponentProps('opacity', parseInt(e.target.value))}
                                                    className="flex-1"
                                                />
                                                <span className="text-sm w-12 text-right">{selectedComponent.props?.opacity || 100}%</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Padding</Label>
                                            <Select
                                                value={String(selectedComponent.props?.padding || 0)}
                                                onValueChange={(v) => updateComponentProps('padding', parseInt(v))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">None</SelectItem>
                                                    <SelectItem value="8">Small (8px)</SelectItem>
                                                    <SelectItem value="16">Medium (16px)</SelectItem>
                                                    <SelectItem value="24">Large (24px)</SelectItem>
                                                    <SelectItem value="32">XL (32px)</SelectItem>
                                                    <SelectItem value="48">2XL (48px)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Margin</Label>
                                            <Select
                                                value={String(selectedComponent.props?.margin || 0)}
                                                onValueChange={(v) => updateComponentProps('margin', parseInt(v))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">None</SelectItem>
                                                    <SelectItem value="8">Small (8px)</SelectItem>
                                                    <SelectItem value="16">Medium (16px)</SelectItem>
                                                    <SelectItem value="24">Large (24px)</SelectItem>
                                                    <SelectItem value="32">XL (32px)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Background Color</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="color"
                                                    value={selectedComponent.props?.backgroundColor || '#ffffff'}
                                                    onChange={(e) => updateComponentProps('backgroundColor', e.target.value)}
                                                    className="w-12 h-10 p-1 cursor-pointer"
                                                />
                                                <Input
                                                    value={selectedComponent.props?.backgroundColor || ''}
                                                    onChange={(e) => updateComponentProps('backgroundColor', e.target.value)}
                                                    placeholder="transparent"
                                                    className="flex-1"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Font/Text Color</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="color"
                                                    value={selectedComponent.props?.fontColor || '#000000'}
                                                    onChange={(e) => updateComponentProps('fontColor', e.target.value)}
                                                    className="w-12 h-10 p-1 cursor-pointer"
                                                />
                                                <Input
                                                    value={selectedComponent.props?.fontColor || ''}
                                                    onChange={(e) => updateComponentProps('fontColor', e.target.value)}
                                                    placeholder="inherit"
                                                    className="flex-1"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Border Radius</Label>
                                            <Select
                                                value={String(selectedComponent.props?.borderRadius || 0)}
                                                onValueChange={(v) => updateComponentProps('borderRadius', parseInt(v))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">None</SelectItem>
                                                    <SelectItem value="4">Small (4px)</SelectItem>
                                                    <SelectItem value="8">Medium (8px)</SelectItem>
                                                    <SelectItem value="16">Large (16px)</SelectItem>
                                                    <SelectItem value="24">XL (24px)</SelectItem>
                                                    <SelectItem value="9999">Full</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Shadow</Label>
                                            <Select
                                                value={selectedComponent.props?.shadow || 'none'}
                                                onValueChange={(v) => updateComponentProps('shadow', v)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    <SelectItem value="sm">Small</SelectItem>
                                                    <SelectItem value="md">Medium</SelectItem>
                                                    <SelectItem value="lg">Large</SelectItem>
                                                    <SelectItem value="xl">Extra Large</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Visual Effect</Label>
                                            <Select
                                                value={selectedComponent.props?.effect || 'none'}
                                                onValueChange={(v) => updateComponentProps('effect', v)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    <SelectItem value="elevated">Elevated / Floating</SelectItem>
                                                    <SelectItem value="glass">Glass / Frosted</SelectItem>
                                                    <SelectItem value="glow">Subtle Glow</SelectItem>
                                                    <SelectItem value="tilt">Tilt / Interactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Entrance Animation</Label>
                                            <Select
                                                value={selectedComponent.props?.animation || 'none'}
                                                onValueChange={(v) => updateComponentProps('animation', v)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    <SelectItem value="pulse">Pulse</SelectItem>
                                                    <SelectItem value="pop">Pop / Scale</SelectItem>
                                                    <SelectItem value="slide">Slide In</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 text-center text-muted-foreground">
                                Select a component to edit its properties
                            </div>
                        )}
                    </ScrollArea>

                    {/* Component Order */}
                    <div className="border-t p-4">
                        <h3 className="font-semibold mb-3">Component Order</h3>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={components.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1">
                                    {components.map((component) => (
                                        <SortableComponent
                                            key={component.id}
                                            component={component}
                                            onSelect={setSelectedComponent}
                                            selected={selectedComponent?.id === component.id}
                                            onDelete={deleteComponent}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default PageEditor;
