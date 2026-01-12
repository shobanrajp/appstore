import React, { useState, useEffect } from 'react';
import { updateStoreSettings, updatePassword, getStore, getMarketPrices } from '../lib/api';
import MarketPriceSettings from './MarketPriceSettings';

export default function StoreSettings({ storeId }) {
  const [orderPrefix, setOrderPrefix] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [marketPrices, setMarketPrices] = useState({ enabled: false, prices: {} });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (!storeId) return;
    const fetchStore = async () => {
      try {
        const res = await getStore(storeId);
        const data = res.data;
        setOrderPrefix(data.order_prefix || 'VEL');
        setCurrency(data.currency || 'INR');
        // fetch market prices too
        try {
          const mp = await getMarketPrices(storeId);
          if (mp.data) {
             const mpdata = mp.data;
             setMarketPrices({ enabled: !!mpdata.enabled, prices: mpdata.prices || {} });
          }
        } catch (e) {
          console.error('Failed to load market prices', e);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchStore();
  }, [storeId]);

  const handleSaveAll = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    setPwMessage('');
    setPwError('');

    try {
      // 1. Save General Settings & Market Prices
      const settingsBody = { 
        order_prefix: orderPrefix, 
        currency: currency, 
        market_prices: { enabled: !!marketPrices.enabled, prices: marketPrices.prices || {} } 
      };

      await updateStoreSettings(storeId, settingsBody);

      // 2. Change Password (if provided)
      let passwordChanged = false;
      if (currentPassword || newPassword) {
        if (!currentPassword || !newPassword) {
            throw new Error('Both current and new password are required to change password');
        }
        
        await updatePassword(currentPassword, newPassword);
        passwordChanged = true;
      }

      setMessage(passwordChanged ? 'Settings and Password saved successfully' : 'Settings saved successfully');
      
      if (passwordChanged) {
        setCurrentPassword('');
        setNewPassword('');
      }

    } catch (err) {
      console.error(err);
      let msg = err.response?.data?.detail || err.message || 'Failed to save';
      // Handle Pydantic validation errors (array of objects) or other object responses
      if (typeof msg === 'object') {
        if (Array.isArray(msg) && msg.length > 0 && msg[0].msg) {
            msg = msg.map(e => e.msg).join(', ');
        } else {
            msg = JSON.stringify(msg);
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
      // Clear messages after delay
      setTimeout(() => { setMessage(''); setError(''); setPwMessage(''); setPwError(''); }, 4000);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSaveAll}>
        <section className="p-4 border rounded space-y-4 mb-4">
          <h3 className="text-lg font-semibold">Store Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="border p-2 rounded mt-1 w-40">
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Order Prefix (3 chars)</label>
              <input
                value={orderPrefix}
                onChange={(e) => setOrderPrefix(e.target.value.toUpperCase())}
                maxLength={3}
                className="border p-2 rounded mt-1 w-40"
              />
            </div>
          </div>
        </section>

        <section className="p-4 border rounded mb-4">
          <MarketPriceSettings
            enabled={marketPrices.enabled}
            prices={marketPrices.prices}
            onChange={(v) => setMarketPrices({ enabled: !!v.enabled, prices: v.prices || {} })}
          />
        </section>

        <section className="p-4 border rounded mb-6">
          <h3 className="text-lg font-semibold">Change Password</h3>
          <p className="text-xs text-muted-foreground mb-3">Leave blank if you don't want to change password.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="border p-2 rounded mt-1 w-64"
                placeholder="Current Password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border p-2 rounded mt-1 w-64"
                placeholder="New Password"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end items-center gap-4 pt-4 border-t mt-6">
            {/* Status Messages */}
            {message && <span className="text-green-600 font-medium">{message}</span>}
            {error && <span className="text-red-600 font-medium">{error}</span>}
            
            <button 
                type="submit" 
                className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded shadow hover:from-yellow-600 hover:to-yellow-700 transition-all font-semibold" 
                disabled={loading}
            >
                {loading ? 'Saving...' : 'Save All Changes'}
            </button>
        </div>
      </form>
    </div>
  );
}
