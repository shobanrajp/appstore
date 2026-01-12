import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from 'sonner';
import api from '../../lib/api';
import { Truck, Save, ExternalLink, Activity } from 'lucide-react';
import { formatDateTime, formatCurrency } from '../../lib/utils';

const StoreShippingSettings = ({ storeId }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logs, setLogs] = useState([]);
    const [config, setConfig] = useState({
        is_enabled: false,
        provider: 'shiprocket',
        email: '',
        password: '',
        pickup_pincode: ''
    });

    useEffect(() => {
        loadConfig();
        loadLogs();
    }, [storeId]);

    const loadConfig = async () => {
        try {
            const res = await api.get(`/stores/${storeId}/shipping-config`);
            setConfig(prev => ({
                ...prev,
                ...res.data,
                password: '' // Don't show password
            }));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadLogs = async () => {
        try {
            const res = await api.get(`/stores/${storeId}/shipping-logs`);
            setLogs(res.data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/stores/${storeId}/shipping-config`, config);
            toast.success('Shipping configuration saved');
            loadConfig(); 
        } catch (error) {
            console.error(error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
        <Card className="max-w-2xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" /> Shipping Configuration
                </CardTitle>
                <CardDescription>
                    Configure Shiprocket integration for automated shipping rates and label generation.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                        <Label className="text-base">Enable Shipping Integration</Label>
                        <p className="text-sm text-muted-foreground">
                            Calculate shipping rates automatically during checkout.
                        </p>
                    </div>
                    <Switch
                        checked={config.is_enabled}
                        onCheckedChange={(checked) => setConfig({ ...config, is_enabled: checked })}
                    />
                </div>

                {config.is_enabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                         <div className="grid gap-2">
                            <Label>Provider</Label>
                            <Input value="Shiprocket" disabled />
                        </div>

                        <div className="grid gap-2">
                            <Label>Shiprocket Pickup Pincode</Label>
                            <Input 
                                value={config.pickup_pincode || ''}
                                onChange={(e) => setConfig({ ...config, pickup_pincode: e.target.value })}
                                placeholder="e.g. 560001"
                            />
                            <p className="text-xs text-muted-foreground">
                                Must match a pickup location configured in your Shiprocket account.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label>Shiprocket Email</Label>
                            <Input 
                                value={config.email || ''}
                                onChange={(e) => setConfig({ ...config, email: e.target.value })}
                                placeholder="email@example.com"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Shiprocket Password</Label>
                            <Input 
                                type="password"
                                value={config.password || ''}
                                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                                placeholder={config.email ? '(Unchanged)' : 'Enter password'}
                            />
                        </div>

                        <div className="flex items-center gap-2 text-sm text-blue-600">
                            <ExternalLink className="w-4 h-4" />
                            <a href="https://app.shiprocket.in/register" target="_blank" rel="noreferrer" className="hover:underline">
                                Don't have a Shiprocket account? Sign up here.
                            </a>
                        </div>
                    </div>
                )}

                <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
            </CardContent>
        </Card>

        {config.is_enabled && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" /> Recent Shipping Requests
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="max-h-[300px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>From / To</TableHead>
                                    <TableHead>Courier</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length > 0 ? (
                                    logs.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</TableCell>
                                            <TableCell className="capitalize">{log.type}</TableCell>
                                            <TableCell className="font-mono text-xs">{log.reference_id}</TableCell>
                                            <TableCell className="text-xs">
                                                {log.pickup} → {log.destination}
                                            </TableCell>
                                            <TableCell>{log.courier || '-'}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(log.rate)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground p-4">No shipping logs found</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        )}
        </div>
    );
};

export default StoreShippingSettings;
