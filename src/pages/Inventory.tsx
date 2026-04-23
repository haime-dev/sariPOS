import { useState, useEffect } from 'react';
import { Magnifer, AddCircle, Pen, TrashBinTrash, CloseCircle, Camera } from '@solar-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInventoryStore } from '../store/useInventoryStore';
import { supabase } from '../lib/supabase';
import { formatPHP } from '../utils/currency';

const categories = ['Beverages', 'Breads', 'Cakes', 'Donuts', 'Pastries', 'Sandwich'];

import { getProbableWebImage } from '../utils/getWebImage';

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const { items: inventory, addItem, removeItem, updateItem, fetchItems } = useInventoryStore();

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const autoAssignImages = async () => {
      const defaultUnsplash = "https://images.unsplash.com/photo-1549903072-7e6e0b3c2242";
      for (const item of inventory) {
        if (!item.image || item.image.includes(defaultUnsplash)) {
          const newImage = await getProbableWebImage(item.name);
          if (newImage && newImage !== item.image) {
            await updateItem(item.id, { ...item, image: newImage });
          }
        }
      }
    };
    
    // Only run this auto-assignment once to prevent infinite loops
    if (inventory.length > 0 && !localStorage.getItem('v1_images_assigned')) {
      autoAssignImages().then(() => {
        localStorage.setItem('v1_images_assigned', 'true');
      });
    }
  }, [inventory, updateItem]);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [newItem, setNewItem] = useState<{
    name: string;

    category: string;
    price: string | number;
    originalPrice: string | number;
    stock: string | number;
    status: 'In Stock' | 'Low Stock' | 'Out of Stock';
    image: string;
  }>({
    name: '',

    category: 'Breads',
    price: '',
    originalPrice: '',
    stock: '',
    status: 'In Stock',
    image: 'https://images.unsplash.com/photo-1549903072-7e6e0b3c2242?auto=format&fit=crop&q=80&w=200&h=200'
  });

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' ? true : item.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' ? true : item.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedPrice = typeof newItem.price === 'string' ? parseFloat(newItem.price as string) || 0 : newItem.price;
    const parsedOriginalPrice = typeof newItem.originalPrice === 'string' ? parseFloat(newItem.originalPrice as string) || 0 : newItem.originalPrice;
    const parsedStock = typeof newItem.stock === 'string' ? parseInt(newItem.stock as string) || 0 : newItem.stock;

    const statusValue: 'In Stock' | 'Low Stock' | 'Out of Stock' = 
      parsedStock <= 0 ? 'Out of Stock' : 
      parsedStock < 10 ? 'Low Stock' : 
      'In Stock';

    const { price, stock, originalPrice, ...restNewItem } = newItem;

    const itemData = {
      ...restNewItem,
      price: parsedPrice,
      original_price: parsedOriginalPrice,
      stock: parsedStock,
      status: statusValue
    };

    if (editingItemId) {
      updateItem(editingItemId, itemData);
    } else {
      addItem(itemData);
    }

    setIsAddModalOpen(false);
    setEditingItemId(null);
    setNewItem({
      name: '',

      category: 'Breads',
      price: '',
      originalPrice: '',
      stock: '',
      status: 'In Stock',
      image: 'https://images.unsplash.com/photo-1549903072-7e6e0b3c2242?auto=format&fit=crop&q=80&w=200&h=200'
    });
  };

  const handleEditClick = (item: any) => {
    setEditingItemId(item.id);
    setNewItem({
      name: item.name,

      category: item.category,
      price: item.price,
      originalPrice: item.original_price || item.originalPrice || '',
      stock: item.stock,
      status: item.status,
      image: item.image || 'https://images.unsplash.com/photo-1549903072-7e6e0b3c2242?auto=format&fit=crop&q=80&w=200&h=200'
    });
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingItemId(null);
    setNewItem({
      name: '',

      category: 'Breads',
      price: '',
      originalPrice: '',
      stock: '',
      status: 'In Stock',
      image: 'https://images.unsplash.com/photo-1549903072-7e6e0b3c2242?auto=format&fit=crop&q=80&w=200&h=200'
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setNewItem({ ...newItem, image: data.publicUrl });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image!');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-outfit">Inventory Management</h1>
          <p className="text-gray-200 text-sm mt-1">Manage your products, pricing, and stock levels</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-2xl hover:bg-primary-600 transition-colors shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] font-medium"
          >
            <AddCircle className="w-5 h-5" />
            Add Product
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
      >
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
          <div className="relative w-full max-w-md">
            <Magnifer className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search products by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 transition-all text-sm"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 cursor-pointer text-gray-700 w-full sm:w-auto"
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 cursor-pointer text-gray-700 w-full sm:w-auto"
            >
              <option value="All">All Status</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto hide-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/95 backdrop-blur-sm shadow-sm z-10">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>

                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Orig. Price</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Selling Price</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Stock</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total Capital</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Margin</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                      <span className="font-medium text-gray-900">{item.name}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg font-medium">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-500 text-right">{formatPHP(item.original_price || 0)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{formatPHP(item.price)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-center font-medium">{item.stock}</td>
                  <td className="px-6 py-4 text-sm font-medium text-primary-600 text-right">{formatPHP((item.original_price || 0) * item.stock)}</td>
                  <td className="px-6 py-4 text-sm font-bold text-success text-right">
                    {item.original_price && item.original_price > 0 
                      ? `${Math.round(((item.price / item.original_price) - 1) * 100)}%` 
                      : '0%'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border
                      ${item.status === 'In Stock' ? 'bg-green-50 text-green-700 border-green-200' : 
                        item.status === 'Low Stock' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                        'bg-red-50 text-red-700 border-red-200'}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEditClick(item)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                        <Pen className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setItemToDelete(item);
                          setDeleteError(null);
                        }} 
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <TrashBinTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredInventory.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              No products found. Start by adding a new product!
            </div>
          )}
        </div>
      </motion.div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-xl relative z-10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-xl font-medium text-gray-900 font-outfit">{editingItemId ? 'Edit Product' : 'Add New Product'}</h2>
                <button 
                  onClick={handleCloseModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <CloseCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="flex justify-center mb-6">
                  <div className="relative group cursor-pointer">
                    <div className="w-24 h-24 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-primary-300 group-hover:bg-primary-50 relative">
                      {isUploading ? (
                        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      ) : newItem.image && newItem.image !== 'https://images.unsplash.com/photo-1549903072-7e6e0b3c2242?auto=format&fit=crop&q=80&w=200&h=200' ? (
                        <img src={newItem.image} alt="Product" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-gray-400 group-hover:text-primary-500 mb-1" />
                          <span className="text-[10px] text-gray-400 font-medium group-hover:text-primary-600">Upload Photo</span>
                        </>
                      )}
                    </div>
                    {/* Simulated file input wrapper */}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                      className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                      title="Upload Photo" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                    <input 
                      type="text" 
                      required
                      value={newItem.name}
                      onChange={(e) => {
                        const words = e.target.value.split(' ');
                        const capitalized = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        setNewItem({...newItem, name: capitalized});
                      }}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select 
                      value={newItem.category}
                      onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Original Price (₱)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      required
                      value={newItem.originalPrice}
                      onChange={(e) => setNewItem({...newItem, originalPrice: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (₱)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      required
                      value={newItem.price}
                      onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                    <input 
                      type="number" 
                      min="0"
                      required
                      value={newItem.stock}
                      onChange={(e) => setNewItem({...newItem, stock: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-4 bg-primary-500 text-white rounded-2xl hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/30 font-medium"
                  >
                    {editingItemId ? 'Save Changes' : 'Save Product'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Product Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setItemToDelete(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-white rounded-3xl shadow-xl relative z-10 overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                  <TrashBinTrash className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 font-outfit">Delete Product</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Are you sure you want to delete <span className="font-semibold text-gray-900">"{itemToDelete.name}"</span>? This action cannot be undone.
                </p>
                
                {deleteError && (
                  <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-xl text-left border border-red-100">
                    {deleteError}
                  </div>
                )}
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setItemToDelete(null)}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      const success = await removeItem(itemToDelete.id);
                      if (success) {
                        setItemToDelete(null);
                      } else {
                        setDeleteError('Cannot delete this product. It may be part of existing orders. Try setting stock to 0 instead.');
                      }
                    }}
                    className="flex-1 py-3 px-4 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-colors font-medium shadow-lg shadow-red-500/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
