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
import {
    ArrowLeft, Save, Eye, Layout, Type, Image, Grid3X3, Columns, Square, 
    Menu, ListOrdered, ChevronDown, SeparatorHorizontal, Trash2, GripVertical,
    Monitor, Smartphone, Plus
} from 'lucide-react';

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

    const wrapperStyle = getStyleFromProps();

    switch (type) {
        case 'header':
            return (
                <header className="bg-primary text-primary-foreground p-4" style={wrapperStyle}>
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <h1 className="text-2xl font-serif">{props.title || 'Store Name'}</h1>
                        <nav className="flex gap-4">
                            {(props.menuItems || ['Home', 'Products', 'Plans', 'Contact']).map((item, i) => (
                                <span key={i} className="hover:opacity-80 cursor-pointer">{item}</span>
                            ))}
                        </nav>
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
                    className="relative h-80 bg-cover bg-center flex items-center justify-center"
                    style={{ 
                        backgroundImage: props.backgroundImage ? `url(${props.backgroundImage})` : 'linear-gradient(135deg, #D4AF37 0%, #F2D06B 50%, #B5942F 100%)',
                        ...wrapperStyle 
                    }}
                >
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="relative text-center text-white">
                        <h1 className="text-5xl font-serif mb-4">{props.title || 'Welcome to Our Store'}</h1>
                        <p className="text-xl mb-6">{props.subtitle || 'Discover exquisite jewelry'}</p>
                        <Button className="gold-gradient text-white">{props.buttonText || 'Shop Now'}</Button>
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
                <Card className="max-w-sm mx-auto my-4 luxury-card" style={wrapperStyle}>
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
                <div className="py-8 px-4" style={wrapperStyle}>
                    <h2 className="text-3xl font-serif text-center mb-8">{props.title || 'Featured Products'}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                        {products.slice(0, props.limit || 4).map((product) => (
                            <Card key={product.id} className="luxury-card overflow-hidden">
                                <div className="h-48 bg-muted flex items-center justify-center">
                                    {product.images?.[0] ? (
                                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-muted-foreground">No Image</span>
                                    )}
                                </div>
                                <CardContent className="p-4">
                                    <h3 className="font-serif font-semibold">{product.name}</h3>
                                    <p className="gold-text font-semibold">₹{product.price.toLocaleString()}</p>
                                </CardContent>
                            </Card>
                        ))}
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
                <div className="py-12 px-4 bg-muted/30" style={wrapperStyle}>
                    <h2 className="text-3xl font-serif text-center mb-8">{props.title || 'Gold Savings Plans'}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {plans.map((plan) => (
                            <Card key={plan.id} className="luxury-card">
                                <CardHeader>
                                    <div className="gold-gradient text-white text-xs px-2 py-1 rounded w-fit mb-2">
                                        {plan.plan_type === 'gold_flexi' ? 'Gold Flexi' : 'Silver Flexi'}
                                    </div>
                                    <CardTitle className="font-serif">{plan.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-serif gold-text mb-2">
                                        ₹{plan.monthly_amount.toLocaleString()}<span className="text-sm text-muted-foreground">/month</span>
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
        case 'menu':
            return (
                <nav className="bg-card border-y py-2" style={wrapperStyle}>
                    <div className="max-w-7xl mx-auto flex items-center justify-center gap-8">
                        {(props.categories || ['Necklaces', 'Rings', 'Earrings', 'Bangles', 'Chains']).map((cat, i) => (
                            <span key={i} className="hover:gold-text cursor-pointer transition-colors">{cat}</span>
                        ))}
                    </div>
                </nav>
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

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    useEffect(() => {
        loadData();
    }, [storeId]);

    const loadData = async () => {
        try {
            const [storeRes, productsRes, plansRes, configsRes] = await Promise.all([
                getStore(storeId),
                getProducts(storeId),
                getSubscriptionPlans(storeId),
                getPageConfigs(storeId)
            ]);

            setStore(storeRes.data);
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

    const updateComponentProps = (key, value) => {
        if (!selectedComponent) return;
        const updated = components.map(c =>
            c.id === selectedComponent.id ? { ...c, props: { ...c.props, [key]: value } } : c
        );
        setComponents(updated);
        setSelectedComponent({ ...selectedComponent, props: { ...selectedComponent.props, [key]: value } });
    };

    const deleteComponent = (id) => {
        setComponents(components.filter(c => c.id !== id));
        if (selectedComponent?.id === id) setSelectedComponent(null);
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
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="border-b bg-card sticky top-0 z-50">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/store-admin')} data-testid="back-btn">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                        <div>
                            <h1 className="font-serif font-semibold">Page Editor</h1>
                            <p className="text-sm text-muted-foreground">{store?.name} - Home Page</p>
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
                                {['header', 'hero', 'text', 'card', 'products', 'subscription_plans', 'menu'].includes(selectedComponent.type) && (
                                    <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input
                                            value={selectedComponent.props?.title || ''}
                                            onChange={(e) => updateComponentProps('title', e.target.value)}
                                            data-testid="prop-title-input"
                                        />
                                    </div>
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
                                        <div className="space-y-2">
                                            <Label>Background Image URL</Label>
                                            <Input
                                                value={selectedComponent.props?.backgroundImage || ''}
                                                onChange={(e) => updateComponentProps('backgroundImage', e.target.value)}
                                            />
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
