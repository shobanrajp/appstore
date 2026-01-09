import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register as registerApi, getStore } from '../lib/api';
import StoreHeader from '../components/StoreHeader';
import StoreFooter from '../components/StoreFooter';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';

const StoreRegister = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { cartCount } = useCart(storeId);
  const [store, setStore] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getStore(storeId);
        setStore(res.data);
        localStorage.setItem('lastVisitedStore', storeId);
      } catch (e) {}
    };
    load();
  }, [storeId]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const response = await registerApi({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'end_user',
        store_id: storeId,
      });
      login(response.data.access_token, response.data.user);
      toast.success('Account created successfully!');
      navigate(`/store/${storeId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
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
              <CardTitle className="font-serif">Create Account</CardTitle>
              <CardDescription>Register to start shopping</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" type="text" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required />
                </div>
                <Button type="submit" className="w-full gold-gradient text-white" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Account
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">Already have an account?</span>
                <br />
                <Link to={`/store/${storeId}/login`} className="gold-text hover:underline">Sign in</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <StoreFooter store={store} storeId={storeId} />
    </div>
  );
};

export default StoreRegister;
