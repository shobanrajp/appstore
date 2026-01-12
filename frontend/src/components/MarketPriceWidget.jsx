import React, { useEffect, useState } from 'react';
import { getMarketPrices } from '../lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ChevronDown } from 'lucide-react';

export default function MarketPriceWidget({ storeId, className = '' }) {
  const [config, setConfig] = useState({ enabled: false, prices: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    let mounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await getMarketPrices(storeId);
        if (mounted) {
            // Check if response has data property (axios) or is the data itself
            const data = res.data || {};
            setConfig({ enabled: !!data.enabled, prices: data.prices || {} });
        }
      } catch (e) {
        console.error('MarketPriceWidget load error', e);
        if (mounted) setConfig({ enabled: false, prices: {} });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [storeId]);

  if (loading || !config.enabled) return null;

  const items = [
    { key: 'gold_24', label: 'GOLD 24 KT/1g', color: 'text-yellow-500' },
    { key: 'gold_22', label: 'GOLD 22 KT/1g', color: 'text-yellow-600' }, // Primary
    { key: 'gold_18', label: 'GOLD 18 KT/1g', color: 'text-yellow-700' },
    { key: 'gold_14', label: 'GOLD 14 KT/1g', color: 'text-yellow-800' },
    { key: 'platinum_1g', label: 'PLATINUM 1g', color: 'text-slate-400' },
    { key: 'silver_1g', label: 'SILVER 1g', color: 'text-slate-400' }
  ];

  // Determine trigger content (prefer Gold 22KT)
  const primaryKey = 'gold_22';
  const primaryItem = items.find(i => i.key === primaryKey) || items[0];
  const primaryPrice = config.prices[primaryItem.key];
  
  if (!primaryPrice && Object.keys(config.prices).length === 0) return null;
  
  // If primary not found, pick first available
  const displayItem = primaryPrice ? primaryItem : items.find(i => config.prices[i.key]);
  const displayPrice = displayItem ? config.prices[displayItem.key] : null;

  if (!displayItem) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`flex items-center gap-2 outline-none hover:opacity-80 transition-opacity ${className}`}>
        <div className="flex items-center gap-2 font-medium">
             {/* Icon for trigger */}
             <BriefCoinIcon className={displayItem.color} />
             <span className="whitespace-nowrap">
                {displayItem.label} - ₹ {displayPrice}
             </span>
        </div>
        <ChevronDown className="w-4 h-4 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-background border rounded-md shadow-lg p-1">
        {items.map((it) => {
            const price = config.prices[it.key];
            if (!price) return null;
            return (
                <DropdownMenuItem key={it.key} className="flex items-center justify-between cursor-default focus:bg-accent focus:text-accent-foreground py-2">
                    <div className="flex items-center gap-2">
                        <BriefCoinIcon className={it.color} />
                        <span className="font-medium text-sm">{it.label}</span>
                    </div>
                    <span className="font-semibold text-sm">₹ {price}</span>
                </DropdownMenuItem>
            );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Simple Coin Icon Component to mimic the gold coin look
function BriefCoinIcon({ className }) {
    return (
        <svg 
            viewBox="0 0 24 24" 
            fill="currentColor" 
            className={`w-5 h-5 ${className}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle cx="12" cy="12" r="9" opacity="0.2" fill="currentColor"/>
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M10 14L14 10M10 10L14 14" stroke="none" fill="currentColor" opacity="0" /> 
            {/* Simple Coin shine/detail */}
            <path d="M15 9C15 9 13.5 12 12 12C10.5 12 9 9 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 15C9 15 10.5 12 12 12C13.5 12 15 15 15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
