import React from 'react';

// MarketPriceSettings is now a controlled component.
// It relies on the parent (StoreSettings) for state and fetching.
export default function MarketPriceSettings({ enabled = false, prices = {}, onChange = () => {}, disabled = false }) {

  const handleEnabledChange = (e) => {
    onChange({ enabled: e.target.checked, prices: prices || {} });
  };

  const handlePriceChange = (key) => (e) => {
    const v = e.target.value;
    const nextPrices = { ...(prices || {}), [key]: v };
    onChange({ enabled, prices: nextPrices });
  };

  const getValue = (key) => {
    if (prices && prices[key] !== undefined && prices[key] !== null) {
      return prices[key];
    }
    return '';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Market Prices (Header)</h3>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!enabled}
            onChange={handleEnabledChange}
            disabled={disabled}
          />
          <span>Show market prices in header</span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div>
          <label className="block text-sm">GOLD 24 KT/1g</label>
          <input type="text" name="gold_24" className="input border p-2 rounded w-full" value={getValue('gold_24')} onChange={handlePriceChange('gold_24')} disabled={disabled} />
        </div>
        <div>
          <label className="block text-sm">GOLD 22 KT/1g</label>
          <input type="text" name="gold_22" className="input border p-2 rounded w-full" value={getValue('gold_22')} onChange={handlePriceChange('gold_22')} disabled={disabled} />
        </div>
        <div>
          <label className="block text-sm">GOLD 18 KT/1g</label>
          <input type="text" name="gold_18" className="input border p-2 rounded w-full" value={getValue('gold_18')} onChange={handlePriceChange('gold_18')} disabled={disabled} />
        </div>
        <div>
          <label className="block text-sm">GOLD 14 KT/1g</label>
          <input type="text" name="gold_14" className="input border p-2 rounded w-full" value={getValue('gold_14')} onChange={handlePriceChange('gold_14')} disabled={disabled} />
        </div>
        <div>
          <label className="block text-sm">PLATINUM 1g</label>
          <input type="text" name="platinum_1g" className="input border p-2 rounded w-full" value={getValue('platinum_1g')} onChange={handlePriceChange('platinum_1g')} disabled={disabled} />
        </div>
        <div>
          <label className="block text-sm">SILVER 1g</label>
          <input type="text" name="silver_1g" className="input border p-2 rounded w-full" value={getValue('silver_1g')} onChange={handlePriceChange('silver_1g')} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}
