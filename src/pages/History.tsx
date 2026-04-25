import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTransactionStore } from '../store/useTransactionStore';
import dayjs from 'dayjs';
import { History as HistoryIcon, ClockSquare, CloseCircle, Box, Wallet, DangerTriangle } from '@solar-icons/react';

// Format currency as PHP
const formatPHP = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
};

export default function History() {
  const { transactionHistory, fetchHistory } = useTransactionStore();
  const [dateFilter, setDateFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredHistory = transactionHistory.filter(log => {
    if (log.action === 'Order Placed') return false;
    if (dateFilter && dayjs(log.created_at).format('YYYY-MM-DD') !== dateFilter) return false;
    return true;
  });

  const renderLogDetails = (log: any) => {
    let parsed: any = null;
    try {
      parsed = JSON.parse(log.details);
    } catch {
      // Handle legacy records that were stored as plain strings
      if (log.action === 'Order Undone' && log.details) {
        const match = log.details.match(/Order (.*?) was reverted/);
        const txId = match ? match[1] : log.transaction_id;
        if (txId) {
          parsed = {
            message: log.details,
            transaction: {
              id: txId,
              customer: 'Unknown (Legacy Record)',
              date: log.created_at,
              total: 0,
              items: [],
              isLegacy: true
            }
          };
        }
      }
    }

    const message = parsed ? parsed.message : log.details;
    const hasDetails = parsed && (parsed.transaction || parsed.expense);

    return (
      <div className="flex flex-col gap-2 mt-2">
        <p className="text-gray-600 text-sm">{message}</p>
        {hasDetails && (
          <button 
            onClick={() => setSelectedLog(parsed)}
            className="text-primary-600 text-xs font-semibold hover:underline w-fit"
          >
            View Details
          </button>
        )}
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6 max-w-7xl mx-auto pb-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary-50 p-2 rounded-2xl">
            <HistoryIcon className="w-6 h-6 text-primary-500" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white">Historical Transactions</h2>
            <p className="text-sm text-gray-200 mt-1">A ledger of all actions performed in the POS system.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-sm text-gray-500">Filter Date:</span>
          <input 
            type="date" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-text-main cursor-pointer"
          />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} className="text-xs text-danger hover:underline ml-1">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-1 min-h-[500px]">
        {filteredHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
            <ClockSquare className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">No historical transactions found.</p>
            <p className="text-sm mt-2">Try selecting a different date or performing actions like undoing orders.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-primary-100 ml-4 py-4 space-y-8">
            {filteredHistory.map((log) => (
              <div key={log.id} className="relative pl-8">
                {/* Timeline Dot */}
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-4 border-primary-500" />
                
                <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-2xl hover:shadow-sm transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className={`font-semibold ${log.action.includes('Undo') || log.action.includes('Delete') ? 'text-danger' : 'text-primary-600'}`}>
                      {log.action}
                    </h3>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200 w-fit">
                      {dayjs(log.created_at).format('MMM D, YYYY h:mm A')}
                    </span>
                  </div>
                  
                  {renderLogDetails(log)}
                  
                  <div className="mt-3 text-xs text-gray-400 font-mono">
                    ID: {log.transaction_id || log.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                    {selectedLog.transaction ? <Box className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-medium text-gray-900 font-outfit">
                      {selectedLog.transaction ? 'Order Details' : 'Expense Details'}
                    </h2>
                    <p className="text-xs text-gray-500 font-mono">
                      ID: {selectedLog.transaction ? selectedLog.transaction.id : selectedLog.expense.id}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <CloseCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto hide-scrollbar">
                {selectedLog.transaction && (
                  <>
                    {selectedLog.transaction.isLegacy && (
                      <div className="mb-6 p-4 bg-orange-50 text-orange-600 rounded-xl text-sm border border-orange-100 flex items-start sm:items-center gap-3">
                        <DangerTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 sm:mt-0" />
                        <span>Detailed item information is not available for transactions undone before the system update.</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <p className="text-sm text-gray-500">Customer</p>
                        <p className="font-medium">{selectedLog.transaction.customer}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Date & Time</p>
                        <p className="font-medium">{new Date(selectedLog.transaction.date).toLocaleString()}</p>
                      </div>
                    </div>

                    {!selectedLog.transaction.isLegacy && (
                      <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50/50">
                          <tr className="text-gray-500">
                            <th className="px-4 py-3 font-medium">Product</th>
                            <th className="px-4 py-3 font-medium text-center">Price</th>
                            <th className="px-4 py-3 font-medium text-center">Qty</th>
                            <th className="px-4 py-3 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedLog.transaction.items.map((item: any, idx: number) => {
                            const total = item.product.price * item.quantity;
                            return (
                              <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <img src={item.product.image || 'https://images.unsplash.com/photo-1549903072-7e6e0b3c2242?auto=format&fit=crop&q=80&w=100&h=100'} alt={item.product.name} className="w-8 h-8 rounded-lg object-cover bg-gray-50" />
                                    <div>
                                      <p className="font-medium text-gray-900">{item.product.name}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">{formatPHP(item.product.price)}</td>
                                <td className="px-4 py-3 text-center">{item.quantity}</td>
                                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatPHP(total)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50/50">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-right font-medium text-gray-500 border-t border-gray-200">Total Order</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900 border-t border-gray-200">{formatPHP(selectedLog.transaction.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    )}
                  </>
                )}

                {selectedLog.expense && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl">
                      <div>
                        <p className="text-sm text-gray-500">Date</p>
                        <p className="font-medium">{new Date(selectedLog.expense.date).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Category</p>
                        <span className="px-2 py-1 bg-white border border-gray-200 text-gray-600 rounded-md text-xs mt-1 inline-block">
                          {selectedLog.expense.category}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-4 border border-gray-100 rounded-xl">
                      <p className="text-sm text-gray-500 mb-1">Description</p>
                      <p className="font-medium text-gray-900">{selectedLog.expense.description}</p>
                    </div>

                    <div className="p-4 border border-gray-100 rounded-xl bg-danger/5">
                      <p className="text-sm text-danger mb-1">Amount</p>
                      <p className="font-bold text-2xl text-danger">{formatPHP(selectedLog.expense.amount)}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
