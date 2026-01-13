import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStore, getSubscriptionPlans, subscribeToPlan, getMarketPrices, getStoreTaxConfig } from '../lib/api';
import { createRazorpayPayment } from '../lib/razorpay';
import { formatCurrency, setPageTitle } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import LoadingOverlay from '../components/LoadingOverlay';
import { useCart } from '../context/CartContext';

const clampNumber = (val, min, max) => {
    const safeVal = Number.isFinite(val) ? val : min;
    if (max !== undefined && max !== null) return Math.min(Math.max(safeVal, min), max);
    return Math.max(safeVal, min);
};

const PlanDetail = () => {
    const { storeId, planId } = useParams();
    const navigate = useNavigate();
    const { cartCount } = useCart(storeId);
    const { user } = useAuth();
    const [store, setStore] = useState(null);
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [amount, setAmount] = useState(0);
    const [months, setMonths] = useState(0);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [marketPrices, setMarketPrices] = useState(null);
    const [taxConfig, setTaxConfig] = useState(null);

    const minAmount = useMemo(() => Number(plan?.min_amount) || 500, [plan]);
    const maxAmount = useMemo(() => Number(plan?.max_amount) || 100000, [plan]);
    const maxMonths = useMemo(() => Number(plan?.duration_months) || 11, [plan]);

    const normalizedAmount = useMemo(() => {
        const val = Number(amount);
        return Number.isFinite(val) ? val : 0;
    }, [amount]);
    const normalizedMonths = useMemo(() => clampNumber(Number(months), 1, maxMonths), [months, maxMonths]);

    const isAmountValid = useMemo(() => {
        return normalizedAmount >= minAmount && normalizedAmount <= maxAmount;
    }, [normalizedAmount, minAmount, maxAmount]);

    const amountError = useMemo(() => {
        if (!store) return null;
        if (normalizedAmount < minAmount) return `Minimum amount is ${formatCurrency(minAmount, store.currency)}`;
        if (normalizedAmount > maxAmount) return `Maximum amount is ${formatCurrency(maxAmount, store.currency)}`;
        return null;
    }, [normalizedAmount, minAmount, maxAmount, store]);

    const estimatedGrams = useMemo(() => {
        if (!marketPrices || !normalizedAmount || !plan) return '0.000';
        
        const metal = (plan.target_metal || 'gold').toLowerCase();
        let price = 0;

        // Map metal type to market price key
        if (metal === 'gold') {
            price = Number(marketPrices.gold_24 || marketPrices.gold_22 || 0);
        } else if (metal === 'silver') {
            price = Number(marketPrices.silver_1g || 0);
        } else if (metal === 'platinum') {
            price = Number(marketPrices.platinum_1g || 0);
        }

        if (!price) return '0.000';
        const taxRate = taxConfig?.gst_rate || 3;
        const cost = normalizedAmount / (1 + taxRate / 100);
        return (cost / price).toFixed(4);
    }, [normalizedAmount, marketPrices, plan, taxConfig]);

    const maturityValue = useMemo(() => {
        const totalContribution = normalizedAmount * normalizedMonths;
        const freeMonth = normalizedAmount; // Last month waiver
        return {
            totalContribution,
            bonusValue: freeMonth,
            maturity: totalContribution + freeMonth
        };
    }, [normalizedAmount, normalizedMonths]);

    const proceedToSubscribe = async () => {
        if (!plan) return;

        if (!user) {
            toast.error('Please login to subscribe');
            navigate(`/store/${storeId}/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }

        if (!store || !store.razorpay_key_id) {
            const errorMsg = 'Payment gateway not configured for this store. Please visit: /RAZORPAY_SETUP.md for configuration instructions.';
            toast.error('Payment gateway not configured');
            console.error('[PlanDetail] Razorpay not configured:', { store, hasKey: !!store?.razorpay_key_id, errorMsg });
            return;
        }

        const amountValue = normalizedAmount;
        if (amountValue < minAmount || amountValue > maxAmount) {
            toast.error(`Please enter an amount between ${formatCurrency(minAmount, store.currency)} and ${formatCurrency(maxAmount, store.currency)}`);
            return;
        }

        setProcessingPayment(true);

        try {
            // Create subscription first
            const subRes = await subscribeToPlan(storeId, {
                plan_id: plan.id,
                monthly_amount: amountValue
            });

            console.log('[PlanDetail] Subscription created:', subRes.data);

            // Create payment using the new Razorpay utility
            await createRazorpayPayment(
                {
                    amount: amountValue,
                    description: `${plan.name} - First Installment`,
                    store_id: storeId,
                    subscription_id: subRes.data.id,
                    order_id: subRes.data.order_id
                },
                {
                    name: store.name || 'Store',
                    description: `${plan.name} - First Installment`,
                    prefill: {
                        name: user.name,
                        email: user.email,
                        contact: user.phone
                    },
                    theme: {
                        color: store.settings?.primary_color || '#D4AF37'
                    },
                    onSuccess: (response, orderData) => {
                        toast.success('Subscribed successfully! First payment completed.');
                        navigate(`/store/${storeId}/portal?tab=subscriptions`);
                    },
                    onError: (error) => {
                        console.error('Payment failed:', error);
                        toast.error(error?.description || error?.message || 'Payment failed');
                        setProcessingPayment(false);
                    },
                    onCancel: () => {
                        setProcessingPayment(false);
                        toast.info('Payment cancelled');
                    }
                }
            );

        } catch (error) {
            console.error('[PlanDetail] Subscription/payment failed:', error);
            setProcessingPayment(false);
            toast.error(error?.response?.data?.detail || error?.message || 'Subscription failed');
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [storeRes, plansRes, pricesRes, taxRes] = await Promise.all([
                getStore(storeId),
                getSubscriptionPlans(storeId),
                getMarketPrices(storeId).catch(() => ({ data: { prices: {} } })),
                getStoreTaxConfig(storeId).catch(() => ({ data: null }))
            ]);
            const planList = plansRes.data || [];
            const match = planList.find((p) => p.id?.toString() === planId?.toString());
            
            setMarketPrices(pricesRes.data?.prices || {});
            setTaxConfig(taxRes.data);

            setStore(storeRes.data);
            setPageTitle(storeRes.data, match ? match.name : 'Plan Detail');
            if (match) {
                setPlan(match);
                setAmount(match.min_amount || 500);
                setMonths(match.duration_months || 11);
            } else {
                toast.error('Plan not found');
            }
        } catch (error) {
            toast.error('Failed to load plan details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeId, planId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
            </div>
        );
    }

    if (!plan || !store) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <Card className="max-w-md w-full text-center">
                    <CardHeader>
                        <CardTitle className="font-serif">Plan unavailable</CardTitle>
                        <CardDescription>We could not find the plan you were looking for.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-center gap-3">
                            <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
                            <Button onClick={() => navigate(`/store/${storeId}/plans`)}>View all plans</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <StoreHeader store={store} storeId={storeId} cartTotal={cartCount} activeTab="plans" />

            <main className="flex-1">
                <section className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
                    <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-8 items-center">
                        <div className="space-y-4">
                            {plan.scheme_type !== 'flexible' && <Badge className="gold-gradient text-white w-fit">1 month free</Badge>}
                            <h1 className="text-4xl font-serif leading-tight">{plan.name}</h1>
                            <p className="text-muted-foreground text-lg">{plan.description || 'Flexible monthly plan to lock today\'s gold rate and earn a free last installment.'}</p>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white shadow-sm border">
                                    <span className="text-gold font-semibold">{formatCurrency(plan.min_amount || 500, store.currency)}</span>
                                    <span>minimum monthly</span>
                                </div>
                                {plan.scheme_type !== 'flexible' && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white shadow-sm border">
                                        <span className="text-gold font-semibold">{plan.duration_months || 11}</span>
                                        <span>month tenure</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white shadow-sm border">
                                    <span className="text-gold font-semibold">{formatCurrency(plan.max_amount || 100000, store.currency)}</span>
                                    <span>max monthly</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button className="gold-gradient text-white" onClick={proceedToSubscribe} disabled={processingPayment}>Start subscription</Button>
                                <Button variant="outline" onClick={() => navigate(`/store/${storeId}/plans`)}>Explore other plans</Button>
                            </div>
                        </div>
                        <Card className="shadow-xl">
                            <CardContent className="p-6 space-y-4">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-serif text-gold">{formatCurrency(plan.min_amount || 500, store.currency)}</span>
                                    {plan.scheme_type !== 'flexible' && <span className="text-muted-foreground">starts at / month</span>}
                                </div>
                                {plan.scheme_type !== 'flexible' && (
                                    <>
                                        <p className="text-sm text-muted-foreground">Join today and get your last month waived automatically.</p>
                                        <Separator />
                                        <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                                            <div>
                                                <div className="text-foreground font-semibold">{plan.duration_months || 11} months</div>
                                                <div>Flexible purchase plan</div>
                                            </div>
                                            <div>
                                                <div className="text-foreground font-semibold">Free last installment</div>
                                                <div>No hidden fees</div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <section className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-2 gap-10">
                    <Card className="shadow-xl">
                        <CardHeader>
                            <CardTitle className="font-serif text-2xl">
                                {plan.scheme_type === 'flexible' ? 'Start Investing' : 'Plan calculator'}
                            </CardTitle>
                            <CardDescription>
                                {plan.scheme_type === 'flexible'
                                    ? 'Enter your initial amount. You can pay any amount subsequently.'
                                    : 'Adjust your monthly deposit and tenure to see your maturity value. Last month is free.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>{plan.scheme_type === 'flexible' ? 'Initial Payment' : 'Monthly deposit'}</span>
                                    <span className="text-foreground font-medium">{formatCurrency(normalizedAmount, store.currency)}</span>
                                </div>
                                <Input
                                    type="number"
                                    value={amount}
                                    min={minAmount}
                                    max={maxAmount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Min {formatCurrency(minAmount, store.currency)}</span>
                                    <span>Max {formatCurrency(maxAmount, store.currency)}</span>
                                </div>
                                {amountError && (
                                    <p className="text-xs text-destructive font-medium mt-1">{amountError}</p>
                                )}
                                {plan.scheme_type === 'flexible' && (
                                    <div className="pt-2 text-right animate-in fade-in slide-in-from-top-2">
                                        <p className="text-3xl font-serif text-gold">{estimatedGrams} g</p>
                                        <p className="text-xs text-muted-foreground">approx. weight after tax</p>
                                    </div>
                                )}
                            </div>

                            {plan.scheme_type !== 'flexible' && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Tenure (months)</span>
                                        <span className="text-foreground font-medium">{normalizedMonths}</span>
                                    </div>
                                    <Input
                                        type="number"
                                        value={months}
                                        min={1}
                                        max={maxMonths}
                                        onChange={(e) => setMonths(Number(e.target.value))}
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Min 1 month</span>
                                        <span>Max {maxMonths} months</span>
                                    </div>
                                </div>
                            )}

                            <Separator />

                            {plan.scheme_type !== 'flexible' ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-lg bg-muted/60">
                                        <p className="text-xs text-muted-foreground">Total you invest</p>
                                        <p className="text-xl font-semibold">{formatCurrency(maturityValue.totalContribution, store.currency)}</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-muted/60">
                                        <p className="text-xs text-muted-foreground">Free last month</p>
                                        <p className="text-xl font-semibold text-gold">+{formatCurrency(maturityValue.bonusValue, store.currency)}</p>
                                        <p className="text-xs text-muted-foreground">We waive the final installment.</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-muted/60">
                                        <p className="text-xs text-muted-foreground">Maturity value</p>
                                        <p className="text-xl font-semibold">{formatCurrency(maturityValue.maturity, store.currency)}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-lg bg-muted/60">
                                    <p className="text-sm">
                                        This amount will be converted to {plan.target_metal || 'gold'} grams based on the current market rate after tax deduction.
                                    </p>
                                </div>
                            )}

                            <Button className="w-full gold-gradient text-white" onClick={proceedToSubscribe} disabled={processingPayment || !isAmountValid}>
                                {processingPayment ? 'Processing...' : 'Proceed to subscribe'}
                            </Button>
                            <p className="text-xs text-muted-foreground text-center">No interest, no hidden charges. Redeem in-store or via live gold rate.</p>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-serif text-xl">Why this plan works</CardTitle>
                                <CardDescription>
                                    {plan.scheme_type === 'flexible'
                                        ? `Accumulate ${plan.target_metal || 'gold'} securely with flexible payments.`
                                        : 'Protect yourself from rising gold prices while keeping monthly deposits flexible.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                {plan.scheme_type === 'flexible' ? (
                                    <>
                                        <div className="flex gap-3">
                                            <span className="text-gold font-semibold">01</span>
                                            <div>
                                                <p className="text-foreground font-medium">Lock today&apos;s rate every time you purchase {plan.target_metal || 'gold'}</p>
                                                <p>You purchase grams at the current rate with every payment, avoiding the risk of paying higher prices later.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <span className="text-gold font-semibold">02</span>
                                            <div>
                                                <p className="text-foreground font-medium">Buy {plan.target_metal || 'gold'} coins anytime</p>
                                                <p>Buy {plan.target_metal || 'gold'} coins anytime for the accumulated weight.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <span className="text-gold font-semibold">03</span>
                                            <div>
                                                <p className="text-foreground font-medium">Tax efficient</p>
                                                <p>Tax paid upfront and no tax while buying {plan.target_metal || 'gold'} coins.</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex gap-3">
                                            <span className="text-gold font-semibold">01</span>
                                            <div>
                                                <p className="text-foreground font-medium">Lock today&apos;s rate every month</p>
                                                <p>You purchase grams monthly at the current rate, avoiding the risk of paying higher prices later.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <span className="text-gold font-semibold">02</span>
                                            <div>
                                                <p className="text-foreground font-medium">Automatic last-month waiver</p>
                                                <p>Your final installment is free, effectively giving you one extra month of savings.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <span className="text-gold font-semibold">03</span>
                                            <div>
                                                <p className="text-foreground font-medium">Flexible monthly deposits</p>
                                                <p>Choose any amount between your configured minimum and maximum without penalties.</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {plan.scheme_type !== 'flexible' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="font-serif text-xl">How to redeem</CardTitle>
                                    <CardDescription>Simple steps to complete your plan.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm text-muted-foreground">
                                    <div className="flex gap-3">
                                        <span className="text-foreground font-semibold">1</span>
                                        <div>
                                            <p className="text-foreground font-medium">Pay monthly</p>
                                            <p>Deposit your chosen amount every month and watch your grams accumulate.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <span className="text-foreground font-semibold">2</span>
                                        <div>
                                            <p className="text-foreground font-medium">Get bonus weight</p>
                                            <p>Your last installment is waived, giving you additional gold weight for free.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <span className="text-foreground font-semibold">3</span>
                                        <div>
                                            <p className="text-foreground font-medium">Purchase at maturity</p>
                                            <p>Redeem at the live gold rate or convert into jewellery with assured quality and buyback.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </section>
            </main>

            <StoreFooter store={store} />
            <LoadingOverlay isLoading={processingPayment} />
        </div>
    );
};

export default PlanDetail;