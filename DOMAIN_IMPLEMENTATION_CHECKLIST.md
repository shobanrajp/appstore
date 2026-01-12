# Custom Domain Implementation Checklist

## Phase 1: Backend Implementation ✓

### Database Schema
- [x] Add `custom_domain` field to stores collection
- [x] Add `custom_domain_verified` field to stores collection
- [ ] Run MongoDB migration (if needed)

### API Models
- [x] Update `StoreCreate` model with domain fields
- [x] Update `StoreResponse` model with domain fields

### API Endpoints
- [ ] Implement `PUT /stores/{store_id}/domain` - Update domain
- [ ] Implement `GET /stores/{store_id}/domain-verification-status` - Check status
- [ ] Implement `POST /stores/{store_id}/verify-domain` - Verify domain
- [ ] Implement `GET /stores/by-domain/{domain}` - Get store by domain (for frontend)
- [ ] Implement `DELETE /stores/{store_id}/domain` - Remove domain

### Validation
- [x] Add domain format validation (regex)
- [x] Add domain uniqueness check
- [x] Add error handling

### API Security
- [ ] Add rate limiting to domain lookup endpoint
- [ ] Add CORS configuration for custom domains
- [ ] Test endpoint permission checks

---

## Phase 2: Frontend Implementation

### Utilities
- [x] Create `src/utils/domainDetector.js`
- [ ] Test domain detection logic locally
- [ ] Test with Vercel preview domains

### Components
- [x] Create `DomainSettings.js` component
- [ ] Add to Store Admin Dashboard
- [ ] Test UI and form validation

### App Integration
- [x] Create `App.integration.js` example
- [ ] Update main `App.js` with store initialization
- [ ] Add loading state while detecting domain
- [ ] Add error handling

### Context Updates
- [ ] Update `CartContext` to accept `storeId` prop
- [ ] Update `AuthContext` to accept `storeId` prop
- [ ] Test context with domain-based store ID

### Environment Configuration
- [ ] Create `.env.example` with domain variables
- [ ] Update `.env.local` for development
- [ ] Set production domain in `.env.production`

---

## Phase 3: Vercel Configuration

### Frontend Deployment
- [ ] Connect custom domain in Vercel dashboard
- [ ] Configure DNS CNAME records
- [ ] Wait for SSL certificate generation
- [ ] Test domain in browser

### Vercel Settings
- [ ] Configure allowed origins in `vercel.json`
- [ ] Add environment variables if needed
- [ ] Set up preview deployment domains

### SSL/TLS
- [ ] Verify SSL certificate is auto-generated
- [ ] Test HTTPS is working
- [ ] Check certificate renewal settings

---

## Phase 4: Backend API Domain Handling

### Option 1: Shared API (Recommended)
- [ ] Ensure API accepts cross-origin requests from custom domains
- [ ] Add `Origin` header validation
- [ ] Update CORS middleware
- [ ] Test API calls from custom domains

### Option 2: Store-Specific Subdomains
- [ ] Create DNS records for API subdomains
- [ ] Configure backend routing by subdomain
- [ ] Add API domain config to store model
- [ ] Test subdomain routing

### API Configuration
- [ ] Update API_BASE_URL in frontend `.env`
- [ ] Test API calls from different domains
- [ ] Add logging for domain-based requests

---

## Phase 5: DNS & Domain Setup

### Domain Registrar Configuration
- [ ] Log in to domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
- [ ] Add CNAME record:
  - [ ] Record Type: CNAME
  - [ ] Name: @ (root domain)
  - [ ] Value: appstores-pink.vercel.app
  - [ ] TTL: 3600 (or default)
- [ ] Verify DNS settings saved

### DNS Verification
- [ ] Run `nslookup mydomain.com`
- [ ] Confirm CNAME points to vercel.app
- [ ] Check DNS propagation (5-30 minutes)

### Vercel Configuration
- [ ] Add domain in Vercel project
- [ ] Copy Vercel's recommended DNS settings
- [ ] Verify domain shows as "Valid Configuration"
- [ ] Wait for SSL cert (automatic)

---

## Phase 6: Testing

### Local Development
- [ ] Edit `/etc/hosts` to test locally
- [ ] Test domain detection with local domains
- [ ] Test store loading by domain
- [ ] Test cart and auth with domain-based store

### Staging/Preview
- [ ] Deploy to Vercel preview
- [ ] Test with custom domain
- [ ] Test cross-domain requests
- [ ] Test mobile and desktop

### Production
- [ ] Test first customer domain setup
- [ ] Verify store loads correctly
- [ ] Test all pages work with custom domain
- [ ] Test checkout and payments
- [ ] Monitor for DNS issues

---

## Phase 7: Documentation & Support

### Admin Documentation
- [ ] Write domain setup guide for store admins
- [ ] Create step-by-step DNS instructions
- [ ] Document common DNS providers (GoDaddy, Namecheap, etc.)
- [ ] Create troubleshooting guide

### Customer Support
- [ ] Add FAQ about custom domains
- [ ] Create email template for domain setup help
- [ ] Add live chat support for domain issues

### Developer Documentation
- [ ] Document domain endpoints in API docs
- [ ] Document domain detection in frontend docs
- [ ] Create migration guide for existing stores

---

## Phase 8: Monitoring & Maintenance

### Monitoring
- [ ] Set up alerts for domain lookup errors
- [ ] Monitor API response times by domain
- [ ] Track domain verification success rate

### Maintenance
- [ ] Regular DNS health checks
- [ ] SSL certificate renewal monitoring
- [ ] Vercel domain configuration reviews
- [ ] Clean up unused domains

---

## Implementation Priority

### MVP (Minimum Viable Product)
1. Backend: Add domain fields and validation
2. Backend: Implement domain endpoints
3. Frontend: Create domain detector utility
4. Frontend: Integrate into App.js
5. Vercel: Configure one custom domain for testing
6. DNS: Set up CNAME for test domain
7. Testing: Verify domain-based routing works

### Post-MVP Enhancements
1. Add domain settings UI to admin dashboard
2. Implement automatic DNS verification
3. Add domain health monitoring
4. Multi-domain support per store
5. Vanity subdomain support
6. Domain analytics

---

## File Checklist

### Backend Files to Create/Update
- [ ] `backend/server.py` - Add domain endpoints and validation
- [ ] `backend/domain_endpoints.py` - Domain endpoint implementations (reference)
- [ ] `api/index.py` - Mirror changes for production (Vercel)

### Frontend Files to Create/Update
- [x] `frontend/src/utils/domainDetector.js` - ✓ Created
- [x] `frontend/src/components/DomainSettings.js` - ✓ Created
- [x] `frontend/src/App.integration.js` - ✓ Created (example)
- [ ] `frontend/src/App.js` - Integrate domain detection
- [ ] `frontend/.env.example` - Add domain variables
- [ ] `frontend/.env.local` - Update for development
- [ ] `frontend/src/pages/StoreAdminDashboard.js` - Add DomainSettings component

### Configuration Files
- [ ] `vercel.json` - Update rewrites and headers
- [ ] `.env` - Add domain configuration
- [ ] `.env.example` - Document domain variables

### Documentation Files
- [x] `DOMAIN_SETUP_GUIDE.md` - ✓ Created
- [ ] `API_ENDPOINTS.md` - Add domain endpoints docs
- [ ] `DEPLOYMENT.md` - Add domain deployment steps

---

## Troubleshooting Checklist

### Domain Not Resolving
- [ ] Check DNS CNAME record exists
- [ ] Verify CNAME points to appstores-pink.vercel.app
- [ ] Run `nslookup` to verify DNS
- [ ] Check TTL hasn't expired
- [ ] Wait for DNS propagation (can take 30 min)

### Store Not Loading from Domain
- [ ] Check browser console for errors
- [ ] Verify domain detector is running
- [ ] Check API endpoint returns store data
- [ ] Verify Vercel shows "Valid Configuration"
- [ ] Check CORS headers in backend

### API Requests Failing
- [ ] Check API_BASE_URL is correct
- [ ] Verify CORS allows custom domain
- [ ] Check Authorization headers present
- [ ] Verify API responses have proper headers

### SSL Certificate Issues
- [ ] Verify domain shows in Vercel "Valid Configuration"
- [ ] Wait for certificate auto-generation (up to 24 hours)
- [ ] Check certificate renewal date
- [ ] Force certificate refresh if needed

---

## Security Considerations

### Domain Validation
- [x] Validate domain format on backend
- [x] Check domain uniqueness
- [ ] Implement DNS verification
- [ ] Add domain ownership verification

### Rate Limiting
- [ ] Add rate limit to domain lookup endpoint
- [ ] Prevent domain enumeration attacks
- [ ] Log suspicious domain requests

### CORS & Headers
- [ ] Configure CORS properly for all domains
- [ ] Set appropriate security headers
- [ ] Implement SameSite cookie settings

### Data Isolation
- [ ] Ensure JWT tokens don't leak between stores
- [ ] Verify store_id from token matches domain
- [ ] Test cross-store data access prevention

---

## Performance Optimization

### Caching
- [ ] Cache store lookup results (5-10 minutes)
- [ ] Use Redis for domain→store_id mapping
- [ ] Implement cache invalidation on domain change

### Database Indexes
- [ ] Add index on `custom_domain` field
- [ ] Add index on `custom_domain_verified` field

### Frontend Performance
- [ ] Lazy load domain detection
- [ ] Cache store data in localStorage
- [ ] Implement request deduplication

---

## Rollback Plan

If issues occur:
1. [ ] Disable domain detection in frontend
2. [ ] Revert to URL parameter-based store selection
3. [ ] Remove domain endpoints temporarily
4. [ ] Revert Vercel domain configuration
5. [ ] Communicate with affected customers

---

## Sign-Off

- [ ] Backend implementation complete
- [ ] Frontend implementation complete
- [ ] Vercel configuration complete
- [ ] DNS configuration complete
- [ ] Testing complete
- [ ] Documentation complete
- [ ] Support team trained
- [ ] Ready for production

