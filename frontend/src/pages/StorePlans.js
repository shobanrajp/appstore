import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStore, getSubscriptionPlans } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { Clock, Calendar } from 'lucide-react';
import { formatCurrency, setPageTitle } from '../lib/utils';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import { useCart } from '../context/CartContext';

const StorePlans = () => {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const { cartCount } = useCart(storeId);
    const [store, setStore] = useState(null);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recentlyViewed, setRecentlyViewed] = useState([]);

    useEffect(() => {
        loadData();
    }, [storeId]);

    useEffect(() => {
        // Load recently viewed plans
        const recentKey = `recent_plans_${storeId}`;
        const recentIds = JSON.parse(localStorage.getItem(recentKey) || '[]');
        const recentPlansList = recentIds.map(id => plans.find(p => p.id === id)).filter(Boolean);
        setRecentlyViewed(recentPlansList);
    }, [plans, storeId]);

    const loadData = async () => {
        try {
            const [storeRes, plansRes] = await Promise.all([
                getStore(storeId),
                getSubscriptionPlans(storeId)
            ]);
            setStore(storeRes.data);
            setPageTitle(storeRes.data, 'Plans');
            setPlans(plansRes.data);
        } catch (error) {
            toast.error('Failed to load plans');
        } finally {
            setLoading(false);
        }
    };

    const trackPlanView = (plan) => {
        const recentKey = `recent_plans_${storeId}`;
        const recent = JSON.parse(localStorage.getItem(recentKey) || '[]');
        const filtered = recent.filter(id => id !== plan.id);
        const updated = [plan.id, ...filtered].slice(0, 5);
        localStorage.setItem(recentKey, JSON.stringify(updated));
    };

    const openSubscribeDialog = (plan) => {
        if (!plan) return;
        trackPlanView(plan);
        navigate(`/store/${storeId}/plan/${plan.id}`);
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
            <StoreHeader store={store} storeId={storeId} cartTotal={cartCount} activeTab="plans" />

            <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full box-sizing-border-box">
                {/* All Plans */}
                <section>
                    <h2 className="text-3xl font-serif text-center mb-8">Subscription Plans</h2>
                    <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
                        Choose a savings plan that suits your needs. Set your own monthly contribution amount within the plan limits.
                    </p>
                    
                    {plans.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No subscription plans available yet.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plans.map((plan) => (
                                <Card key={plan.id} className="luxury-card hover:shadow-lg transition-shadow">
                                    <CardHeader className="text-center pb-2">
                                        <CardTitle className="font-serif text-2xl">{plan.name}</CardTitle>
                                        <CardDescription className="text-base">{plan.plan_type}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="text-center">
                                            {plan.scheme_type !== 'flexible' && (
                                                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                    <Calendar className="w-5 h-5" />
                                                    <span className="text-lg">{plan.duration_months} months duration</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {(plan.min_amount || plan.max_amount) && (
                                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                                                <p className="text-sm text-muted-foreground mb-1">Monthly contribution range</p>
                                                <p className="text-lg font-semibold gold-text">
                                                    {plan.min_amount ? formatCurrency(plan.min_amount, store?.currency) : '—'}
                                                    {' to '}
                                                    {plan.max_amount ? formatCurrency(plan.max_amount, store?.currency) : '—'}
                                                </p>
                                            </div>
                                        )}
                                        
                                        {plan.description && (
                                            <p className="text-sm text-muted-foreground text-center">{plan.description}</p>
                                        )}
                                        
                                        <Button 
                                            className="w-full gold-gradient text-white mt-4" 
                                            onClick={() => openSubscribeDialog(plan)}
                                        >
                                            View Plan
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
            </main>
            <StoreFooter store={store} storeId={storeId} />
        </div>
    );
};

export default StorePlans;
