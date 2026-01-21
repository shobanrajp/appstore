import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { getStoreTaxConfig, updateStoreTaxConfig, getProducts } from '../lib/api';
import { toast } from 'sonner';

const StoreTaxConfig = ({ storeId }) => {
    const [config, setConfig] = useState(null);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const metals = ['gold', 'silver', 'platinum'];

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [configRes, productsRes] = await Promise.all([
                    getStoreTaxConfig(storeId),
                    getProducts(storeId)
                ]);
                
                setConfig(configRes.data);
                
                // Extract unique categories
                const uniqueCats = [...new Set(productsRes.data.map(p => p.category).filter(Boolean))];
                setCategories(uniqueCats);
                
                // Ensure config has entries for all categories
                const currentCatTaxes = configRes.data.category_taxes || [];
                const mergedCatTaxes = uniqueCats.map(cat => {
                    const existing = currentCatTaxes.find(t => t.category === cat);
                    return existing || { category: cat, tax_rate: { cgst: 0, igst: 0 } };
                });
                
                // Ensure config has entries for all metals
                const currentMetalTaxes = configRes.data.metal_taxes || [];
                const mergedMetalTaxes = metals.map(metal => {
                    const existing = currentMetalTaxes.find(t => t.metal === metal);
                    return existing || { metal: metal, tax_rate: { cgst: 0, igst: 0 }, is_enabled: false };
                });

                setConfig({
                    ...configRes.data,
                    category_taxes: mergedCatTaxes,
                    metal_taxes: mergedMetalTaxes
                });

            } catch (error) {
                console.error("Failed to fetch tax config", error);
                toast.error("Failed to load tax configuration");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [storeId]);

    const handleCategoryChange = (index, field, value) => {
        const newTaxes = [...config.category_taxes];
        newTaxes[index].tax_rate[field] = parseFloat(value) || 0;
        setConfig({ ...config, category_taxes: newTaxes });
    };

    const handleMetalChange = (index, field, value) => {
        const newTaxes = [...config.metal_taxes];
        if (field === 'is_enabled') {
            newTaxes[index][field] = value;
        } else {
            newTaxes[index].tax_rate[field] = parseFloat(value) || 0;
        }
        setConfig({ ...config, metal_taxes: newTaxes });
    };

    const handleSave = async () => {
        try {
            await updateStoreTaxConfig(storeId, config);
            toast.success("Tax configuration updated");
        } catch (error) {
            console.error(error);
            toast.error("Failed to update tax configuration");
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!config) return <div>Failed to load configuration. Please try refreshing.</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tax Configuration</CardTitle>
                <CardDescription>Configure CGST and IGST for categories and precious metals.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="categories">
                    <TabsList className="mb-4">
                        <TabsTrigger value="categories">Categories</TabsTrigger>
                        <TabsTrigger value="metals">Metals</TabsTrigger>
                    </TabsList>

                    <TabsContent value="categories">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Category</TableHead>
                                        <TableHead>CGST (%)</TableHead>
                                        <TableHead>IGST (%)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {config.category_taxes.map((cat, index) => (
                                        <TableRow key={cat.category}>
                                            <TableCell className="font-medium">{cat.category}</TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    value={cat.tax_rate.cgst} 
                                                    onChange={(e) => handleCategoryChange(index, 'cgst', e.target.value)}
                                                    className="w-24"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    value={cat.tax_rate.igst} 
                                                    onChange={(e) => handleCategoryChange(index, 'igst', e.target.value)}
                                                    className="w-24"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {config.category_taxes.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center">No categories found. Add products with categories first.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="metals">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Metal</TableHead>
                                        <TableHead>Enabled</TableHead>
                                        <TableHead>CGST (%)</TableHead>
                                        <TableHead>IGST (%)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {config.metal_taxes.map((metal, index) => (
                                        <TableRow key={metal.metal}>
                                            <TableCell className="capitalize">{metal.metal}</TableCell>
                                            <TableCell>
                                                <Switch 
                                                    checked={metal.is_enabled}
                                                    onCheckedChange={(checked) => handleMetalChange(index, 'is_enabled', checked)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    value={metal.tax_rate.cgst} 
                                                    onChange={(e) => handleMetalChange(index, 'cgst', e.target.value)}
                                                    disabled={!metal.is_enabled}
                                                    className="w-24"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    value={metal.tax_rate.igst} 
                                                    onChange={(e) => handleMetalChange(index, 'igst', e.target.value)}
                                                    disabled={!metal.is_enabled}
                                                    className="w-24"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
                <div className="mt-4 flex justify-end">
                    <Button onClick={handleSave}>Save Changes</Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default StoreTaxConfig;