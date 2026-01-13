import React, { useState, useEffect } from 'react';
import { getShiprocketLogs } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { RefreshCw, AlertCircle, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatDateTime } from '../../lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription, DialogHeader } from '../ui/dialog';

const ShiprocketLogs = ({ storeId }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const res = await getShiprocketLogs(storeId, page);
            if (res.data.items) {
                 setLogs(res.data.items);
                 setTotalPages(res.data.pages);
            } else {
                 setLogs(res.data || []);
            }
        } catch (error) {
            console.error("Failed to load logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (storeId) loadLogs();
    }, [storeId, page]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'success': return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Success</Badge>;
            case 'error': 
            case 'failed': return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Error</Badge>;
            case 'pending': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Shiprocket Logs</h2>
                    <p className="text-muted-foreground">Monitor Shiprocket API interactions and errors.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={loadLogs} disabled={loading} variant="outline" size="sm">
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No logs found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="whitespace-nowrap font-mono text-xs">
                                            {formatDateTime(log.created_at)}
                                        </TableCell>
                                        <TableCell className="font-medium">{log.action}</TableCell>
                                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="max-w-[300px] truncate text-xs font-mono text-muted-foreground">
                                                    {log.error ? (
                                                        <span className="text-destructive">{log.error}</span>
                                                    ) : (
                                                        JSON.stringify(log.payload || log.response)
                                                    )}
                                                </div>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="link" size="sm" className="h-auto p-0 text-xs">View</Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                                        <DialogHeader>
                                                            <DialogTitle>Log Details</DialogTitle>
                                                            <DialogDescription>{log.action} - {log.id}</DialogDescription>
                                                        </DialogHeader>
                                                        <div className="space-y-4">
                                                            <div>
                                                                <h4 className="font-semibold text-sm mb-1">Payload</h4>
                                                                <pre className="bg-muted p-2 rounded text-xs overflow-auto whitespace-pre-wrap">
                                                                    {JSON.stringify(log.payload, null, 2)}
                                                                </pre>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-sm mb-1">Response / Error</h4>
                                                                <pre className="bg-muted p-2 rounded text-xs overflow-auto whitespace-pre-wrap">
                                                                    {log.error ? log.error : JSON.stringify(log.response, null, 2)}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="flex items-center justify-end space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                </Button>
                <div className="text-sm font-medium">
                    Page {page} of {totalPages}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>
        </div>
    );
};

export default ShiprocketLogs;
