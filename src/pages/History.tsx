import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTransactionStore } from '../store/useTransactionStore';
import dayjs from 'dayjs';
import { History as HistoryIcon, ClockSquare } from '@solar-icons/react';

export default function History() {
  const { transactionHistory, fetchHistory } = useTransactionStore();
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredHistory = dateFilter 
    ? transactionHistory.filter(log => dayjs(log.created_at).format('YYYY-MM-DD') === dateFilter)
    : transactionHistory;

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
            <p className="text-sm mt-2">Try selecting a different date or placing new orders.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-primary-100 ml-4 py-4 space-y-8">
            {filteredHistory.map((log) => (
              <div key={log.id} className="relative pl-8">
                {/* Timeline Dot */}
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-4 border-primary-500" />
                
                <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-2xl hover:shadow-sm transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h3 className={`font-semibold ${log.action === 'Order Undone' ? 'text-danger' : 'text-success'}`}>
                      {log.action}
                    </h3>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200 w-fit">
                      {dayjs(log.created_at).format('MMM D, YYYY h:mm A')}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm">{log.details}</p>
                  
                  <div className="mt-3 text-xs text-gray-400 font-mono">
                    Transaction ID: {log.transaction_id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
