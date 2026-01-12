# Custom Domain Architecture Diagrams

## 1. High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STORE OWNER PERSPECTIVE                          │
└─────────────────────────────────────────────────────────────────────┘

                    Store Admin Dashboard
                            ↓
              ┌─────────────────────────────┐
              │   Domain Settings Panel     │
              ├─────────────────────────────┤
              │ Current: mystore.com        │
              │ Status: ✓ Verified          │
              │ [Edit] [Remove]             │
              └─────────────────────────────┘
                            ↓
                    API: PUT /stores/{id}/domain
                            ↓
              ┌─────────────────────────────┐
              │    MongoDB: Stores Coll.    │
              ├─────────────────────────────┤
              │ id: "uuid"                  │
              │ name: "My Store"            │
              │ custom_domain: "mystore.com"│
              │ verified: true              │
              └─────────────────────────────┘
```

## 2. Customer Visit Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CUSTOMER BROWSING FLOW                               │
└────────────────────────────────────────────────────────────────────────┘

    Browser: GET https://mystore.com
            ↓
    ┌───────────────────────────────────────┐
    │    Vercel DNS Resolution              │
    │  mystore.com → CNAME →                │
    │  appstores-pink.vercel.app            │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │    Vercel Servers                     │
    │  Serve React frontend                 │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │  Browser JS runs domain detector:     │
    │  window.location.hostname =           │
    │  "mystore.com"                        │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │  Call backend API:                    │
    │  GET /api/stores/by-domain/           │
    │      mystore.com                      │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │  Backend returns:                     │
    │  {                                    │
    │    id: "store-id",                    │
    │    name: "My Store",                  │
    │    logo_url: "...",                   │
    │    currency: "INR"                    │
    │  }                                    │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │  Frontend loads store config:         │
    │  - Display logo                       │
    │  - Set store ID in context            │
    │  - Load cart for store_id             │
    │  - Load products for store_id         │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │  Render customized storefront:        │
    │  "Welcome to My Store!"               │
    │  [Logo] [Products] [Cart]             │
    └───────────────────────────────────────┘
```

## 3. Database Schema

```
┌────────────────────────────────────────────────────────┐
│              stores collection (MongoDB)               │
├────────────────────────────────────────────────────────┤
│ {                                                      │
│   "_id": ObjectId(...),                               │
│                                                        │
│   "id": "60c1f01e-91af-...",  ← UUID Primary Key     │
│   "name": "My Store",                                 │
│   "description": "...",                              │
│                                                        │
│   ──── NEW DOMAIN FIELDS ────                         │
│   "custom_domain": "mystore.com",    ← Domain name   │
│   "custom_domain_verified": true,    ← DNS verified  │
│   "domain_verified_at": "2024-01-10T...",           │
│                                                        │
│   "logo_url": "...",                                 │
│   "contact_email": "...",                            │
│   "currency": "INR",                                 │
│   "razorpay_key_id": "...",                          │
│   "razorpay_key_secret": "...",                      │
│   "is_active": true,                                 │
│   "created_at": "2024-01-10T...",                   │
│ }                                                      │
│                                                        │
│ Database Indexes:                                    │
│ ├─ custom_domain (unique, sparse)                    │
│ ├─ custom_domain_verified                           │
│ └─ is_active, created_at                            │
└────────────────────────────────────────────────────────┘
```

## 4. API Endpoint Architecture

```
┌─────────────────────────────────────────────────────────┐
│              DOMAIN MANAGEMENT ENDPOINTS                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  PUBLIC ENDPOINT (no auth):                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ GET /stores/by-domain/{domain}                   │  │
│  │ Purpose: Frontend domain-based store lookup      │  │
│  │ Returns: { id, name, logo_url, ... }            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ADMIN ENDPOINTS (Bearer token required):              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ PUT /stores/{store_id}/domain                    │  │
│  │ Purpose: Update domain                           │  │
│  │ Body: { "custom_domain": "mystore.com" }        │  │
│  │ Returns: Updated store object                    │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ GET /stores/{store_id}/domain-verification...   │  │
│  │ Purpose: Get domain status & DNS instructions   │  │
│  │ Returns: { status, domain, verified, ... }      │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ POST /stores/{store_id}/verify-domain            │  │
│  │ Purpose: Mark domain as verified                 │  │
│  │ Returns: { message, domain, verified }          │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ DELETE /stores/{store_id}/domain                 │  │
│  │ Purpose: Remove custom domain                    │  │
│  │ Returns: { message }                             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 5. Frontend Component Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│                       App.js                             │
│  ┌─── useEffect ──┐                                     │
│  │ initializeStore│                                     │
│  └────────────────┘                                     │
│         ↓                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  domainDetector.js                               │   │
│  │  ├─ getStoreIdentifier()                         │   │
│  │  ├─ fetchStoreByDomain()                         │   │
│  │  └─ initializeStore()                            │   │
│  └──────────────────────────────────────────────────┘   │
│         ↓                                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ CartProvider (storeId={storeId})                │    │
│  │   ↓                                             │    │
│  │ AuthProvider                                    │    │
│  │   ├─ StoreFront.js                             │    │
│  │   ├─ StoreProducts.js                          │    │
│  │   ├─ ProductDetail.js                          │    │
│  │   ├─ CartPage.js                               │    │
│  │   ├─ StoreAdminDashboard.js                    │    │
│  │   │  └─ DomainSettings.js ← NEW                │    │
│  │   └─ CustomerPortal.js                         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 6. Domain Verification Flow

```
┌──────────────────────────────────────────────────────────┐
│         DOMAIN VERIFICATION PROCESS                      │
└──────────────────────────────────────────────────────────┘

Step 1: Admin Configures Domain
    ┌────────────────────────────┐
    │ Domain Settings Component  │
    ├────────────────────────────┤
    │ Input: mystore.com         │
    │ [Update Domain]            │
    └────────────────────────────┘
            ↓
Step 2: Backend Validation
    ┌────────────────────────────┐
    │ PUT /stores/{id}/domain    │
    │ Validation:                │
    │ ✓ Format check             │
    │ ✓ Uniqueness check         │
    │ ✓ Not already used         │
    └────────────────────────────┘
            ↓
Step 3: Admin Adds DNS Record
    ┌────────────────────────────┐
    │ GoDaddy/Namecheap          │
    │ Add CNAME:                 │
    │ @  → vercel.app            │
    └────────────────────────────┘
            ↓
Step 4: Verify DNS Propagation
    ┌────────────────────────────┐
    │ $ nslookup mystore.com     │
    │ Returns: vercel.app CNAME  │
    │ Wait: 5-30 minutes         │
    └────────────────────────────┘
            ↓
Step 5: Admin Clicks Verify
    ┌────────────────────────────┐
    │ POST /verify-domain        │
    │ (Optional DNS check)       │
    └────────────────────────────┘
            ↓
Step 6: Domain Active
    ┌────────────────────────────┐
    │ custom_domain_verified:    │
    │          true              │
    │ Domain: mystore.com        │
    │ Status: ✓ Active           │
    └────────────────────────────┘
```

## 7. Multi-Domain Deployment

```
┌─────────────────────────────────────────────────────────┐
│            MULTIPLE STORES WITH CUSTOM DOMAINS          │
└─────────────────────────────────────────────────────────┘

Users visit different domains, same app instance:

    store1.com ──┐
                 ├──→ Vercel Frontend (appstores-pink.vercel.app)
    store2.com ──┤     ↓ Domain Detection ↓
                 │     Loads store-specific config
    store3.com ──┘     Returns store ID to context
                      Renders store-specific UI


Example Store Documents:
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ Store 1             │  │ Store 2             │  │ Store 3             │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ id: uuid1           │  │ id: uuid2           │  │ id: uuid3           │
│ name: "Tech Store"  │  │ name: "Fashion Co"  │  │ name: "Gadget Hub"  │
│ domain: store1.com  │  │ domain: store2.com  │  │ domain: store3.com  │
│ verified: true      │  │ verified: true      │  │ verified: true      │
│ logo: tech.png      │  │ logo: fashion.png   │  │ logo: gadget.png    │
│ currency: INR       │  │ currency: INR       │  │ currency: INR       │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
       ↑                       ↑                       ↑
       └───────────────────────┴───────────────────────┘
                    |
           MongoDB stores collection
           Indexed on: custom_domain
```

## 8. Error Handling Flow

```
┌────────────────────────────────────────────────────────┐
│         ERROR SCENARIOS & HANDLING                     │
└────────────────────────────────────────────────────────┘

Scenario 1: Domain Already Used
    Input: update_domain("store2.com")
    ↓
    DB Check: custom_domain="store2.com" exists
    ↓
    Response: 400 "Domain already in use"
    ↓
    User Action: Try different domain

Scenario 2: Invalid Domain Format
    Input: update_domain("not a domain!")
    ↓
    Regex Check: Fails validation
    ↓
    Response: 400 "Invalid domain format"
    ↓
    User Action: Enter valid domain

Scenario 3: Store Not Found
    Input: GET /stores/by-domain/unknown.com
    ↓
    DB Lookup: No match
    ↓
    Response: 404 "Store not found"
    ↓
    Frontend: Show error, redirect to home

Scenario 4: DNS Not Configured
    Admin clicks "Verify Domain" before DNS ready
    ↓
    (System marks as verified anyway - DNS is external)
    ↓
    Users can still visit domain once DNS propagates
    ↓
    Verification just updates admin dashboard status
```

These diagrams show:
- How data flows through the system
- How customers interact with custom domains
- How the database is structured
- How APIs communicate
- Component relationships
- Verification workflows
- Multi-domain deployments
- Error handling

Use these to understand the architecture and communicate it to your team!
