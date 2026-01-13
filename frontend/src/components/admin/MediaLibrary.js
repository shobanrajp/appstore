import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon, Trash2, FolderOpen, RefreshCw, Copy, Check } from 'lucide-react';
import axios from 'axios';

// Ensure this matches your image server port
const IMAGE_SERVER_URL = process.env.REACT_APP_IMAGE_SERVER_URL || 'http://localhost:8001';

const MediaLibrary = ({ storeId, onSelect, selectMode = false }) => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('gallery');
    
    // Upload state
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadUsage, setUploadUsage] = useState('products');
    const [uploadCategory, setUploadCategory] = useState('');
    
    // Filter state
    const [filterUsage, setFilterUsage] = useState('all');
    const [filterCategory, setFilterCategory] = useState('');

    const loadImages = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${IMAGE_SERVER_URL}/images/${storeId}`);
            setImages(res.data.images || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load images');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        if (storeId) loadImages();
    }, [storeId, loadImages]);

    const handleFileSelect = (e) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;
        
        setUploading(true);
        const formData = new FormData();
        formData.append('store_id', storeId);
        formData.append('usage', uploadUsage);
        formData.append('category', uploadCategory);
        
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await axios.post(`${IMAGE_SERVER_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(`Uploaded ${res.data.urls.length} images`);
            setSelectedFiles([]);
            setActiveTab('gallery');
            loadImages();
        } catch (error) {
            console.error(error);
            toast.error('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (image) => {
        if (!window.confirm('Are you sure you want to delete this image?')) return;
        
        try {
            // Extract relative path from URL
            // URL: http://localhost:8001/static/storeId/usage/cat/file.jpg
            const urlObj = new URL(image.url);
            const path = urlObj.pathname.replace('/static/', '');
            
            await axios.delete(`${IMAGE_SERVER_URL}/images?path=${encodeURIComponent(path)}`);
            toast.success('Image deleted');
            setImages(prev => prev.filter(img => img.url !== image.url));
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete image');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('URL copied to clipboard');
    };

    const filteredImages = images.filter(img => {
        if (filterUsage !== 'all' && img.usage !== filterUsage) return false;
        if (filterCategory && !img.category.includes(filterCategory)) return false;
        return true;
    });

    // Group images by usage/folder for easier viewing
    const usages = [...new Set(images.map(img => img.usage))];

    return (
        <div className="bg-background border rounded-lg overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-muted/30">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" /> Media Library
                </h3>
                <Button variant="ghost" size="sm" onClick={loadImages}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <div className="px-4 pt-2">
                    <TabsList className="w-full justify-start">
                        <TabsTrigger value="gallery">Gallery</TabsTrigger>
                        <TabsTrigger value="upload">Upload New</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="gallery" className="flex-1 flex flex-col p-4 gap-4 h-full min-h-0">
                    <div className="flex gap-4 items-center">
                        <div className="w-40">
                            <Select value={filterUsage} onValueChange={setFilterUsage}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by Usage" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Folders</SelectItem>
                                    <SelectItem value="products">Products</SelectItem>
                                    <SelectItem value="banners">Banners</SelectItem>
                                    <SelectItem value="logos">Logos</SelectItem>
                                    {usages.filter(u => !['products', 'banners', 'logos'].includes(u)).map(u => (
                                        <SelectItem key={u} value={u}>{u}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <Input 
                                placeholder="Filter by category path..." 
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                            />
                        </div>
                    </div>

                    <ScrollArea className="flex-1 border rounded-md bg-muted/10 p-4">
                        {filteredImages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                                <p>No images found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {filteredImages.map((img, idx) => (
                                    <div key={idx} className="group relative border rounded-lg overflow-hidden bg-background shadow-sm hover:shadow-md transition-all">
                                        <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="p-2 text-xs">
                                            <p className="font-medium truncate" title={img.name}>{img.name}</p>
                                            <p className="text-muted-foreground truncate" title={`${img.usage}/${img.category}`}>
                                                {img.usage} {img.category && `/ ${img.category}`}
                                            </p>
                                        </div>
                                        
                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            {selectMode ? (
                                                <Button size="sm" onClick={() => onSelect(img.url)}>
                                                    <Check className="w-4 h-4 mr-1" /> Select
                                                </Button>
                                            ) : (
                                                <>
                                                    <Button size="icon" variant="secondary" onClick={() => copyToClipboard(img.url)} title="Copy URL">
                                                        <Copy className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="destructive" onClick={() => handleDelete(img)} title="Delete">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="upload" className="flex-1 p-4">
                    <div className="max-w-xl mx-auto space-y-6 border p-6 rounded-lg bg-card">
                        <div className="space-y-2">
                            <Label>Upload Destination</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Usage Folder</Label>
                                    <Select value={uploadUsage} onValueChange={setUploadUsage}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="products">Products</SelectItem>
                                            <SelectItem value="banners">Banners</SelectItem>
                                            <SelectItem value="logos">Logos</SelectItem>
                                            <SelectItem value="documents">Documents</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Category Path (Optional)</Label>
                                    <Input 
                                        placeholder="e.g. electronics/phones" 
                                        value={uploadCategory}
                                        onChange={e => setUploadCategory(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => document.getElementById('file-upload').click()}
                        >
                            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                            <h4 className="font-semibold mb-1">Click to upload images</h4>
                            <p className="text-sm text-muted-foreground mb-4">or drag and drop files here</p>
                            <Input 
                                id="file-upload" 
                                type="file" 
                                multiple 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleFileSelect}
                            />
                            <Button variant="outline">Select Files</Button>
                        </div>

                        {selectedFiles.length > 0 && (
                            <div className="space-y-4">
                                <div className="text-sm font-medium">{selectedFiles.length} files selected</div>
                                <div className="max-h-40 overflow-y-auto space-y-2 border rounded p-2">
                                    {selectedFiles.map((file, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm p-2 bg-muted rounded">
                                            <span className="truncate">{file.name}</span>
                                            <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                    ))}
                                </div>
                                <Button className="w-full" onClick={handleUpload} disabled={uploading}>
                                    {uploading ? 'Uploading...' : 'Upload All Images'}
                                </Button>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default MediaLibrary;
