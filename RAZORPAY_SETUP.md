# Razorpay Configuration for Subscriptions

## Issue
When clicking "Proceed to subscribe" on the plan detail page, you may see an error: **"Payment gateway not configured for this store"**

## Solution
The store needs to be configured with Razorpay test credentials (keys). Follow these steps:

### Step 1: Get Your Razorpay Test Keys

1. Visit [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Sign in with your Razorpay account
3. Navigate to **Settings > API Keys**
4. Under the **Test Keys** tab, you'll see:
   - **Key ID** (Public Key) - looks like `rzp_test_xxxxxxxxxx`
   - **Key Secret** (Secret Key) - keep this private
5. Copy both keys

### Step 2: Configure Your Store

You have two options:

#### Option A: Using the Setup Script (Recommended)

```bash
cd c:/Users/user/Documents/WorkSpace/Store/app

# Run the setup script with your actual keys
python scripts/setup_razorpay.py 60c1f01e-91af-4131-953d-c16e2c9c1ca7 rzp_test_YOUR_KEY_ID YOUR_KEY_SECRET
```

Example:
```bash
python scripts/setup_razorpay.py 60c1f01e-91af-4131-953d-c16e2c9c1ca7 rzp_test_1Aa00000000001 2d7P0R1b2pZ3d4eZ5f6
```

#### Option B: Using MongoDB Directly

If you have MongoDB access:
```javascript
db.stores.updateOne(
  { id: "60c1f01e-91af-4131-953d-c16e2c9c1ca7" },
  {
    $set: {
      razorpay_key_id: "rzp_test_YOUR_KEY_ID",
      razorpay_key_secret: "YOUR_KEY_SECRET"
    }
  }
)
```

#### Option C: Via API (Super Admin)

Use a REST client (Postman, curl, etc.) to update the payment config:

```bash
curl -X PUT http://localhost:8000/api/stores/60c1f01e-91af-4131-953d-c16e2c9c1ca7/payment-config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_key_id": "rzp_test_YOUR_KEY_ID",
    "razorpay_key_secret": "YOUR_KEY_SECRET"
  }'
```

### Step 3: Verify Configuration

1. Open your browser and navigate to: http://localhost:3000/store/60c1f01e-91af-4131-953d-c16e2c9c1ca7/plans
2. Click on any plan
3. On the plan detail page, click "Proceed to subscribe"
4. You should now see the Razorpay checkout modal instead of an error

### Step 4: Test Payment

1. In the Razorpay modal, enter test card details:
   - Card Number: `4111 1111 1111 1111` (Visa)
   - Expiry: Any future date (e.g., 12/30)
   - CVV: Any 3 digits (e.g., 123)
   - Name: Any name

2. Click "Pay" to complete the test payment

3. After successful payment, you should be redirected to the subscriptions portal

## Troubleshooting

### Still seeing "Payment gateway not configured" error?

Check your browser's developer console (F12) for debug logs:
- Look for: `[PlanDetail] Store data:`
- Verify that `razorpay_key_id` is present and not empty

### Keys not being saved?

1. Verify you have the correct MongoDB URL in your `.env`
2. Ensure the store ID is exactly: `60c1f01e-91af-4131-953d-c16e2c9c1ca7`
3. Check MongoDB directly to confirm the keys are saved:
   ```javascript
   db.stores.findOne({ id: "60c1f01e-91af-4131-953d-c16e2c9c1ca7" })
   ```

### Payment not processing?

- Make sure you're using **Test Keys** from Razorpay (not production keys)
- Verify the keys match exactly (no spaces, case-sensitive)
- Check browser console for Razorpay errors
- Ensure your Razorpay account is in test mode

## For Production

When deploying to production:

1. Switch to **Production Keys** in Razorpay dashboard
2. Replace test keys with production keys in the store configuration
3. Ensure `razorpay_key_id` and `razorpay_key_secret` are properly encrypted/protected
4. Never commit keys to version control (use environment variables instead)

## References

- [Razorpay Documentation](https://razorpay.com/docs/)
- [API Keys - Razorpay Help](https://razorpay.com/docs/payments/api-keys/)
- [Integration Checklist](https://razorpay.com/docs/payments/integration-checklist/)
