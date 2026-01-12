/**
 * Domain Settings Component
 * 
 * Allows store admins to:
 * 1. Configure custom domain
 * 2. View verification status
 * 3. Get DNS setup instructions
 * 4. Verify domain
 */

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Copy, Loader } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export function DomainSettings({ storeId }) {
  const [domain, setDomain] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [instructions, setInstructions] = useState(null);

  // Fetch current domain status
  useEffect(() => {
    const fetchDomainStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE_URL}/api/stores/${storeId}/domain-verification-status`
        );
        
        if (!response.ok) throw new Error('Failed to fetch domain status');
        
        const data = await response.json();
        
        if (data.domain) {
          setDomain(data.domain);
          setIsVerified(data.verified);
          setInstructions(data.instructions);
        }
        
        setError('');
      } catch (err) {
        console.error('Error fetching domain status:', err);
        setError('Failed to load domain settings');
      } finally {
        setLoading(false);
      }
    };

    if (storeId) {
      fetchDomainStatus();
    }
  }, [storeId]);

  const handleUpdateDomain = async (e) => {
    e.preventDefault();
    
    if (!domain.trim()) {
      setError('Please enter a domain');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch(
        `${API_BASE_URL}/api/admin/stores/${storeId}/domain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ domain: domain })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update domain');
      }

      const data = await response.json();
      setDomain(data.domain || '');
      setIsVerified(data.verified || false);
      setSuccess('Domain saved! Please follow the DNS setup instructions below.');
      setInstructions(null);
      
      // Refresh instructions
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Error updating domain:', err);
      setError(err.message || 'Failed to update domain');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDomain = async () => {
    try {
      setVerifying(true);
      setError('');
      setSuccess('');

      const response = await fetch(
        `${API_BASE_URL}/api/admin/stores/${storeId}/verify-domain`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to verify domain');
      }

      setIsVerified(true);
      setSuccess('✓ Domain verified successfully!');
    } catch (err) {
      console.error('Error verifying domain:', err);
      setError(err.message || 'Failed to verify domain');
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!window.confirm('Remove custom domain? Store will only be accessible via default domain.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/admin/stores/${storeId}/domain`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to remove domain');

      setDomain('');
      setIsVerified(false);
      setSuccess('Custom domain removed');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess(`Copied: ${text}`);
    setTimeout(() => setSuccess(''), 2000);
  };

  if (loading && !domain) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader className="animate-spin" />
            <span className="ml-2">Loading domain settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Custom Domain</CardTitle>
          <CardDescription>
            Configure a custom domain for your store (e.g., mystore.com)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
            {isVerified ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">✓ Verified</p>
                  <p className="text-sm text-green-600">{domain}</p>
                </div>
              </>
            ) : domain ? (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-semibold text-yellow-800">Pending Verification</p>
                  <p className="text-sm text-yellow-600">{domain}</p>
                </div>
              </>
            ) : (
              <p className="text-gray-600">No custom domain configured</p>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Domain Input Form */}
          {!isVerified && (
            <form onSubmit={handleUpdateDomain} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Domain Name
                </label>
                <Input
                  type="text"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={loading || isVerified}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your custom domain without https://
                </p>
              </div>
              <Button
                type="submit"
                disabled={loading || !domain}
                className="w-full"
              >
                {loading ? 'Updating...' : 'Update Domain'}
              </Button>
            </form>
          )}

          {/* Verified Domain Actions */}
          {isVerified && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Your store is now accessible at: <strong className="break-all">https://{domain}</strong>
              </p>
              <Button
                variant="outline"
                onClick={handleRemoveDomain}
                disabled={loading}
                className="w-full"
              >
                Remove Custom Domain
              </Button>
            </div>
          )}

          {/* DNS Setup Instructions */}
          {domain && !isVerified && instructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-blue-900">DNS Setup Instructions</h4>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-blue-800">Step 1: Add DNS CNAME Record</p>
                  <p className="text-blue-700 mt-1">
                    Log in to your domain registrar (GoDaddy, Namecheap, etc.) and add:
                  </p>
                  <div className="mt-2 p-2 bg-white rounded border border-blue-300 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <div>
                        <div><strong>Type:</strong> CNAME</div>
                        <div><strong>Name:</strong> @ (or your domain)</div>
                        <div><strong>Value:</strong> appstores-pink.vercel.app</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard('appstores-pink.vercel.app')}
                        className="h-8 w-8"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="font-medium text-blue-800">Step 2: Wait for DNS Propagation</p>
                  <p className="text-blue-700 mt-1">
                    DNS changes can take 5-30 minutes to propagate worldwide.
                  </p>
                  <p className="text-blue-600 text-xs mt-1">
                    Verify DNS: <code>nslookup {domain}</code>
                  </p>
                </div>

                <div>
                  <p className="font-medium text-blue-800">Step 3: Verify Domain</p>
                  <p className="text-blue-700 mt-1">
                    Once DNS is configured, click the verify button below.
                  </p>
                </div>
              </div>

              {/* Verify Button */}
              <Button
                onClick={handleVerifyDomain}
                disabled={verifying}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {verifying ? 'Verifying...' : '✓ Verify Domain'}
              </Button>

              {/* Help Link */}
              <div className="text-xs text-gray-600 border-t border-blue-200 pt-3">
                <p>
                  Need help?{' '}
                  <a 
                    href="/docs/domain-setup" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    See detailed setup guide
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* DNS Already Configured - Show Verify Button */}
          {domain && !isVerified && !instructions && (
            <Button
              onClick={handleVerifyDomain}
              disabled={verifying}
              className="w-full"
            >
              {verifying ? 'Verifying...' : 'Verify Domain'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 text-base">Why Custom Domains?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p>✓ Brand your store with your own domain</p>
          <p>✓ Professional appearance for customers</p>
          <p>✓ Build trust and credibility</p>
          <p>✓ Easy to remember and share</p>
          <p>✓ SEO benefits</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default DomainSettings;
