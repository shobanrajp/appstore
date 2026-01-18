import React, { useState, useEffect } from 'react';
import { updateStoreSettings, updatePassword, getStore, getMarketPrices } from '../lib/api';
import api from '../lib/api';
import MarketPriceSettings from './MarketPriceSettings';
import { Switch } from './ui/switch';
import { Truck, ExternalLink } from 'lucide-react';

export default function StoreSettings({ storeId }) {
  const [orderPrefix, setOrderPrefix] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [marketPrices, setMarketPrices] = useState({ enabled: false, prices: {}, defaultPurity: {} });
  
  // Shipping Config State
  const [shippingConfig, setShippingConfig] = useState({
      is_enabled: false,
      provider: 'shiprocket',
      email: '',
      password: '',
      pickup_pincode: '',
      pickup_location: ''
  });

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
        
        // Fetch market prices
        try {
          const mp = await getMarketPrices(storeId);
           if (mp.data) {
             const mpdata = mp.data;
             setMarketPrices({ enabled: !!mpdata.enabled, prices: mpdata.prices || {}, defaultPurity: mpdata.default_purity || {} });
           }
        } catch (e) {
          console.error('Failed to load market prices', e);
        }

        // Fetch Shipping Config
        try {
            const shipRes = await api.get(`/stores/${storeId}/shipping-config`);
            setShippingConfig(prev => ({
                ...prev,
                ...shipRes.data,
                password: '' // Don't show password
            }));
        } catch (e) {
            console.error('Failed to load shipping config', e);
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

      // 2. Save Shipping Config
      await api.put(`/stores/${storeId}/shipping-config`, shippingConfig);

      // 3. Change Password (if provided)
      let passwordChanged = false;
      if (currentPassword || newPassword) {
        if (!currentPassword || !newPassword) {
            throw new Error('Both current and new password are required to change password');
        }
        
        await updatePassword(currentPassword, newPassword);
        passwordChanged = true;
      }

      setMessage(passwordChanged ? 'All settings (General, Shipping, Password) saved successfully' : 'Settings saved successfully');
      
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
        {/* General Settings */}
        <section className="p-4 border rounded space-y-4 mb-4 bg-white">
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

        {/* Shipping Configuration */}
        <section className="p-4 border rounded mb-4 bg-white">
          <div className="flex items-center gap-2 mb-4">
              <Truck className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Shipping Configuration</h3>
          </div>
          <div className="flex items-center justify-between border-b pb-4 mb-4">
               <div className="space-y-0.5">
                   <label className="text-sm font-medium">Enable Shiprocket Integration</label>
                   <p className="text-xs text-muted-foreground">Calculate shipping rates automatically.</p>
               </div>
               <Switch
                   checked={shippingConfig.is_enabled}
                   onCheckedChange={(checked) => setShippingConfig({ ...shippingConfig, is_enabled: checked })}
               />
          </div>
          
          {shippingConfig.is_enabled && (
               <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <label className="block text-sm font-medium">Provider</label>
                        <input value="Shiprocket" disabled className="border p-2 rounded mt-1 w-full bg-gray-50 text-gray-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Shiprocket Pickup Pincode</label>
                        <input 
                            value={shippingConfig.pickup_pincode || ''}
                            onChange={(e) => setShippingConfig({ ...shippingConfig, pickup_pincode: e.target.value })}
                            placeholder="e.g. 560001"
                            className="border p-2 rounded mt-1 w-full"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Must match a pickup location in your Shiprocket account.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Shiprocket Pickup Location</label>
                      <input
                        value={shippingConfig.pickup_location || ''}
                        onChange={(e) => setShippingConfig({ ...shippingConfig, pickup_location: e.target.value })}
                        placeholder="e.g. Primary"
                        className="border p-2 rounded mt-1 w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Optional. Name of the pickup location configured in Shiprocket (e.g. "Primary").</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Shiprocket Email</label>
                        <input 
                            value={shippingConfig.email || ''}
                            onChange={(e) => setShippingConfig({ ...shippingConfig, email: e.target.value })}
                            placeholder="email@example.com"
                            className="border p-2 rounded mt-1 w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Shiprocket Password</label>
                        <input 
                            type="password"
                            value={shippingConfig.password || ''}
                            onChange={(e) => setShippingConfig({ ...shippingConfig, password: e.target.value })}
                            placeholder={shippingConfig.email ? '(Unchanged)' : 'Enter password'}
                            className="border p-2 rounded mt-1 w-full"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                        <ExternalLink className="w-4 h-4" />
                        <a href="https://app.shiprocket.in/register" target="_blank" rel="noreferrer" className="hover:underline">
                            Don't have a Shiprocket account? Sign up here.
                        </a>
                    </div>
               </div>
          )}
        </section>

        {/* Market Prices */}
        <section className="p-4 border rounded mb-4 bg-white">
          <MarketPriceSettings
            enabled={marketPrices.enabled}
            prices={marketPrices.prices}
            defaultPurity={marketPrices.defaultPurity}
            onChange={(v) => setMarketPrices(prev => ({ ...prev, enabled: !!v.enabled, prices: v.prices || {} }))}
            onDefaultPurityChange={(p) => setMarketPrices(prev => ({ ...prev, defaultPurity: p }))}
          />
        </section>

        {/* Change Password */}
        <section className="p-4 border rounded mb-6 bg-white">
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

        <div className="sticky bottom-0 bg-white p-4 border-t flex justify-between items-center z-10 shadow-up">
            <div>
                {message && <span className="text-green-600 font-medium">{message}</span>}
                {error && <span className="text-red-600 font-medium">{error}</span>}
            </div>
            
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
