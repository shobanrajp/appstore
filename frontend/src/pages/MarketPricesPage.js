import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// MarketPricesPage removed — market-prices are edited inline in the Store Admin sidebar.
export default function MarketPricesPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    // Redirect back to the admin dashboard if this route is reached.
    if (storeId) navigate(`/store/${storeId}/admin`, { replace: true });
    else navigate('/landing', { replace: true });
  }, [storeId, navigate]);
  return null;
}
