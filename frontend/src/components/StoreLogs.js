import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatDateTime } from '../lib/utils';
import { RefreshCw, Trash2, AlertCircle } from 'lucide-react';

const MODULES = [
    { id: 'subscription_plans', label: 'Subscription Plans' },
    { id: 'payments', label: 'Payments' },
    { id: 'orders', label: 'Orders' },
    { id: 'tax_config', label: 'Tax Configuration' },
    { id: 'market_prices', label: 'Market Prices' }
];

export default function StoreLogs({ storeId }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedModule, setSelectedModule] = useState(null);
    const [logConfig, setLogConfig] = useState({
        subscription_plans: false,
        payments: false,
        orders: false,
        tax_config: false,
        market_prices: false
    });
    const [configLoading, setConfigLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);

    // Load configuration
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        loadConfig();
        loadLogs();
    }, [loadConfig, loadLogs]);

    // Auto-refresh logs every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (logs.length > 0 || Object.values(logConfig).some(v => v)) {
                loadLogs();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [logs, logConfig, loadLogs]);

    const loadConfig = useCallback(async () => {
        try {
            const response = await api.get(`/admin/stores/${storeId}/log-config`);
            if (response.data) {
                setLogConfig(response.data);
            }
        } catch (error) {
            console.error('Error loading log config:', error);
        } finally {
            setConfigLoading(false);
        }
    }, [storeId]);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            let url = `/admin/stores/${storeId}/logs?limit=200`;
            if (selectedModule) {
                url += `&module=${selectedModule}`;
            }
            const response = await api.get(url);
            if (response.data && response.data.logs) {
                setLogs(response.data.logs);
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            toast.error('Failed to load logs');
        } finally {
            setLoading(false);
        }
    }, [storeId, selectedModule]);

    const handleConfigChange = async (module, enabled) => {
        try {
            const newConfig = { ...logConfig, [module]: enabled };
            await api.put(`/admin/stores/${storeId}/log-config`, newConfig);
            setLogConfig(newConfig);
            toast.success(`Logging ${enabled ? 'enabled' : 'disabled'} for ${MODULES.find(m => m.id === module).label}`);
        } catch (error) {
            console.error('Error updating config:', error);
            toast.error('Failed to update logging configuration');
        }
    };

    const handleClearLogs = async () => {
        if (!window.confirm('Are you sure you want to delete all logs?')) return;
        try {
            let url = `/admin/stores/${storeId}/logs`;
            if (selectedModule) {
                url += `?module=${selectedModule}`;
            }
            await api.delete(url);
            setLogs([]);
            toast.success('Logs cleared');
        } catch (error) {
            console.error('Error clearing logs:', error);
            toast.error('Failed to clear logs');
        }
    };

    if (configLoading) {
        return <div className="flex justify-center items-center p-8">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Configuration Panel */}
            <Card>
                <CardHeader>
                    <CardTitle>Logging Configuration</CardTitle>
                    <CardDescription>Enable or disable logging for each module</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {MODULES.map(module => (
                            <div key={module.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                                <Label className="flex-1 cursor-pointer">{module.label}</Label>
                                <Switch
                                    checked={logConfig[module.id]}
                                    onCheckedChange={(checked) => handleConfigChange(module.id, checked)}
                                />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Logs Viewer */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Activity Logs</CardTitle>
                            <CardDescription>View logs from enabled modules</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                            </Button>
                            <Button variant="destructive" size="sm" onClick={handleClearLogs}>
                                <Trash2 className="w-4 h-4 mr-2" /> Clear
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Select value={selectedModule || 'all'} onValueChange={(v) => setSelectedModule(v === 'all' ? null : v)}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Filter by module..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Modules</SelectItem>
                                    {MODULES.map(module => (
                                        <SelectItem key={module.id} value={module.id}>
                                            {module.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {logs.length === 0 ? (
                            <div className="flex justify-center items-center p-8 text-muted-foreground">
                                <AlertCircle className="w-4 h-4 mr-2" />
                                {Object.values(logConfig).some(v => v) ? 'No logs yet' : 'Enable logging to see activity'}
                            </div>
                        ) : (
                            <ScrollArea className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Time</TableHead>
                                            <TableHead>Module</TableHead>
                                            <TableHead>Level</TableHead>
                                            <TableHead>Message</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map(log => (
                                            <TableRow 
                                                key={log.id} 
                                                className="cursor-pointer hover:bg-muted"
                                                onClick={() => {
                                                    setSelectedLog(log);
                                                    setShowDetails(true);
                                                }}
                                            >
                                                <TableCell className="text-sm whitespace-nowrap">
                                                    {formatDateTime(log.timestamp)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{log.module}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={log.level === 'error' ? 'destructive' : log.level === 'warning' ? 'secondary' : 'default'}>
                                                        {log.level}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm max-w-md truncate">
                                                    {log.message}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Log Details Modal */}
            {selectedLog && (
                <Dialog open={showDetails} onOpenChange={setShowDetails}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Log Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label className="text-xs text-muted-foreground">Time</Label>
                                <p className="text-sm font-mono">{formatDateTime(selectedLog.timestamp)}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Module</Label>
                                <p className="text-sm"><Badge>{selectedLog.module}</Badge></p>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Level</Label>
                                <p className="text-sm">
                                    <Badge variant={selectedLog.level === 'error' ? 'destructive' : selectedLog.level === 'warning' ? 'secondary' : 'default'}>
                                        {selectedLog.level}
                                    </Badge>
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Message</Label>
                                <p className="text-sm mt-1">{selectedLog.message}</p>
                            </div>
                            {selectedLog.context && Object.keys(selectedLog.context).length > 0 && (
                                <div>
                                    <Label className="text-xs text-muted-foreground">Context</Label>
                                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-48">
                                        {JSON.stringify(selectedLog.context, null, 2)}
                                    </pre>
                                </div>
                            )}
                            {selectedLog.raw_log && (
                                <div>
                                    <Label className="text-xs text-muted-foreground">Server Log Marker</Label>
                                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-24 font-mono">
                                        {selectedLog.raw_log}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
