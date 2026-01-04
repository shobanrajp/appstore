import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStore, getSubscriptionPlans, subscribeToPlan } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Clock, Calendar, CreditCard } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';

const StorePlans = () => {
    const { storeId } = useParams();
    const { user } = useAuth();
    const [store, setStore] = useState(null);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recentlyViewed, setRecentlyViewed] = useState([]);
    const [subscribeOpen, setSubscribeOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [chosenMonthlyAmount, setChosenMonthlyAmount] = useState('');
    const [cart, setCart] = useState(() => {
        const saved = localStorage.getItem(`cart_${storeId}`);
        return saved ? JSON.parse(saved) : [];
    });

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
        trackPlanView(plan);
        if (!user) {
            toast.error('Please login to subscribe');
            return;
        }
        setSelectedPlan(plan);
        setChosenMonthlyAmount(plan.min_amount?.toString() || '');
        setSubscribeOpen(true);
    };

    const handleSubscribe = async () => {
        if (!selectedPlan || !chosenMonthlyAmount) return;
        const amount = parseFloat(chosenMonthlyAmount);
        if (selectedPlan.min_amount && amount < selectedPlan.min_amount) {
            toast.error(`Minimum amount is ${formatCurrency(selectedPlan.min_amount, store?.currency)}`);
            return;
        }
        if (selectedPlan.max_amount && amount > selectedPlan.max_amount) {
            toast.error(`Maximum amount is ${formatCurrency(selectedPlan.max_amount, store?.currency)}`);
            return;
        }
        try {
            await subscribeToPlan(storeId, selectedPlan.id, amount);
            toast.success('Subscribed successfully!');
            setSubscribeOpen(false);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to subscribe');
        }
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <StoreHeader store={store} storeId={storeId} cartTotal={cartTotal} activeTab="plans" />

            <main className="max-w-7xl mx-auto px-4 py-8 flex-1">
                {/* Recently Viewed Plans */}
                {recentlyViewed.length > 0 && (
                    <section className="mb-12">
                        <h2 className="text-2xl font-serif mb-6 flex items-center gap-2">
                            <Clock className="w-5 h-5" /> Recently Viewed
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {recentlyViewed.map((plan) => (
                                <Card key={plan.id} className="luxury-card border-gold/20">
                                    <CardHeader>
                                        <CardTitle className="font-serif">{plan.name}</CardTitle>
                                        <CardDescription>{plan.plan_type}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                            <Calendar className="w-4 h-4" />
                                            <span>{plan.duration_months} months</span>
                                        </div>
                                        {(plan.min_amount || plan.max_amount) && (
                                            <p className="text-sm text-muted-foreground mb-4">
                                                {plan.min_amount && `Min: ${formatCurrency(plan.min_amount, store?.currency)}`}
                                                {plan.min_amount && plan.max_amount && ' - '}
                                                {plan.max_amount && `Max: ${formatCurrency(plan.max_amount, store?.currency)}`}
                                            </p>
                                        )}
                                        <Button className="w-full gold-gradient text-white" onClick={() => openSubscribeDialog(plan)}>
                                            Subscribe Now
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                )}

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
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <Calendar className="w-5 h-5" />
                                                <span className="text-lg">{plan.duration_months} months duration</span>
                                            </div>
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
                                            <CreditCard className="w-4 h-4 mr-2" /> Subscribe Now
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            {/* Subscribe Dialog */}
            <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Subscribe to {selectedPlan?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <Label>Plan Type</Label>
                            <p className="text-muted-foreground">{selectedPlan?.plan_type}</p>
                        </div>
                        <div>
                            <Label>Duration</Label>
                            <p className="text-muted-foreground">{selectedPlan?.duration_months} months</p>
                        </div>
                        <div>
                            <Label>Your Monthly Amount ({store?.currency || 'INR'})</Label>
                            <Input
                                type="number"
                                value={chosenMonthlyAmount}
                                onChange={(e) => setChosenMonthlyAmount(e.target.value)}
                                placeholder={`Min: ${selectedPlan?.min_amount || 0}`}
                                min={selectedPlan?.min_amount || 0}
                                max={selectedPlan?.max_amount || undefined}
                            />
                            {selectedPlan?.min_amount && selectedPlan?.max_amount && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Range: {formatCurrency(selectedPlan.min_amount, store?.currency)} - {formatCurrency(selectedPlan.max_amount, store?.currency)}
                                </p>
                            )}
                        </div>
                        {chosenMonthlyAmount && selectedPlan?.duration_months && (
                            <div className="bg-muted/50 rounded-lg p-4">
                                <p className="text-sm text-muted-foreground">Total savings over {selectedPlan.duration_months} months:</p>
                                <p className="text-2xl font-bold gold-text">
                                    {formatCurrency(parseFloat(chosenMonthlyAmount) * selectedPlan.duration_months, store?.currency)}
                                </p>
                            </div>
                        )}
                        <Button onClick={handleSubscribe} className="w-full gold-gradient text-white">
                            Confirm Subscription
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            
            <StoreFooter store={store} storeId={storeId} />
        </div>
    );
};

export default StorePlans;
