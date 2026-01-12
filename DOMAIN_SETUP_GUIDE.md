# Custom Domain Setup Guide

This guide explains how to set up configurable domain names for each store in your multi-tenant application.

## Architecture Overview

```
Frontend (Vercel)          Backend (API)
  |                          |
  +-- appstores-pink.vercel.app (default)
  +-- mystore.com (custom domain → routes to same frontend)
  +-- yourstore.com (custom domain → routes to same frontend)
  
All requests → Frontend detects domain → Fetches store by domain → Loads store config
```

## Backend Changes

### 1. Database Schema

Add these fields to the `stores` collection:

```python
{
  "id": "store-uuid",
  "name": "My Store",
  "custom_domain": "mystore.com",           # Optional custom domain
  "custom_domain_verified": false,          # Has DNS been verified?
  # ... other fields ...
}
```

### 2. Update Store Models

Update `StoreCreate` model:
```python
class StoreCreate(BaseModel):
    name: str
    # ... existing fields ...
    custom_domain: Optional[str] = None
    custom_domain_verified: bool = False
```

Update `StoreResponse` model:
```python
class StoreResponse(BaseModel):
    id: str
    name: str
    # ... existing fields ...
    custom_domain: Optional[str] = None
    custom_domain_verified: bool = False
```

### 3. Domain Management Endpoints

Add these endpoints to `backend/server.py`:

```python
# Update store's custom domain
@api_router.put("/stores/{store_id}/domain")
async def update_store_domain(store_id: str, domain_data: dict, 
                              user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    """Update store's custom domain with validation"""
    # Validate domain format
    # Check domain uniqueness
    # Store domain and reset verification status

# Get domain verification status
@api_router.get("/stores/{store_id}/domain-verification-status")
async def get_domain_verification_status(store_id: str):
    """Returns domain status and setup instructions"""

# Verify domain (admin manual verification)
@api_router.post("/stores/{store_id}/verify-domain")
async def verify_domain(store_id: str, user: dict = Depends(require_roles(...))):
    """Mark domain as verified"""

# Get store by custom domain (for frontend routing)
@api_router.get("/stores/by-domain/{domain}")
async def get_store_by_domain(domain: str):
    """Fetch store configuration by custom domain"""
```

### 4. Domain Validation Rules

```python
# Domain must:
1. Be a valid format (letters, numbers, hyphens, dots)
2. Not be already in use by another store
3. Be lowercase and trimmed
4. Match regex: ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?([.][a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$
```

## Frontend Changes

### 1. Detect Domain and Load Store

Create `src/utils/domainDetector.js`:

```javascript
/**
 * Detect store from current domain/subdomain
 * Returns store_id or null
 */
export function getStoreFromDomain() {
  const hostname = window.location.hostname;
  
  // Production domains
  if (hostname === 'localhost' || hostname === 'localhost:3000') {
    return null; // Use URL params for local development
  }
  
  // Check if custom domain (not default Vercel domain)
  if (!hostname.includes('vercel.app')) {
    // This is a custom domain - fetch store by domain
    return { type: 'custom_domain', domain: hostname };
  }
  
  // Check for subdomain on Vercel domain (e.g., mystore.vercel.app)
  const parts = hostname.split('.');
  if (parts[0] !== 'appstores-pink') {
    return { type: 'subdomain', domain: hostname };
  }
  
  return null;
}

/**
 * Fetch store details by domain
 */
export async function fetchStoreByDomain(domain) {
  try {
    const response = await fetch(`/api/stores/by-domain/${domain}`);
    if (!response.ok) throw new Error('Store not found');
    return await response.json();
  } catch (error) {
    console.error('Failed to load store:', error);
    return null;
  }
}
```

### 2. Update App.js to Use Domain Detection

```javascript
import { getStoreFromDomain, fetchStoreByDomain } from './utils/domainDetector';

function App() {
  const [storeId, setStoreId] = useState(null);
  const [store, setStore] = useState(null);

  useEffect(() => {
    const initStore = async () => {
      // 1. Check for custom domain
      const domainInfo = getStoreFromDomain();
      
      if (domainInfo) {
        // 2. Fetch store by domain
        const storeData = await fetchStoreByDomain(domainInfo.domain);
        if (storeData) {
          setStoreId(storeData.id);
          setStore(storeData);
          return;
        }
      }
      
      // 3. Fall back to URL params or context
      const urlParams = new URLSearchParams(window.location.search);
      const paramStoreId = urlParams.get('store_id');
      if (paramStoreId) {
        setStoreId(paramStoreId);
      }
    };

    initStore();
  }, []);

  return (
    <CartProvider storeId={storeId}>
      <AuthProvider>
        {/* Your app routes */}
      </AuthProvider>
    </CartProvider>
  );
}
```

### 3. Add Domain Setup UI in Store Admin Dashboard

```javascript
// In StoreAdminDashboard.js or new DomainSettings.js component

function DomainSettings({ storeId }) {
  const [domain, setDomain] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch current domain
  useEffect(() => {
    const fetchDomain = async () => {
      try {
        const response = await fetch(`/api/stores/${storeId}/domain-verification-status`);
        const data = await response.json();
        setDomain(data.domain || '');
        setVerified(data.verified || false);
      } catch (error) {
        console.error('Failed to fetch domain:', error);
      }
    };
    fetchDomain();
  }, [storeId]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/domain`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_domain: domain })
      });
      const data = await response.json();
      setDomain(data.custom_domain || '');
      setVerified(data.custom_domain_verified);
      alert('Domain updated! Please configure DNS and click verify.');
    } catch (error) {
      alert('Failed to update domain: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="domain-settings">
      <h3>Custom Domain</h3>
      <input 
        type="text" 
        placeholder="mystore.com"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        disabled={verified}
      />
      <button onClick={handleUpdate} disabled={loading || verified}>
        {verified ? '✓ Verified' : 'Update Domain'}
      </button>
      
      {domain && !verified && (
        <div className="verification-steps">
          <h4>Setup Instructions:</h4>
          <ol>
            <li>Add CNAME record pointing to: appstores-pink.vercel.app</li>
            <li>Configure domain in Vercel project settings</li>
            <li>Wait for DNS propagation (5-30 minutes)</li>
            <li>Click "Verify Domain" to confirm</li>
          </ol>
        </div>
      )}
    </div>
  );
}
```

## Vercel Configuration

### 1. Add Custom Domain in Vercel Dashboard

1. Go to Vercel Project Settings
2. Navigate to "Domains"
3. Click "Add Domain"
4. Enter custom domain (e.g., mystore.com)
5. Choose DNS provider option
6. Follow verification steps

### 2. Update Vercel Environment

In `vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600"
        }
      ]
    }
  ]
}
```

## DNS Configuration

### For GoDaddy, Namecheap, etc.

Add CNAME record:
```
Domain:  mystore.com
Type:    CNAME
Value:   appstores-pink.vercel.app
TTL:     3600 (default)
```

### For Cloudflare

1. Login to Cloudflare
2. Select your domain
3. Go to DNS Records
4. Add CNAME:
   - Name: `@` (for root) or subdomain name
   - Type: `CNAME`
   - Content: `appstores-pink.vercel.app`
   - TTL: Auto
   - Proxy: Gray Cloud (DNS only)

## API Backend Domain Handling

### Option 1: Shared API Endpoint

All stores use the same API:
```
https://api.yourdomain.com/api/...
```

Backend identifies store from:
- Request header: `X-Store-ID`
- Authorization token (contains store_id)
- Domain lookup via `/stores/by-domain/{domain}`

### Option 2: Store-Specific API Subdomains

Each store has own API:
```
store1-api.yourdomain.com
store2-api.yourdomain.com
```

Configure in `backend/server.py`:
```python
@api_router.get("/stores/current")
async def get_current_store(request: Request):
    """Get store for current domain"""
    host = request.headers.get("Host", "").split(":")[0]
    # Extract store from subdomain: store1-api.domain.com
    return await db.stores.find_one({"api_domain": host})
```

## Complete API Flow

### 1. First Time Visitor (Custom Domain)

```
Browser: GET mystore.com
  ↓
Vercel Frontend loads (shows spinner)
  ↓
Frontend JS: detectDomain() → finds "mystore.com"
  ↓
Frontend: GET /api/stores/by-domain/mystore.com
  ↓
Backend: Returns store ID and config
  ↓
Frontend: Renders store content with branding
```

### 2. Logged In User

```
Browser: GET mystore.com (with JWT token)
  ↓
Frontend: Detects custom domain
  ↓
JWT token contains store_id
  ↓
Frontend: Loads cart, subscriptions, orders for that store
  ↓
User sees personalized experience for their store
```

## Testing Custom Domains Locally

### Option 1: Edit /etc/hosts

```bash
# Windows: C:\Windows\System32\drivers\etc\hosts
# Mac/Linux: /etc/hosts

127.0.0.1 localhost
127.0.0.1 mystore.local
127.0.0.1 yourstore.local
```

Update frontend `.env`:
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_FRONTEND_URL=http://localhost:3000
```

Test locally:
```bash
# Terminal 1: Backend
cd backend && python -m uvicorn server:app --reload

# Terminal 2: Frontend
cd frontend && npm start

# Browser: http://mystore.local:3000
```

### Option 2: ngrok for Testing

```bash
# Expose local frontend
ngrok http 3000

# Get URL like: https://abc123.ngrok.io

# Configure DNS CNAME to ngrok URL
# Test with custom domain
```

## Deployment Checklist

- [ ] Update store models with domain fields
- [ ] Create domain management API endpoints
- [ ] Implement frontend domain detection
- [ ] Add domain settings UI in store admin
- [ ] Configure Vercel custom domains
- [ ] Set up DNS records
- [ ] Test domain-based routing
- [ ] Document domain setup for store owners
- [ ] Add SSL certificates (automatic with Vercel)

## Troubleshooting

### Domain not resolving

```bash
# Check DNS propagation
nslookup mystore.com
# or
dig mystore.com

# Check Vercel can see domain
# Dashboard > Domains > should show "Valid Configuration"
```

### Frontend not loading from custom domain

1. Verify DNS is pointing to Vercel
2. Check Vercel domain configuration (may need SSL cert refresh)
3. Clear browser cache
4. Check browser console for CORS errors

### API requests failing from custom domain

1. Ensure API CORS headers allow custom domain
2. Update API_URL in frontend environment
3. Check Authorization headers are being sent

### Subdomain not working

1. Ensure wildcard DNS: `*.domain.com CNAME vercel.app`
2. Or add specific subdomain CNAME for each store

## Security Considerations

1. **Domain Verification**: Implement email verification when adding new domain
2. **Rate Limiting**: Limit domain lookup requests
3. **CORS**: Configure CORS to only allow registered domains
4. **SSL/TLS**: Use Vercel's free SSL (automatic)
5. **Store Isolation**: Ensure JWT tokens can't access other stores

## Future Enhancements

- [ ] Automatic DNS verification via API
- [ ] WHOIS verification for domain ownership
- [ ] Domain health monitoring
- [ ] Redirect old domain to new domain
- [ ] Vanity subdomain support (mystore.appstores.com)
- [ ] Multi-domain support per store
- [ ] Custom domain analytics
