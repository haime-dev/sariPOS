import { useState, useEffect } from 'react';
import { useCartStore } from '../../store/useCartStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { formatPHP } from '../../utils/currency';
import { MinusCircle, AddCircle, TrashBinTrash, BillList } from '@solar-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInventoryStore } from '../../store/useInventoryStore';

export default function Cart() {
  const { items, updateQuantity, clearCart, removeItem } = useCartStore();
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const transactions = useTransactionStore((state) => state.transactions);
  
  // Calculate totals inline since Zustand getters aren't reactive when destructured
  const subtotal = items.reduce((sum, item) => sum + (item.isExpense ? 0 : item.product.price * item.quantity), 0);
  const total = subtotal;
  
  const [isTaxEnabled, setIsTaxEnabled] = useState(false);
  const [taxRateInput, setTaxRateInput] = useState('10'); // Default 10%
  
  const taxRate = isTaxEnabled ? (parseFloat(taxRateInput) / 100) || 0 : 0;
  const taxAmount = subtotal * taxRate;
  const finalTotal = total + taxAmount;

  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);
  
  const [customerName, setCustomerName] = useState('Walk-in');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Partially Paid'>('Paid');
  const [amountPaidInput, setAmountPaidInput] = useState('');

  // Modal states
  const [showStockModal, setShowStockModal] = useState(false);
  const [outOfStockItemNames, setOutOfStockItemNames] = useState<string[]>([]);
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // If items are added to the cart while we are showing success, clear it immediately
  useEffect(() => {
    if (items.length > 0 && orderSuccess) {
      setOrderSuccess(false);
      setLastTransactionId(null);
    }
  }, [items.length, orderSuccess]);

  // Automatically set customer name to Family Expense if any item is marked as expense
  useEffect(() => {
    const hasExpense = items.some(item => item.isExpense);
    if (hasExpense && customerName !== 'Family Expense') {
      setCustomerName('Family Expense');
    } else if (!hasExpense && customerName === 'Family Expense') {
      setCustomerName('Walk-in');
    }
  }, [items, customerName]);

  const handleDismissSuccess = () => {
    setOrderSuccess(false);
    setLastTransactionId(null);
  };

  const confirmAndPlaceOrder = async () => {
    setShowStockModal(false);
    setIsOrdering(true);
    setOrderError(null);
    
    let finalAmountPaid = 0;
    if (paymentStatus === 'Paid') {
      finalAmountPaid = finalTotal;
    } else if (paymentStatus === 'Partially Paid') {
      finalAmountPaid = parseFloat(amountPaidInput) || 0;
    }

    // Record the transaction for the Dashboard
    const newTransaction = await addTransaction({
      customer: customerName.trim() || 'Walk-in',
      status: "Done",
      payment: paymentStatus,
      total: finalTotal,
      amount_paid: finalAmountPaid,
      items: [...items],
    });

    if (newTransaction) {
      setLastTransactionId(newTransaction.id);
      setIsOrdering(false);
      setOrderSuccess(true);
      clearCart();
      setCustomerName('Walk-in'); // Reset to default after order
      setPaymentStatus('Paid');
      setAmountPaidInput('');
      
      // Provide a 10 second window for the user to undo the transaction
      setTimeout(() => {
        setOrderSuccess(false);
        setLastTransactionId(null);
      }, 10000);
    } else {
      setIsOrdering(false);
      setOrderError("Failed to place order. Ensure 'amount_paid' column exists in Supabase.");
    }
  };

  const handlePlaceOrder = async () => {
    // Check for out of stock items
    const outOfStockItems = items.filter(item => item.product.stock < item.quantity);
    if (outOfStockItems.length > 0) {
      setOutOfStockItemNames(outOfStockItems.map(i => i.product.name));
      setShowStockModal(true);
      return;
    }

    if (transactions.length > 0) {
      const lastOrder = transactions[0];
      if (items.length === lastOrder.items.length) {
        let isIdentical = true;
        for (const item of items) {
          const match = lastOrder.items.find(i => i.product.id === item.product.id);
          if (!match || match.quantity !== item.quantity) {
            isIdentical = false;
            break;
          }
        }
        if (isIdentical) {
          setShowDuplicateModal(true);
          return;
        }
      }
    }

    await confirmAndPlaceOrder();
  };

  const executeReverseTransaction = async () => {
    setShowUndoModal(false);
    if (!lastTransactionId) return;
      
    setIsOrdering(true); // Re-use loading state for reversing
    await useTransactionStore.getState().reverseTransaction(lastTransactionId);
    
    setIsOrdering(false);
    setOrderSuccess(false);
    setLastTransactionId(null);
  };

  const handleReverseTransaction = async () => {
    if (!lastTransactionId) return;
    setShowUndoModal(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`w-full lg:w-96 bg-white rounded-3xl shadow-sm border flex flex-col h-full overflow-hidden transition-all duration-200 ${dragCounter > 0 ? 'border-primary-400 border-2 shadow-lg bg-primary-50/10' : 'border-gray-100'}`}
      onDragEnter={(e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('product_id')) {
          e.preventDefault();
          setDragCounter(prev => prev + 1);
        }
      }}
      onDragLeave={(e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('product_id')) {
          setDragCounter(prev => Math.max(0, prev - 1));
        }
      }}
      onDragOver={(e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('product_id')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e: React.DragEvent) => {
        e.preventDefault();
        setDragCounter(0);
        const productId = e.dataTransfer.getData('product_id');
        if (productId) {
          const inventoryItems = useInventoryStore.getState().items;
          const product = inventoryItems.find(p => p.id === productId);
          if (product && product.stock > 0) {
            const existingItem = items.find((item) => item.product.id === product.id);
            if (existingItem && existingItem.quantity >= product.stock) {
              setOutOfStockItemNames([product.name]);
              setShowStockModal(true);
            } else {
              useCartStore.getState().addItem(product);
            }
          }
        }
      }}
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BillList className="w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name"
              className="text-xl font-medium text-text-main bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-48 placeholder-gray-300"
            />
          </div>
          <p className="text-sm text-gray-400">Order Number: #000</p>
        </div>
        <button 
          onClick={clearCart}
          className="p-2 text-gray-400 hover:text-danger hover:bg-danger/10 rounded-2xl transition-colors"
          title="Clear Cart"
        >
          <TrashBinTrash className="w-5 h-5" />
        </button>
      </div>

      {/* Selectors - Removed Select Table and Order Type */}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <BillList className="w-12 h-12 mb-4 opacity-50" />
            <p>No Item Selected</p>
          </div>
        ) : (
          <AnimatePresence>
            {items.map((item) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                key={item.product.id} 
                draggable="true"
                onDragStart={(e: any) => {
                  e.dataTransfer.setData('cart_item_id', item.product.id);
                  e.dataTransfer.effectAllowed = 'move';
                  
                  // Create a custom drag image to make it look nicer
                  const dragGhost = document.createElement('div');
                  dragGhost.textContent = `Remove ${item.product.name}`;
                  dragGhost.style.background = '#ef4444';
                  dragGhost.style.color = 'white';
                  dragGhost.style.padding = '8px 16px';
                  dragGhost.style.borderRadius = '16px';
                  dragGhost.style.position = 'absolute';
                  dragGhost.style.top = '-1000px';
                  document.body.appendChild(dragGhost);
                  e.dataTransfer.setDragImage(dragGhost, 0, 0);
                  
                  setTimeout(() => document.body.removeChild(dragGhost), 100);
                }}
                onDragEnd={(e: any) => {
                  if (e.dataTransfer.dropEffect === 'none') {
                    removeItem(item.product.id);
                  }
                }}
                className="flex gap-3 bg-white p-3 rounded-2xl border border-gray-50 shadow-sm cursor-grab active:cursor-grabbing"
              >
                <img src={item.product.image} alt={item.product.name} className="w-16 h-16 rounded-xl object-cover bg-gray-100" />
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-text-main text-sm truncate">{item.product.name}</h4>
                    <p className="text-xs text-primary-500">{formatPHP(item.product.price)}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-4 bg-gray-50/80 rounded-2xl p-1.5 border border-gray-100/50">
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-gray-50 text-gray-500 hover:text-primary-600 hover:shadow-md transition-all"
                      >
                        <MinusCircle className="w-5 h-5" />
                      </button>
                      <span className="text-sm font-medium w-4 text-center text-primary-600">{item.quantity}</span>
                      <button 
                        onClick={() => {
                          if (item.quantity >= item.product.stock) {
                            setOutOfStockItemNames([item.product.name]);
                            setShowStockModal(true);
                          } else {
                            updateQuantity(item.product.id, item.quantity + 1);
                          }
                        }}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-gray-50 text-gray-500 hover:text-primary-600 hover:shadow-md transition-all"
                      >
                        <AddCircle className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`font-medium text-sm ${item.isExpense ? 'text-gray-400 line-through' : 'text-text-main'}`}>
                        {formatPHP(item.product.price * item.quantity)}
                      </span>
                      <button 
                        onClick={() => useCartStore.getState().toggleExpense(item.product.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${item.isExpense ? 'bg-danger/10 text-danger' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {item.isExpense ? 'Expense' : 'Mark Expense'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="space-y-3 mb-6 border-b border-dashed border-gray-200 pb-6">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span className="text-text-main">{formatPHP(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsTaxEnabled(!isTaxEnabled)}
                className={`w-8 h-4 rounded-full relative transition-colors ${isTaxEnabled ? 'bg-primary-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isTaxEnabled ? 'right-0.5' : 'left-0.5'}`} />
              </button>
              <span>Tax Rate (%)</span>
              {isTaxEnabled && (
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  step="any"
                  value={taxRateInput}
                  onChange={(e) => setTaxRateInput(e.target.value)}
                  className="w-16 px-2 py-0.5 border border-gray-200 rounded-md text-center text-sm focus:outline-none focus:border-primary-500"
                />
              )}
            </div>
            <span className="text-text-main">{formatPHP(taxAmount)}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <input 
            type="checkbox" 
            id="markAllExpense"
            checked={items.length > 0 && items.every(i => i.isExpense)}
            onChange={(e) => useCartStore.getState().markAllAsExpense(e.target.checked)}
            className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500 cursor-pointer"
          />
          <label htmlFor="markAllExpense" className="text-sm font-medium text-gray-700 cursor-pointer select-none flex-1">
            Mark all items as expense
          </label>
        </div>

        <div className="flex justify-between items-center mb-6">
          <span className="text-lg font-medium text-text-main">TOTAL</span>
          <span className="text-2xl font-semibold text-primary-600">{formatPHP(finalTotal)}</span>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div className="flex gap-2">
            {['Paid', 'Partially Paid', 'Unpaid'].map(status => (
              <button
                key={status}
                onClick={() => setPaymentStatus(status as 'Paid' | 'Unpaid' | 'Partially Paid')}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors border ${
                  paymentStatus === status 
                    ? 'bg-primary-50 text-primary-600 border-primary-200' 
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          
          <AnimatePresence>
            {paymentStatus === 'Partially Paid' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden"
              >
                <span className="text-sm text-gray-600">Amount Paid (₱)</span>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  placeholder="0.00"
                  className="w-24 text-right bg-transparent border-none focus:outline-none focus:ring-0 font-medium text-text-main"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2 w-full">
            <button 
              disabled={items.length === 0 && !orderSuccess || isOrdering}
              onClick={orderSuccess ? handleReverseTransaction : handlePlaceOrder}
              className={`py-4 text-white rounded-2xl font-medium transition-all flex items-center justify-center gap-2
                ${orderSuccess 
                  ? 'flex-1 bg-danger hover:bg-danger/90 shadow-[0_4px_14px_0_rgba(239,68,68,0.39)]' 
                  : 'w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)]'
                }`}
            >
              {isOrdering ? (
                 <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              ) : orderSuccess ? (
                 'Undo Transaction'
              ) : (
                 'Place Order'
              )}
            </button>
            {orderSuccess && (
              <button
                onClick={handleDismissSuccess}
                className="flex-[0.4] py-4 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl font-medium transition-all text-center"
              >
                OK
              </button>
            )}
          </div>
          
          <AnimatePresence>
            {orderSuccess && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-center text-sm text-success font-medium mt-1"
              >
                Order Placed Successfully!
              </motion.div>
            )}
            {orderError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-center text-sm text-danger font-medium mt-1"
              >
                {orderError}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Out of Stock Modal */}
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
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 overflow-hidden"
            >
              <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-500">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-center text-gray-900 mb-2">Insufficient Stock</h3>
              <p className="text-sm text-center text-gray-500 mb-6">
                The following items do not have enough stock: <br />
                <span className="font-medium text-gray-800">{outOfStockItemNames.join(', ')}</span>
                <br /><br />
                Do you want to proceed anyway?
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowStockModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmAndPlaceOrder}
                  className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors shadow-sm"
                >
                  Proceed
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Duplicate Order Modal */}
      <AnimatePresence>
        {showDuplicateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDuplicateModal(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 overflow-hidden"
            >
              <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4 text-yellow-500">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-center text-gray-900 mb-2">Duplicate Order</h3>
              <p className="text-sm text-center text-gray-500 mb-6">
                This order is identical to the previous order. Are you sure you want to proceed and create a duplicate order?
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDuplicateModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowDuplicateModal(false);
                    confirmAndPlaceOrder();
                  }}
                  className="flex-1 px-4 py-2.5 bg-yellow-500 text-white rounded-xl font-medium hover:bg-yellow-600 transition-colors shadow-sm"
                >
                  Proceed
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Undo Modal */}
      <AnimatePresence>
        {showUndoModal && (() => {
          const transactionToUndo = transactions.find(t => t.id === lastTransactionId);
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowUndoModal(false)}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 overflow-hidden"
              >
                <div className="mx-auto w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center mb-4 text-danger">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-center text-gray-900 mb-2">Undo Transaction</h3>
                <p className="text-sm text-center text-gray-500 mb-4">
                  Are you sure you want to undo this transaction? This will reverse the sale and restore inventory.
                </p>
                
                {transactionToUndo && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100 max-h-40 overflow-y-auto hide-scrollbar text-left">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                      <span className="text-xs font-semibold text-gray-500">Order ID: {transactionToUndo.id.slice(0, 8)}...</span>
                      <span className="text-xs font-bold text-gray-900">{formatPHP(transactionToUndo.total)}</span>
                    </div>
                    <div className="space-y-1">
                      {transactionToUndo.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-700 truncate pr-2">{item.quantity}x {item.product.name}</span>
                          <span className="text-gray-500 whitespace-nowrap">{formatPHP(item.isExpense ? 0 : item.product.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowUndoModal(false)}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={executeReverseTransaction}
                    className="flex-1 px-4 py-2.5 bg-danger text-white rounded-xl font-medium hover:bg-danger/90 transition-colors shadow-sm"
                  >
                    Undo Order
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
}
