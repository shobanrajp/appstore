import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi, getStore, setProfileStore } from '../lib/api';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';

const StoreLogin = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { cartCount } = useCart(storeId);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [store, setStore] = useState(null);

  useEffect(() => {
    // Load store for header/footer context
    const load = async () => {
      try {
        const res = await getStore(storeId);
        setStore(res.data);
        localStorage.setItem('lastVisitedStore', storeId);
      } catch (e) {
        // keep minimal header even if store missing
      }
    };
    load();
  }, [storeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await loginApi(email, password);
      login(response.data.access_token, response.data.user);
      toast.success('Login successful!');

      const role = response.data.user.role;
      if (role === 'super_admin') {
        navigate('/');
        return;
      }
      if (role === 'store_admin' || role === 'store_user') {
        navigate(`/store/${storeId}/admin`);
        return;
      }
      // end_user: associate with this store if not already, then go to this store
      try {
        const usr = response.data.user;
        if (!usr.store_id || usr.store_id !== storeId) {
          await setProfileStore(storeId);
        }
      } catch (e) {}
      navigate(`/store/${storeId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StoreHeader store={store} storeId={storeId} cartTotal={cartCount} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="max-w-md mx-auto">
          <Card className="luxury-card">
            <CardHeader>
              <CardTitle className="font-serif">Sign In</CardTitle>
              <CardDescription>Sign in to continue shopping</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full gold-gradient text-white" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Sign In
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">New to this store?</span>
                <br />
                <Link to={`/store/${storeId}/register`} className="gold-text hover:underline">Create an account</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <StoreFooter store={store} storeId={storeId} />
    </div>
  );
};

export default StoreLogin;
