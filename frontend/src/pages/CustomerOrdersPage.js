import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getMyOrders, getOrders, getProduct, adminCreateShiprocketOrder, adminSyncShiprocketOrder, adminCancelShiprocketOrder, adminShiprocketAction } from '../lib/api';
import { formatCurrency, getImageUrl } from '../lib/utils';
import { toast } from 'sonner';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const CustomerOrdersPage = () => {
	// Add a log to confirm rendering
	console.log('[CustomerOrdersPage] Component rendered');

	const { storeId } = useParams();
	const { user } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	const [orders, setOrders] = useState([]);
	const [loading, setLoading] = useState(false);
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(25);
	const [totalPages, setTotalPages] = useState(1);
	const [selected, setSelected] = useState(new Set());
	const [selectedOrder, setSelectedOrder] = useState(null);
	const [orderDetailOpen, setOrderDetailOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(true);
	const [filterText, setFilterText] = useState('');

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => { fetchOrders(page); }, [page, user]);

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const orderId = params.get('order');
		if (!orderId) return;
		const found = orders.find(o => o.id === orderId || o._id === orderId || o.order_id === orderId);
		if (found) {
			setSelectedOrder(found);
			setOrderDetailOpen(true);
		}
	}, [location.search, orders]);

	useEffect(() => {
		const enrich = async () => {
			if (!selectedOrder || !selectedOrder.items || !storeId) return;
			const needs = selectedOrder.items.filter(it => !(it.product && it.product.images && it.product.images.length > 0) && it.product_id);
			if (!needs.length) return;
			try {
				const results = await Promise.all(needs.map(it => getProduct(storeId, it.product_id).then(r => ({ id: it.product_id, product: r.data })).catch(() => null)));
				const map = {};
				results.forEach(r => { if (r && r.id) map[r.id] = r.product; });
				const newItems = selectedOrder.items.map(it => ({ ...it, product: it.product || map[it.product_id] || it.product }));
				setSelectedOrder({ ...selectedOrder, items: newItems });
			} catch (e) { console.debug('enrich failed', e); }
		};
		enrich();
	}, [selectedOrder, storeId]);

	const fetchOrders = async (p = 1) => {
		setLoading(true);
		try {
			let res;
			if (user?.role === 'store_admin' || user?.role === 'super_admin') res = await getOrders(storeId, p, limit);
			else res = await getMyOrders(p, limit);
			let items = [];
			if (res?.data?.items) { items = res.data.items; setTotalPages(res.data.pages || 1); }
			else if (Array.isArray(res?.data)) items = res.data;
			setOrders(items);
		} catch (e) { toast.error('Failed to load orders'); }
		finally { setLoading(false); }
	};

	const toggleSelect = (orderId) => setSelected(prev => { const s = new Set(prev); s.has(orderId) ? s.delete(orderId) : s.add(orderId); return s; });
	const selectAll = () => setSelected(prev => (prev.size === orders.length ? new Set() : new Set(orders.map(o => o.id))));

	const performBulk = async (action) => {
		if (!selected.size) return;
		const ids = Array.from(selected);
		try {
			for (const id of ids) {
				if (action === 'create') await adminCreateShiprocketOrder(storeId, id);
				else if (action === 'sync') await adminSyncShiprocketOrder(storeId, id);
				else if (action === 'cancel') await adminCancelShiprocketOrder(storeId, id);
				else await adminShiprocketAction(storeId, id, action);
			}
			toast.success(`Requested ${action} for ${ids.length} orders`);
			setSelected(new Set());
			fetchOrders(page);
		} catch (e) { toast.error('Bulk action failed'); }
	};

	const handleOrderAction = async (orderId, action) => {
		try {
			if (action === 'create') await adminCreateShiprocketOrder(storeId, orderId);
			else if (action === 'sync') await adminSyncShiprocketOrder(storeId, orderId);
			else if (action === 'cancel') await adminCancelShiprocketOrder(storeId, orderId);
			else await adminShiprocketAction(storeId, orderId, action);
			toast.success(`${action} requested`);
			fetchOrders(page);
		} catch (e) { toast.error('Action failed'); }
	};

	return (
		<Box sx={{ background: 'linear-gradient(135deg, #f8fafc 0%, #fbeee6 100%)', minHeight: '100vh', py: 6 }}>
			<Container maxWidth="xl">
				<Grid container spacing={4} alignItems="flex-start">
					{/* Filters Panel */}
					{/* Sidebar removed, search will be adjacent to orders */}

					{/* Orders Panel */}
					<Grid item xs={12} md={12} lg={12}>
						<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
							<Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: 1.5, color: 'primary.main' }}>Orders</Typography>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
								{/* Search bar now adjacent to orders */}
								<input value={filterText} onChange={(e) => setFilterText(e.target.value)} style={{ width: 260, padding: 12, borderRadius: 12, border: '1.5px solid #e0e0e0', fontSize: 16, outline: 'none', transition: 'box-shadow 0.2s', boxShadow: '0 2px 8px 0 rgba(79,70,229,0.04)' }} placeholder="Order ID, SKU, customer..." />
								<Button variant="contained" color="primary" onClick={() => fetchOrders(1)} startIcon={<RefreshIcon />} sx={{ borderRadius: 3, fontWeight: 600 }}>Apply</Button>
								<Button variant="outlined" onClick={() => setFilterText('')} sx={{ borderRadius: 3 }}>Clear</Button>
								<Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ borderRadius: 3, fontWeight: 600 }}>Back</Button>
								<Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => fetchOrders(1)} sx={{ borderRadius: 3 }}>Refresh</Button>
							</Box>
						</Box>

						<Card elevation={8} sx={{ mb: 3, borderRadius: 5, boxShadow: '0 8px 40px 0 rgba(79,70,229,0.13)' }}>
							<CardContent>
								<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
									<Stack direction="row" spacing={3} alignItems="center">
										<Checkbox checked={selected.size === orders.length && orders.length>0} onChange={selectAll} sx={{ borderRadius: 2 }} />
										<Typography variant="body1" sx={{ fontWeight: 600, fontSize: 18 }}>{selected.size} selected</Typography>
									</Stack>
									<Stack direction="row" spacing={2}>
										{(user?.role === 'store_admin' || user?.role === 'super_admin') && (
											<>
												<Button variant="contained" onClick={() => performBulk('create')} sx={{ borderRadius: 3, fontWeight: 600 }}>Create</Button>
												<Button variant="outlined" onClick={() => performBulk('sync')} sx={{ borderRadius: 3 }}>Sync</Button>
												<Button color="error" variant="outlined" onClick={() => performBulk('cancel')} sx={{ borderRadius: 3 }}>Cancel</Button>
											</>
										)}
									</Stack>
								</Box>

								<Grid container spacing={3} sx={{ mt: 1 }}>
									{orders.map(o => (
										<Grid item key={o.id} xs={12} sm={6} md={4}>
											<Card
												onClick={() => toggleSelect(o.id)}
												elevation={selected.has(o.id) ? 12 : 3}
												sx={{
													cursor: 'pointer',
													borderRadius: 5,
													border: selected.has(o.id) ? '2.5px solid #7c3aed' : '1.5px solid #f3e8ff',
													transition: 'box-shadow 0.2s, border 0.2s, transform 0.15s',
													boxShadow: selected.has(o.id)
														? '0 8px 32px 0 rgba(124,58,237,0.18)'
														: '0 2px 12px 0 rgba(79,70,229,0.07)',
													'&:hover': {
														transform: 'scale(1.035)',
														boxShadow: '0 12px 40px 0 rgba(79,70,229,0.18)',
														border: '2.5px solid #7c3aed',
													},
												}}
											>
												<CardContent>
													<Stack direction="row" spacing={2.5} alignItems="center">
														<Box sx={{ bgcolor: 'primary.main', color: '#fff', borderRadius: '50%', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 2px 12px 0 rgba(124,58,237,0.10)' }}>
															<Inventory2Icon fontSize="large" />
														</Box>
														<Box sx={{ flex: 1 }}>
															<Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#7c3aed', letterSpacing: 1 }}>Order</Typography>
															<Typography component="a" onClick={(e) => { e.stopPropagation(); navigate(`/store/${storeId}/orders?order=${o.id}`); }} sx={{ color: 'primary.main', fontFamily: 'monospace', display: 'block', cursor: 'pointer', fontSize: 18, fontWeight: 700, textDecoration: 'underline', mb: 0.5 }}>{o.id}</Typography>
															<Typography variant="body2" sx={{ color: '#6366f1', fontWeight: 500 }}>Item: {(() => { const items = o.items || []; if (items.length === 0) return '-'; if (items.length > 1) return 'MIXED'; const it = items[0]; return it.item_number || it.sku || it.product?.sku || it.product_id || it.product_name || '-'; })()}</Typography>
														</Box>
													</Stack>
													<Box sx={{ mt: 2 }}>
														<Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 600 }}>Destination: {o.shipping_address?.city || o.destination_city || '-'}, {o.shipping_address?.state || o.destination_state || '-'}</Typography>
														<Typography variant="caption" display="block" sx={{ color: '#a78bfa', fontWeight: 600 }}>Pincode: {o.shipping_address?.postal_code || o.destination_pincode || '-'}</Typography>
													</Box>
												</CardContent>
											</Card>
										</Grid>
									))}
								</Grid>
							</CardContent>
						</Card>

						<Dialog open={orderDetailOpen} onClose={() => { setOrderDetailOpen(false); const params = new URLSearchParams(location.search); if (params.has('order')) { params.delete('order'); navigate(`${location.pathname}${params.toString() ? ('?' + params.toString()) : ''}`, { replace: true }); } setSelectedOrder(null); }} fullWidth maxWidth="md">
							<DialogTitle sx={{ fontWeight: 900, fontSize: 28, color: 'primary.main', letterSpacing: 1.2 }}>Order Details</DialogTitle>
							<DialogContent dividers sx={{ background: '#f8fafc' }}>
								{selectedOrder ? (
									<Stack spacing={3}>
										{selectedOrder.items?.map((it, idx) => {
											const imageUrl = it.product?.images?.[0]
												? getImageUrl(it.product.images[0])
												: getImageUrl(it.image || selectedOrder.store_image_placeholder);

											console.log('Image URL:', imageUrl); // Debugging log to inspect image URL

											return (
												<Card key={idx} variant="outlined" sx={{ borderRadius: 4, boxShadow: '0 2px 12px 0 rgba(124,58,237,0.10)', border: '1.5px solid #e0e7ff' }}>
													<CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
														<Stack direction="row" spacing={3} alignItems="center">
															<div className="w-16 h-16 rounded bg-muted overflow-hidden">
																<img
																	src={imageUrl}
																	alt={it.product_name || it.sku || `SKU-${idx+1}`}
																	className="w-full h-full object-cover"
																	onError={(e) => {
																		e.target.onerror = null;
																		e.target.src = 'https://placehold.co/56x56?text=No+Img';
																	}}
																/>
															</div>
															<Box>
																<Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18 }}>{it.sku || it.item_number || it.product?.sku || it.product_id || `SKU-${idx+1}`}</Typography>
																<Typography variant="body1" sx={{ fontWeight: 600 }}>{it.product_name || it.description || it.product?.name || ''}</Typography>
																<Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 600 }}>Qty: {it.quantity || 0}</Typography>
															</Box>
														</Stack>
														<Typography sx={{ fontWeight: 900, fontSize: 22, color: 'primary.main' }}>{formatCurrency((it.price || 0) * (it.quantity || 1), selectedOrder.currency || 'INR')}</Typography>
													</CardContent>
												</Card>
											);
										})}
									</Stack>
								) : (
									<Typography>Loading...</Typography>
								)}
							</DialogContent>
							<DialogActions>
								{(user?.role === 'store_admin' || user?.role === 'super_admin') && (
									<>
										<Button onClick={() => handleOrderAction(selectedOrder?.id, 'create')} sx={{ borderRadius: 3, fontWeight: 600 }}>Create</Button>
										<Button onClick={() => handleOrderAction(selectedOrder?.id, 'sync')} sx={{ borderRadius: 3 }}>Sync</Button>
										<Button color="error" onClick={() => handleOrderAction(selectedOrder?.id, 'cancel')} sx={{ borderRadius: 3 }}>Cancel</Button>
									</>
								)}
								<Button onClick={() => setOrderDetailOpen(false)} sx={{ borderRadius: 3 }}>Close</Button>
							</DialogActions>
						</Dialog>

						<Box sx={{ mt: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<Typography variant="caption" sx={{ fontSize: 16, color: '#6366f1', fontWeight: 600 }}>Showing {(page-1)*limit + 1} - {Math.min(page*limit, orders.length)} of {orders.length} Records</Typography>
							<Stack direction="row" spacing={2} alignItems="center">
								<Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} sx={{ borderRadius: 3, fontWeight: 600 }}>◀</Button>
								<Typography sx={{ fontWeight: 700, fontSize: 18 }}>Page {page} of {totalPages}</Typography>
								<Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} sx={{ borderRadius: 3, fontWeight: 600 }}>▶</Button>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
									<Typography variant="caption" sx={{ fontSize: 15, color: '#6366f1', fontWeight: 600 }}>Records</Typography>
									<select value={limit} onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); fetchOrders(1); }} style={{ padding: 8, borderRadius: 8, fontSize: 16, border: '1.5px solid #e0e0e0', outline: 'none' }}>
										<option value={10}>10</option>
										<option value={25}>25</option>
										<option value={50}>50</option>
									</select>
								</Box>
							</Stack>
						</Box>
					</Grid>
				</Grid>
			</Container>
		</Box>
	);
};

export default CustomerOrdersPage;
