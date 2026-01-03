import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Loader2, ShoppingBag } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            const response = await loginApi(email, password);
            login(response.data.access_token, response.data.user);
            toast.success('Login successful!');
            
            // Redirect based on role
            const role = response.data.user.role;
            if (role === 'super_admin') {
                navigate('/admin');
            } else if (role === 'store_admin' || role === 'store_user') {
                navigate('/store-admin');
            } else {
                navigate('/shop');
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background noise-overlay p-4">
            <div className="w-full max-w-md animate-fade-in">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gold-gradient mb-4">
                        <ShoppingBag className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-serif tracking-tight text-foreground">Welcome Back</h1>
                    <p className="text-muted-foreground mt-2">Sign in to your account</p>
                </div>

                <Card className="luxury-card">
                    <CardHeader>
                        <CardTitle className="font-serif">Sign In</CardTitle>
                        <CardDescription>Enter your credentials to continue</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-12"
                                    data-testid="login-email-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-12"
                                    data-testid="login-password-input"
                                />
                            </div>
                            <Button 
                                type="submit" 
                                className="w-full h-12 gold-gradient text-white hover:opacity-90 transition-opacity"
                                disabled={loading}
                                data-testid="login-submit-btn"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                Sign In
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-muted-foreground">
                                Don't have an account?{' '}
                                <Link to="/register" className="gold-text hover:underline font-medium">
                                    Create one
                                </Link>
                            </p>
                        </div>

                        <div className="mt-4 p-4 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground text-center">
                                <strong>Demo Login:</strong><br />
                                Super Admin: admin@admin.com / admin123
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Login;
