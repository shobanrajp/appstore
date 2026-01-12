/**
 * Domain Detection Utility
 * 
 * Detects store from:
 * 1. Custom domain (mystore.com)
 * 2. Subdomain (mystore.vercel.app)
 * 3. URL parameters (store_id query param)
 */

export const VERCEL_DOMAIN = 'appstores-pink.vercel.app';
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Detect store identifier from current domain or URL
 * 
 * Returns: 
 * {
 *   type: 'custom_domain' | 'subdomain' | 'query_param' | null,
 *   identifier: string (domain, subdomain, or store_id),
 *   source: string (description of where identifier came from)
 * }
 */
export function getStoreIdentifier() {
  const hostname = window.location.hostname;
  const urlParams = new URLSearchParams(window.location.search);

  // Development/localhost
  if (hostname === 'localhost' || hostname === 'localhost:3000' || hostname === '127.0.0.1') {
    const queryStoreId = urlParams.get('store_id');
    if (queryStoreId) {
      return {
        type: 'query_param',
        identifier: queryStoreId,
        source: 'URL query parameter (local development)'
      };
    }
    return null;
  }

  // Check for custom domain (not Vercel domain, not localhost)
  if (!hostname.includes('vercel.app') && !hostname.includes('localhost')) {
    return {
      type: 'custom_domain',
      identifier: hostname,
      source: 'Custom domain'
    };
  }

  // Check for subdomain on Vercel domain (e.g., mystore.vercel.app)
  const parts = hostname.split('.');
  if (hostname.includes('vercel.app') && parts[0] !== 'appstores-pink') {
    // Extract the subdomain
    const subdomain = parts[0];
    return {
      type: 'subdomain',
      identifier: subdomain,
      source: 'Vercel subdomain'
    };
  }

  // Check URL parameters as fallback
  const queryStoreId = urlParams.get('store_id');
  if (queryStoreId) {
    return {
      type: 'query_param',
      identifier: queryStoreId,
      source: 'URL query parameter'
    };
  }

  return null;
}

/**
 * Fetch store by domain
 * Used when custom domain is detected
 */
export async function fetchStoreByDomain(domain) {
  try {
    console.log(`[DomainDetector] Fetching store for domain: ${domain}`);
    
    const response = await fetch(`${API_BASE_URL}/api/stores/by-domain/${domain}`);
    
    if (!response.ok) {
      console.error(`[DomainDetector] Failed to fetch store: ${response.status}`);
      throw new Error(`Store not found for domain: ${domain}`);
    }
    
    const storeData = await response.json();
    // Attach domain info for UI since store document no longer contains custom_domain
    storeData.custom_domain = domain;
    storeData.custom_domain_verified = true;
    console.log(`[DomainDetector] Successfully loaded store:`, storeData);
    return storeData;
  } catch (error) {
    console.error('[DomainDetector] Error loading store by domain:', error);
    return null;
  }
}

/**
 * Fetch store by ID
 * Standard store lookup
 */
export async function fetchStoreById(storeId) {
  try {
    console.log(`[DomainDetector] Fetching store by ID: ${storeId}`);
    
    const response = await fetch(`${API_BASE_URL}/api/stores/${storeId}`);
    
    if (!response.ok) {
      console.error(`[DomainDetector] Failed to fetch store: ${response.status}`);
      throw new Error(`Store not found: ${storeId}`);
    }
    
    const storeData = await response.json();
    console.log(`[DomainDetector] Successfully loaded store:`, storeData);
    return storeData;
  } catch (error) {
    console.error('[DomainDetector] Error loading store by ID:', error);
    return null;
  }
}

/**
 * Initialize store detection
 * Automatically detects and loads store configuration
 * 
 * Returns: { storeId, store, error }
 */
export async function initializeStore() {
  console.log('[DomainDetector] Initializing store detection...');
  
  const identifier = getStoreIdentifier();
  console.log('[DomainDetector] Detected identifier:', identifier);

  if (!identifier) {
    console.warn('[DomainDetector] No store identifier found');
    return { storeId: null, store: null, error: 'No store identifier found' };
  }

  let storeData = null;

  // Load store data based on identifier type
  if (identifier.type === 'custom_domain') {
    // For custom domains, always fetch from /by-domain endpoint
    storeData = await fetchStoreByDomain(identifier.identifier);
  } else if (identifier.type === 'subdomain') {
    // Try by-domain first, then by-id
    storeData = await fetchStoreByDomain(identifier.identifier);
    if (!storeData) {
      storeData = await fetchStoreById(identifier.identifier);
    }
  } else if (identifier.type === 'query_param') {
    // Fetch by ID
    storeData = await fetchStoreById(identifier.identifier);
  }

  if (!storeData) {
    const error = `Failed to load store: ${identifier.source}`;
    console.error('[DomainDetector]', error);
    return { storeId: null, store: null, error };
  }

  console.log('[DomainDetector] Store initialization successful');
  return {
    storeId: storeData.id,
    store: storeData,
    source: identifier.source
  };
}

/**
 * Get store domain info (for display in UI)
 */
export function getDisplayDomain(store) {
  if (store?.custom_domain) {
    return {
      domain: store.custom_domain,
      verified: store.custom_domain_verified,
      url: `https://${store.custom_domain}`
    };
  }
  
  return {
    domain: VERCEL_DOMAIN,
    verified: true,
    url: `https://${VERCEL_DOMAIN}`
  };
}
