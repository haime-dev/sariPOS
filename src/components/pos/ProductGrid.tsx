import { useState } from 'react';
import { Magnifer, CloseCircle } from '@solar-icons/react';
import { useCartStore } from '../../store/useCartStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { formatPHP } from '../../utils/currency';
import { motion, AnimatePresence } from 'framer-motion';

const categories = ['All Menu', 'Beverages', 'Breads', 'Cakes', 'Donuts', 'Pastries', 'Sandwich'];

const categoryIcons: Record<string, string> = {
  'All Menu': '🍽️',
  'Beverages': '🥤',
  'Breads': '🍞',
  'Cakes': '🍰',
  'Donuts': '🍩',
  'Pastries': '🥐',
  'Sandwich': '🥪'
};

export default function ProductGrid() {
  const [activeCategory, setActiveCategory] = useState('All Menu');
  const [search, setSearch] = useState('');
  const { addItem, items: cartItems } = useCartStore();
  const { items: products } = useInventoryStore();

  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalMessage, setStockModalMessage] = useState('');

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'All Menu' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Categories */}
      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[100px] px-4 py-3 rounded-[2rem] transition-all whitespace-nowrap ${
              activeCategory === cat 
                ? 'bg-white border-2 border-primary-500 shadow-sm text-primary-600' 
                : 'bg-white/60 border-2 border-transparent text-gray-500 hover:bg-white/80'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-2">
              <span className="text-xl">{categoryIcons[cat] || '🍽️'}</span>
            </div>
            <span className="text-sm">{cat}</span>
            <span className="text-xs text-gray-400 mt-1">
              {cat === 'All Menu' ? products.length : products.filter(p => p.category === cat).length} Items
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Magnifer className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search something sweet on your mind..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 transition-all text-text-main placeholder:text-gray-400"
        />
      </div>

      {/* Grid */}
      {products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-200 pb-20">
          <Magnifer className="w-12 h-12 mb-4 opacity-70" />
          <p className="text-lg font-medium text-white">No products available</p>
          <p className="text-sm mt-1">Add items from the Inventory screen first.</p>
        </div>
      ) : (
      <div 
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto hide-scrollbar pb-8"
      >
        {filteredProducts.map((product) => (
          <div 
            key={product.id}
            onClick={() => {
              if (product.stock > 0) {
                const existingItem = cartItems.find((item) => item.product.id === product.id);
                if (existingItem && existingItem.quantity >= product.stock) {
                  setStockModalMessage(`Cannot add more. Only ${product.stock} items of ${product.name} left in stock.`);
                  setShowStockModal(true);
                } else {
                  addItem(product);
                }
              }
            }}
            className={`group bg-white rounded-3xl p-4 shadow-sm border hover:shadow-md transition-all flex flex-col relative
              ${product.stock <= 0 ? 'opacity-60 cursor-not-allowed border-gray-100' : 'cursor-pointer hover:-translate-y-1 border-gray-50'}
            `}
          >
            {product.stock <= 0 && (
              <div className="absolute inset-0 z-10 bg-white/40 rounded-3xl flex items-center justify-center backdrop-blur-[1px]">
                <span className="bg-danger text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">Out of Stock</span>
              </div>
            )}
            <div className="w-full h-40 rounded-2xl overflow-hidden mb-4 bg-gray-50 flex flex-shrink-0 items-center justify-center relative p-2">
              <img src={product.image} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
            </div>
            <h3 className="text-text-main mb-1 truncate">{product.name}</h3>
            <div className="flex items-center justify-between mt-auto">
              <div className="flex flex-col items-start gap-1 w-full max-w-[60%]">
                <span className="text-xs px-2 py-1 bg-primary-50 text-primary-600 rounded-lg truncate w-full shadow-sm text-center font-medium">
                  {product.category}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-medium text-gray-900">{formatPHP(product.price)}</span>
                <span className={`text-[10px] font-medium tracking-wide ${product.stock < 10 ? 'text-danger' : 'text-gray-500'}`}>
                  {product.stock} in stock
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Stock Limit Modal */}
      <AnimatePresence>
        {showStockModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStockModal(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 overflow-hidden flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-500">
                <CloseCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">Stock Limit Reached</h3>
              <p className="text-sm text-gray-500 mb-6">
                {stockModalMessage}
              </p>
              
              <button 
                onClick={() => setShowStockModal(false)}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-2xl font-medium hover:bg-gray-200 transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
