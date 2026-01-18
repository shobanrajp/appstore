(async () => {
  const base = 'https://appstores-pink.vercel.app/api';
  const creds = { email: 'vadmin@admin.com', password: 'admin123' };
  const headers = { 'Content-Type': 'application/json' };

  try {
    console.log('LOGIN');
    const loginRes = await fetch(base + '/auth/login', { method: 'POST', headers, body: JSON.stringify(creds) });
    const loginBody = await loginRes.json();
    console.log('login status', loginRes.status);
    console.log(JSON.stringify(loginBody, null, 2));
    const token = loginBody?.data?.token || loginBody?.token || loginBody?.access_token;
    if (!token) {
      console.error('No token returned, aborting');
      process.exit(2);
    }

    const authHeader = { ...headers, Authorization: `Bearer ${token}` };

    console.log('\nGET STORES');
    let storeId = loginBody?.user?.store_id;
    try {
      const storesRes = await fetch(base + '/stores', { method: 'GET', headers });
      const stores = await storesRes.json();
      console.log('stores status', storesRes.status);
      console.log(JSON.stringify(stores, null, 2));
      storeId = storeId || stores?.data?.[0]?.id;
    } catch (e) {
      console.log('Could not fetch stores, using store_id from login if present');
    }
    if (!storeId) { console.error('No store found'); process.exit(3); }
    console.log('Picked storeId', storeId);

    console.log('\nGET PLANS');
    const plansRes = await fetch(base + `/stores/${storeId}/subscription-plans`, { method: 'GET', headers });
    const plans = await plansRes.json();
    console.log('plans status', plansRes.status);
    console.log(JSON.stringify(plans, null, 2));
    const plan = (plans?.data && plans.data[0]) || (Array.isArray(plans) && plans[0]);
    if (!plan) { console.error('No plan found'); process.exit(4); }
    console.log('Picked plan', plan.id, 'min_amount', plan.min_amount);

    console.log('\nCREATE PAYMENT ORDER (with subscription payload)');
    const payPayload = { amount: plan.min_amount, description: 'Test subscription payment', subscription_payload: { plan_id: plan.id, monthly_amount: plan.min_amount }, store_id: storeId };
    const payRes = await fetch(base + '/payments/create-order', { method: 'POST', headers: authHeader, body: JSON.stringify(payPayload) });
    const payBody = await payRes.json();
    console.log('create payment status', payRes.status);
    console.log(JSON.stringify(payBody, null, 2));
    const payment_id = payBody?.data?.id || payBody?.id;
    if (!payment_id) { console.error('Payment creation failed'); process.exit(6); }

    console.log('\nSIMULATE PAYMENT COMPLETE');
    const completeRes = await fetch(base + `/payments/${payment_id}/complete`, { method: 'POST', headers: authHeader });
    const completeBody = await completeRes.json();
    console.log('complete status', completeRes.status);
    console.log(JSON.stringify(completeBody, null, 2));
    const created_subscription_id = completeBody?.subscription_id || null;
    if (created_subscription_id) console.log('Subscription created on payment complete:', created_subscription_id);

    console.log('\nDONE');
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  }
})();
