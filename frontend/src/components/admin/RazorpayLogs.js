import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { getRazorpayLogs } from '../../lib/api';

const RazorpayLogs = ({ storeId }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadLogs = async (pageNum = 1) => {
        setLoading(true);
        try {
            const res = await getRazorpayLogs(storeId, pageNum);
            setLogs(res.data.items);
            setTotalPages(res.data.pages || 1);
            setPage(pageNum);
        } catch (error) {
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (storeId) loadLogs(1);
    }, [storeId]);

    return (
        <Card className="border mt-6">
            <CardContent className="p-6">
                <h2 className="text-2xl font-bold tracking-tight mb-4">Razorpay Logs</h2>
                <Button onClick={() => loadLogs(page)} disabled={loading} variant="outline" size="sm" className="mb-4">Refresh</Button>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>URL</TableHead>
                            <TableHead>Request</TableHead>
                            <TableHead>Response/Error</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && logs.length === 0 ? (
                            <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow><TableCell colSpan={6}>No logs found.</TableCell></TableRow>
                        ) : logs.map((log) => (
                            <TableRow key={log.id}>
                                <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                                <TableCell>{log.action}</TableCell>
                                <TableCell>{log.status}</TableCell>
                                <TableCell>{log.url || '-'}</TableCell>
                                <TableCell><pre className="whitespace-pre-wrap text-xs max-w-xs overflow-x-auto">{JSON.stringify(log.request, null, 2)}</pre></TableCell>
                                <TableCell>
                                    {log.error ? (
                                        <span className="text-red-600 text-xs">{log.error}</span>
                                    ) : (
                                        <pre className="whitespace-pre-wrap text-xs max-w-xs overflow-x-auto">{JSON.stringify(log.response, null, 2)}</pre>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="flex justify-between items-center mt-4">
                    <Button disabled={page <= 1} onClick={() => loadLogs(page - 1)} variant="outline" size="sm">Prev</Button>
                    <span className="text-xs">Page {page} of {totalPages}</span>
                    <Button disabled={page >= totalPages} onClick={() => loadLogs(page + 1)} variant="outline" size="sm">Next</Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default RazorpayLogs;
