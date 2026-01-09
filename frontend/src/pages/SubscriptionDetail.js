import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStore, getSubscriptionPlans, subscribeToPlan } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { setPageTitle } from '../lib/utils';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Plus, Minus, Check } from 'lucide-react';

const SubscriptionDetail = () => {
  const { storeId, planId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [store, setStore] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);

  // Calculator state
  const [depositAmount, setDepositAmount] = useState(500);
  const [months, setMonths] = useState(11);

  useEffect(() => {
    loadData();
  }, [storeId, planId]);

  const loadData = async () => {
    try {
      const [storeRes, plansRes] = await Promise.all([
        getStore(storeId),
        getSubscriptionPlans(storeId)
      ]);

      const store = storeRes.data;
      setStore(store);
      setPageTitle(store, 'Subscription Plan');

      const selectedPlan = plansRes.data?.find(p => p.id === planId);
      if (selectedPlan) {
        setPlan(selectedPlan);
        // Set initial values from plan
        setDepositAmount(selectedPlan.min_amount || 500);
        setMonths(selectedPlan.duration_months || 11);
      } else {
        toast.error('Plan not found');
        navigate(`/store/${storeId}/plans`);
      }
    } catch (error) {
      console.error('Failed to load subscription plan:', error);
      toast.error('Failed to load plan details');
      navigate(`/store/${storeId}/plans`);
    } finally {
      setLoading(false);
    }
  };

  const handleDepositChange = (e) => {
    const value = Math.max(
      plan?.min_amount || 0,
      Math.min(plan?.max_amount || 100000, Number(e.target.value) || 0)
    );
    setDepositAmount(value);
  };

  const handleMonthsChange = (e) => {
    const value = Math.min(plan?.duration_months || 11, Number(e.target.value) || 1);
    setMonths(Math.max(1, value));
  };

  const incrementDeposit = () => {
    const newValue = Math.min(plan?.max_amount || 100000, depositAmount + 500);
    setDepositAmount(newValue);
  };

  const decrementDeposit = () => {
    const newValue = Math.max(plan?.min_amount || 0, depositAmount - 500);
    setDepositAmount(newValue);
  };

  const totalValue = depositAmount * months;
  const bonusAmount = depositAmount; // 12th month as bonus
  const totalWithBonus = totalValue + bonusAmount;

  const handleSubscribe = async () => {
    if (!user) {
      toast.error('Please login to subscribe');
      navigate(`/store/${storeId}/login`);
      return;
    }

    if (depositAmount < (plan?.min_amount || 500) || depositAmount > (plan?.max_amount || 100000)) {
      toast.error(`Deposit amount must be between ${plan?.min_amount} and ${plan?.max_amount}`);
      return;
    }

    setDepositing(true);
    try {
      const response = await subscribeToPlan(storeId, {
        plan_id: planId,
        monthly_amount: depositAmount
      });

      toast.success('Subscription created successfully!');
      navigate(`/store/${storeId}/portal?tab=subscriptions&subscription=${response.data.id}`);
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error(error.response?.data?.detail || 'Failed to create subscription');
    } finally {
      setDepositing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col w-full overflow-x-hidden">
        <StoreHeader store={store} storeId={storeId} />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
        </main>
        <StoreFooter store={store} storeId={storeId} />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex flex-col w-full overflow-x-hidden">
        <StoreHeader store={store} storeId={storeId} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Plan not found</p>
        </main>
        <StoreFooter store={store} storeId={storeId} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col w-full overflow-x-hidden">
      <StoreHeader store={store} storeId={storeId} />

      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full box-sizing-border-box">
        {/* Header */}
        <div className="mb-12">
          <p className="text-red-600 font-semibold text-sm uppercase tracking-wider mb-2">
            FLEXIBLE PURCHASE PLAN
          </p>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-2">
            {plan.name} Plan
          </h1>
          <p className="text-lg text-muted-foreground">
            {plan.description || 'Join our flexible purchase plan and get exclusive benefits'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Plan Details Card */}
          <Card className="luxury-card col-span-1">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <p className="text-4xl font-bold mb-2">₹{plan.min_amount || 1000}</p>
                <p className="text-muted-foreground">Start From</p>
              </div>

              <div className="absolute top-4 right-4">
                <span className="inline-block bg-red-600 text-white px-4 py-1 text-sm font-semibold">
                  Our Plan
                </span>
              </div>

              <div className="mb-8 text-center">
                <h3 className="font-serif text-xl mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.plan_type}</p>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Customer needs to pay {(plan.duration_months || 11)} installments</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">One installment for each month</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">A fully paid customer</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Will be eligible to get their rewards</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{(plan.bonus_percentage || 0) > 0 ? `${plan.bonus_percentage}% bonus on your plan` : 'Free final month bonus'}</span>
                </div>
              </div>

              {plan.benefits && plan.benefits.length > 0 && (
                <div className="space-y-2 mb-8 border-t pt-6">
                  <p className="font-semibold text-sm mb-3">Plan Benefits:</p>
                  {plan.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-gold flex-shrink-0" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              )}

              {!user ? (
                <Button
                  className="w-full gold-gradient text-white"
                  onClick={() => navigate(`/store/${storeId}/login`)}
                >
                  Login to Subscribe
                </Button>
              ) : (
                <Button
                  className="w-full gold-gradient text-white"
                  onClick={handleSubscribe}
                  disabled={depositing}
                >
                  {depositing ? 'Subscribing...' : 'Subscribe Now →'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Calculator Card */}
          <Card className="luxury-card col-span-1 lg:col-span-2">
            <CardContent className="p-8">
              <h2 className="text-3xl font-serif mb-2 text-center">
                <span style={{ color: '#A0826D' }}>Check The Plan Benefits</span>
              </h2>

              <div className="bg-gradient-to-b from-amber-50 to-amber-100/50 rounded-lg p-8 space-y-8">
                {/* Deposit Amount */}
                <div>
                  <Label htmlFor="deposit" className="text-base font-semibold mb-4 block">
                    I Want to Deposit
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={decrementDeposit}
                      disabled={depositing}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      id="deposit"
                      type="number"
                      value={depositAmount}
                      onChange={handleDepositChange}
                      className="flex-1 text-center font-semibold text-lg"
                      disabled={depositing}
                      min={plan?.min_amount || 0}
                      max={plan?.max_amount || 100000}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={incrementDeposit}
                      disabled={depositing}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {plan?.min_amount && plan?.max_amount && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Range: ₹{plan.min_amount} - ₹{plan.max_amount}
                    </p>
                  )}
                </div>

                {/* Months */}
                <div>
                  <Label htmlFor="months" className="text-base font-semibold mb-4 block">
                    Total Months
                  </Label>
                  <Input
                    id="months"
                    type="number"
                    value={months}
                    onChange={handleMonthsChange}
                    className="font-semibold text-lg"
                    disabled={true}
                    min={1}
                    max={plan?.duration_months || 11}
                  />
                </div>

                {/* Summary */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Value in {months} Months</span>
                    <span className="text-2xl font-bold text-amber-800">₹ {totalValue.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{months === (plan?.duration_months || 11) ? '12th' : 'Final'} installment as bonus</span>
                    <span className="text-2xl font-bold text-amber-800">₹ {bonusAmount.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center border-t pt-4">
                    <span className="font-semibold">Total Value Your {months}Month Plan:</span>
                    <span className="text-3xl font-bold gold-text">₹ {totalWithBonus.toLocaleString()}</span>
                  </div>
                </div>

                {!user ? (
                  <Button
                    className="w-full gold-gradient text-white"
                    onClick={() => navigate(`/store/${storeId}/login`)}
                  >
                    Login to Join Purchase Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full gold-gradient text-white"
                    onClick={handleSubscribe}
                    disabled={depositing}
                  >
                    {depositing ? 'Processing...' : 'Join Purchase Plan'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How To Join Section */}
        <section className="mb-12">
          <p className="text-red-600 font-semibold text-sm uppercase tracking-wider mb-4 text-center">
            HOW TO JOIN THE PLAN
          </p>
          <h2 className="text-4xl font-serif text-center mb-12">
            Easy To Follow The Process
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="relative mb-8 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-2xl">
                  1
                </div>
                {/* Connector line (hidden on mobile) */}
                <div className="hidden lg:block absolute left-1/2 top-1/2 w-[200%] h-0.5 bg-red-200" style={{ marginTop: '-2px' }}></div>
              </div>
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto mb-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">User Register</h3>
              <p className="text-sm text-muted-foreground">To Register Your Personal account</p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="relative mb-8 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-2xl">
                  2
                </div>
              </div>
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto mb-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.5a2 2 0 00-1 3.75A2.5 2.5 0 0012 19a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Add The Plan Into Your Account</h3>
              <p className="text-sm text-muted-foreground">While Purchase you can redeem your points</p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="relative mb-8 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-2xl">
                  3
                </div>
              </div>
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto mb-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h10m4 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Make Online Payment</h3>
              <p className="text-sm text-muted-foreground">Facility to pay monthly basis and Online Payments</p>
            </div>

            {/* Step 4 */}
            <div className="text-center">
              <div className="relative mb-8 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-2xl">
                  4
                </div>
              </div>
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto mb-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Jewellery Purchase After Plan Completion</h3>
              <p className="text-sm text-muted-foreground">Avail special discount</p>
            </div>
          </div>
        </section>
      </main>

      <StoreFooter store={store} storeId={storeId} />
    </div>
  );
};

export default SubscriptionDetail;
