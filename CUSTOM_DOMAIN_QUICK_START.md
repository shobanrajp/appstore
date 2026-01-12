# Custom Domain Quick Start Guide

Get a custom domain working for your store in 15 minutes!

## 5-Minute Backend Setup

### 1. Update Store Models

In `backend/server.py`, update `StoreCreate` and `StoreResponse` classes:

```python
class StoreCreate(BaseModel):
    name: str
    # ... existing fields ...
    custom_domain: Optional[str] = None
    custom_domain_verified: bool = False

class StoreResponse(BaseModel):
    # ... existing fields ...
    custom_domain: Optional[str] = None
    custom_domain_verified: bool = False
```

### 2. Add Domain Endpoints

Copy this code into your `api_router` in `backend/server.py`:

```python
import re

# Get store by custom domain
@api_router.get("/stores/by-domain/{domain}")
async def get_store_by_domain(domain: str):
    domain = domain.lower().strip()
    store = await db.stores.find_one({"custom_domain": domain, "is_active": True}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found for this domain")
    return {
        "id": store.get("id"),
        "name": store.get("name"),
        "logo_url": store.get("logo_url")
    }

# Update store domain
@api_router.put("/stores/{store_id}/domain")
async def update_store_domain(store_id: str, domain_data: dict, 
                              user: dict = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.STORE_ADMIN]))):
    if user["role"] == UserRole.STORE_ADMIN and user.get("store_id") != store_id:
        raise HTTPException(status_code=403, detail="Cannot update other stores")
    
    custom_domain = domain_data.get("custom_domain", "").lower().strip()
    
    if custom_domain:
        # Check uniqueness
        existing = await db.stores.find_one({"custom_domain": custom_domain, "id": {"$ne": store_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Domain already in use")
        
        # Validate format
        if not re.match(r"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?([.][a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$", custom_domain):
            raise HTTPException(status_code=400, detail="Invalid domain format")
    
    await db.stores.update_one({"id": store_id}, {"$set": {
        "custom_domain": custom_domain or None,
        "custom_domain_verified": False
    }})
    
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    return store
```

### 3. Update create_store Function

When creating a store, include domain fields:

```python
store_doc = {
    "id": store_id,
    "name": store_data.name,
    # ... other fields ...
    "custom_domain": store_data.custom_domain,
    "custom_domain_verified": False,
    "created_at": now
}
```

---

## 5-Minute Frontend Setup

### 1. Create Domain Detector

Create `frontend/src/utils/domainDetector.js`:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export async function getStoreFromDomain() {
  const hostname = window.location.hostname;
  
  // Skip for localhost/development
  if (hostname === 'localhost' || hostname.includes('localhost:')) {
    return null;
  }
  
  // Skip for default Vercel domain
  if (hostname.includes('vercel.app')) {
    return null;
  }
  
  // This is a custom domain - fetch store
  try {
    const response = await fetch(`${API_BASE_URL}/api/stores/by-domain/${hostname}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to load store:', error);
  }
  
  return null;
}
```

### 2. Integrate into App.js

Update your `App.js`:

```javascript
import { getStoreFromDomain } from './utils/domainDetector';

function App() {
  const [storeId, setStoreId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initStore = async () => {
      try {
        // Check for custom domain
        const store = await getStoreFromDomain();
        if (store) {
          setStoreId(store.id);
          return;
        }
        
        // Fall back to URL parameter
        const params = new URLSearchParams(window.location.search);
        const paramStoreId = params.get('store_id');
        if (paramStoreId) {
          setStoreId(paramStoreId);
        }
      } finally {
        setLoading(false);
      }
    };

    initStore();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <CartProvider storeId={storeId}>
      <AuthProvider>
        {/* Your app routes */}
      </AuthProvider>
    </CartProvider>
  );
}
```

---

## 5-Minute DNS Setup

### For GoDaddy:
1. Login to GoDaddy domain management
2. Find DNS settings
3. Add CNAME record:
   - **Name**: @ (root domain)
   - **Value**: appstores-pink.vercel.app
   - **TTL**: 3600
4. Save and wait 5-30 minutes

### For Namecheap:
1. Login to Namecheap
2. Select your domain → Manage
3. Go to Advanced DNS
4. Add CNAME record:
   - **Host**: @ (or www)
   - **Value**: appstores-pink.vercel.app
   - **TTL**: 3600
5. Save

### For Cloudflare:
1. Login to Cloudflare
2. Select your domain
3. Go to DNS Records
4. Add CNAME:
   - **Name**: @ (root)
   - **Type**: CNAME
   - **Content**: appstores-pink.vercel.app
   - **Proxy**: DNS only
5. Save

---

## Testing Locally

### Option 1: Edit /etc/hosts

**Windows** (`C:\Windows\System32\drivers\etc\hosts`):
```
127.0.0.1 mystore.local
127.0.0.1 localhost
```

**Mac/Linux** (`/etc/hosts`):
```
127.0.0.1 mystore.local
127.0.0.1 localhost
```

Then:
```bash
# Terminal 1: Backend
cd backend
python -m uvicorn server:app --reload

# Terminal 2: Frontend
cd frontend
npm start

# Browser: http://mystore.local:3000
```

### Option 2: Vercel Preview

Every git commit creates a preview URL. Test there while waiting for DNS to propagate.

---

## Deploying to Vercel

### 1. Connect Domain in Vercel

1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → Domains
4. Click "Add Domain"
5. Enter your custom domain
6. Choose your DNS provider
7. Add recommended CNAME record to your registrar

### 2. Wait for SSL Certificate

Vercel automatically generates SSL certificates (can take up to 24 hours).

### 3. Test

Navigate to `https://yourdomain.com` - your store should load!

---

## Verify It's Working

### Check DNS
```bash
nslookup yourdomain.com
# Should show: appstores-pink.vercel.app
```

### Test from Browser
1. Open `https://yourdomain.com`
2. Check browser console (F12) for errors
3. Verify store loads

### Test API
```bash
curl https://yourdomain.com/api/stores/by-domain/yourdomain.com
# Should return your store data
```

---

## Common Issues

### Domain not working?
1. Check DNS: `nslookup yourdomain.com`
2. Wait 30 minutes for DNS to propagate
3. Clear browser cache (Ctrl+Shift+Delete)
4. Check Vercel shows "Valid Configuration"

### Store not loading?
1. Open browser DevTools (F12)
2. Check Console for error messages
3. Check Network tab for failed requests
4. Verify API endpoint responds

### API calls failing?
1. Check CORS headers
2. Verify Authorization token is sent
3. Check API_BASE_URL is correct
4. Test with curl

---

## Next Steps

Once it's working:

1. **Add domain settings UI** to your admin dashboard using `DomainSettings.js` component
2. **Update documentation** for your customers
3. **Test thoroughly** with real customers
4. **Monitor** DNS and SSL certificate health
5. **Plan** for future enhancements (multi-domain, auto DNS verification, etc.)

---

## File Reference

Created/Modified files:
- ✅ `backend/server.py` - Add domain endpoints
- ✅ `frontend/src/utils/domainDetector.js` - Domain detection logic
- ✅ `frontend/src/components/DomainSettings.js` - Admin UI (optional)
- ✅ `DOMAIN_SETUP_GUIDE.md` - Full documentation
- ✅ `DOMAIN_IMPLEMENTATION_CHECKLIST.md` - Implementation checklist

---

## Need Help?

1. **See detailed docs**: Read `DOMAIN_SETUP_GUIDE.md`
2. **Follow checklist**: Use `DOMAIN_IMPLEMENTATION_CHECKLIST.md`
3. **Admin UI**: Use `DomainSettings.js` component in dashboard
4. **Test locally**: See local testing section above

That's it! Your custom domains are now ready to go! 🚀
