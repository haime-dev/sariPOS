import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, AddCircle, CloseCircle, Download } from '@solar-icons/react';
import { BarChart, Bar, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useExpenseStore } from '../store/useExpenseStore';

// Format currency as PHP
const formatPHP = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
};

// Helper to manage date periods
const getDateRange = (period: string) => {
  let end = new Date();
  let start = new Date();
  if (period === 'Daily') {
    start.setDate(start.getDate() - 6);
    start.setHours(0,0,0,0);
  } else if (period === 'Weekly') {
    start.setDate(start.getDate() - 27);
    start.setHours(0,0,0,0);
  } else if (period === 'Monthly') {
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    start.setHours(0,0,0,0);
  } else if (period === 'All Time') {
    start = new Date(0);
    start.setHours(0,0,0,0);
  }
  return { start, end };
};

export default function Expenses() {
  const { expenses, fetchExpenses, cleanupOrphanedExpenses, addExpense, deleteExpense } = useExpenseStore();
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Dashboard Graph & Download State
  const [datePeriod, setDatePeriod] = useState('Monthly');
  const [showGraph, setShowGraph] = useState(true);
  const [graphMetric, setGraphMetric] = useState<'Total' | 'Non-Store'>('Total');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAverageFor, setShowAverageFor] = useState<string | null>(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState<string | null>(null);


  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadType, setDownloadType] = useState<'All' | 'Custom'>('All');
  const [downloadStart, setDownloadStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [downloadEnd, setDownloadEnd] = useState(new Date().toISOString().split('T')[0]);

  // Form State
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [amount, setAmount] = useState('');
  
  // Table Filters & Pagination State
  const [tablePeriod, setTablePeriod] = useState('All Time');
  const [filterDate, setFilterDate] = useState('');
  const [filterDesc, setFilterDesc] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterAmount, setFilterAmount] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [tablePeriod, filterDate, filterDesc, filterCategory, filterAmount]);
  
  useEffect(() => {
    const init = async () => {
      await cleanupOrphanedExpenses();
      await fetchExpenses();
    };
    init();
  }, [fetchExpenses, cleanupOrphanedExpenses]);

  let periodStart = new Date();
  let periodEnd = new Date();
  if (datePeriod === 'Custom') {
    periodStart = new Date(customStartDate);
    periodStart.setHours(0,0,0,0);
    periodEnd = new Date(customEndDate);
    periodEnd.setHours(23,59,59,999);
  } else {
    const range = getDateRange(datePeriod);
    periodStart = range.start;
    periodEnd = range.end;
  }
  
  const chartExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d >= periodStart && d <= periodEnd;
  });

  const totalExpenses = chartExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalNonStoreExpense = chartExpenses.reduce((sum, e) => sum + (e.category !== 'Store Use' ? e.amount : 0), 0);

  // Average calculations
  let avgDivisor = 1;
  let avgLabel = "day";
  let avgSymbol = "/d";

  if (datePeriod === 'Daily') {
    avgDivisor = 7;
    avgLabel = "day (this period)";
    avgSymbol = "/d";
  } else if (datePeriod === 'Weekly') {
    avgDivisor = 4;
    avgLabel = "week (this period)";
    avgSymbol = "/w";
  } else if (datePeriod === 'Monthly') {
    avgDivisor = 12;
    avgLabel = "month (this period)";
    avgSymbol = "/mo";
  } else if (datePeriod === 'All Time') {
    let earliestStatDate = new Date();
    if (expenses.length > 0) {
       earliestStatDate = new Date(Math.min(...expenses.map(e => new Date(e.date).getTime())));
    }
    avgDivisor = Math.max(1, Math.ceil((new Date().getTime() - earliestStatDate.getTime()) / (1000 * 60 * 60 * 24)));
    avgLabel = "day (all time)";
    avgSymbol = "/d";
  } else if (datePeriod === 'Custom') {
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    avgDivisor = Math.max(1, daysDiff);
    avgLabel = "day";
    avgSymbol = "/d";
  }

  const totalExpensesAvg = totalExpenses / avgDivisor;
  const totalNonStoreAvg = totalNonStoreExpense / avgDivisor;

  const graphTargetExpenses = graphMetric === 'Non-Store' ? chartExpenses.filter(e => e.category !== 'Store Use') : chartExpenses;

  const chartDataMap = new Map<string, number>();
  if (datePeriod === 'Daily') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      chartDataMap.set(dayLabel, 0);
    }
    graphTargetExpenses.forEach(e => {
      const dayLabel = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (chartDataMap.has(dayLabel)) chartDataMap.set(dayLabel, chartDataMap.get(dayLabel)! + e.amount);
    });
  } else if (datePeriod === 'Weekly') {
    const weekLabels: { label: string, start: Date, end: Date }[] = [];
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    for (let i = 3; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - (i * 7) - 6);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(now.getDate() - (i * 7));
      const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      weekLabels.push({ label, start, end });
      chartDataMap.set(label, 0);
    }
    graphTargetExpenses.forEach(e => {
      const d = new Date(e.date);
      const week = weekLabels.find(w => d >= w.start && d <= w.end);
      if (week && chartDataMap.has(week.label)) chartDataMap.set(week.label, chartDataMap.get(week.label)! + e.amount);
    });
  } else if (datePeriod === 'Monthly') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      chartDataMap.set(monthLabel, 0);
    }
    graphTargetExpenses.forEach(e => {
      const monthLabel = new Date(e.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (chartDataMap.has(monthLabel)) chartDataMap.set(monthLabel, chartDataMap.get(monthLabel)! + e.amount);
    });
  } else if (datePeriod === 'All Time') {
    const years = Array.from(new Set(chartExpenses.map(e => new Date(e.date).getFullYear()))).sort();
    if (years.length === 0) years.push(new Date().getFullYear());
    years.forEach(year => chartDataMap.set(year.toString(), 0));
    graphTargetExpenses.forEach(e => {
      const yearStr = new Date(e.date).getFullYear().toString();
      if (chartDataMap.has(yearStr)) chartDataMap.set(yearStr, chartDataMap.get(yearStr)! + e.amount);
    });
  } else if (datePeriod === 'Custom') {
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 31) {
      for (let i = 0; i <= daysDiff; i++) {
        const d = new Date(periodStart); d.setDate(d.getDate() + i);
        const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        chartDataMap.set(dayLabel, 0);
      }
      graphTargetExpenses.forEach(e => {
        const dayLabel = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (chartDataMap.has(dayLabel)) chartDataMap.set(dayLabel, chartDataMap.get(dayLabel)! + e.amount);
      });
    } else {
      const diffMonths = (periodEnd.getFullYear() - periodStart.getFullYear()) * 12 + (periodEnd.getMonth() - periodStart.getMonth());
      for (let i = 0; i <= diffMonths; i++) {
        const d = new Date(periodStart); d.setDate(1); d.setMonth(d.getMonth() + i);
        const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        chartDataMap.set(monthLabel, 0);
      }
      graphTargetExpenses.forEach(e => {
        const monthLabel = new Date(e.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (chartDataMap.has(monthLabel)) chartDataMap.set(monthLabel, chartDataMap.get(monthLabel)! + e.amount);
      });
    }
  }
  
  const chartData = Array.from(chartDataMap).map(([name, total]) => ({ name, total }));
  if (chartData.length === 0) chartData.push({ name: 'No Data', total: 0 });

  const executeDownload = () => {
    let exportExpenses = expenses;
    if (downloadType === 'Custom') {
      const dStart = new Date(downloadStart);
      dStart.setHours(0,0,0,0);
      const dEnd = new Date(downloadEnd);
      dEnd.setHours(23,59,59,999);
      exportExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= dStart && d <= dEnd;
      });
    }

    const headers = ['Expense ID', 'Date', 'Description', 'Category', 'Amount (PHP)'];
    const rows = exportExpenses.map(e => [
      e.id,
      new Date(e.date).toLocaleString(),
      e.description,
      e.category,
      e.amount.toString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = downloadType === 'All' ? 'expense_report_all_time.csv' : `expense_report_${downloadStart}_to_${downloadEnd}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDownloadModal(false);
  };
  
  const expenseMap = new Map<string, any>();

  chartExpenses.forEach(e => {
     if (!expenseMap.has(e.description)) {
         expenseMap.set(e.description, {
            description: e.description,
            category: e.category,
            amount: e.amount,
            avgExpense: 0,
         });
     } else {
         const curr = expenseMap.get(e.description);
         curr.amount += e.amount;
     }
  });

  const topExpensesList = Array.from(expenseMap.values()).map(e => {
     e.avgExpense = e.amount / avgDivisor;
     return e;
  }).sort((a,b) => b.amount - a.amount);


  const { start: tablePeriodStart, end: tablePeriodEnd } = getDateRange(tablePeriod);
  const filteredTableExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    if (d < tablePeriodStart || d > tablePeriodEnd) return false;
    
    if (filterDate && new Date(e.date).toLocaleDateString() !== new Date(filterDate).toLocaleDateString()) return false;
    if (filterDesc && !e.description.toLowerCase().includes(filterDesc.toLowerCase())) return false;
    if (filterCategory !== 'All' && e.category !== filterCategory) return false;
    if (filterAmount && !e.amount.toString().includes(filterAmount)) return false;
    
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTableExpenses.length / 10));
  const paginatedExpenses = filteredTableExpenses.slice((currentPage - 1) * 10, currentPage * 10);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    
    await addExpense({
      description,
      category,
      amount: Number(amount),
      date: new Date().toISOString()
    });
    
    setShowAddModal(false);
    setDescription('');
    setCategory('General');
    setAmount('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6 max-w-7xl mx-auto pb-8"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white font-outfit">Expenses Tracking</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-2xl font-medium shadow-sm transition-all"
        >
          <AddCircle className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100 whitespace-nowrap overflow-x-auto hide-scrollbar">
            {['Daily', 'Weekly', 'Monthly', 'All Time', 'Custom'].map((period) => (
              <button
                key={period}
                onClick={() => setDatePeriod(period)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  datePeriod === period 
                    ? 'bg-primary-50 text-primary-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowDownloadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 rounded-2xl shadow-sm text-sm hover:bg-gray-50 transition-colors"
          >
            Download
            <div className="bg-primary-500 p-1 rounded-md text-white">
              <Download className="w-3 h-3" />
            </div>
          </button>

          <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
            <span className="text-sm">Show Graph</span>
            <div 
              className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${showGraph ? 'bg-primary-500' : 'bg-gray-300'}`}
              onClick={() => setShowGraph(!showGraph)}
            >
              <motion.div 
                layout
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm ${showGraph ? 'right-1' : 'left-1'}`} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className={`grid grid-cols-1 ${showGraph ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
        {/* Chart Section */}
        {showGraph && (
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg flex items-center gap-2 flex-grow">
                <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                Expense Graph
              </h3>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="px-4 py-2 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-600 font-medium">
                  {datePeriod === 'Custom' ? 'Custom Amount' : `${datePeriod}`}
                </div>
                {datePeriod === 'Custom' && (
                  <div className="flex items-center gap-2">
                     <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-100" />
                     <span className="text-gray-400 text-sm">to</span>
                     <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                )}
                <select 
                  value={graphMetric}
                  onChange={(e) => setGraphMetric(e.target.value as any)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary-100 cursor-pointer shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <option value="Total">Total Expense</option>
                  <option value="Non-Store">Non-Store Expense</option>
                </select>
              </div>
            </div>
            
            <div className="h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000000', fontWeight: 'bold' }} dy={10} />
                  <YAxis dataKey="total" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} tickFormatter={(value) => `₱${value.toLocaleString()}`} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px -6px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => [formatPHP(Number(value)), 'Expense']}
                    labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                  />
                  <Bar dataKey="total" fill="url(#colorExpense)" radius={[6, 6, 6, 6]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Stat Cards Column */}
        <div className={`flex flex-col gap-4 ${showGraph ? 'lg:col-span-1' : 'w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2'}`}>
          <div 
            className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary-100 transition-all relative group"
            onClick={() => setShowBreakdownModal('Total Expense')}
          >
            <div>
              <p className="text-sm text-gray-500 mb-1 group-hover:text-primary-600 transition-colors">Total Expenses</p>
              <h3 className="text-3xl font-bold text-gray-900">{formatPHP(totalExpenses)}</h3>
            </div>
            <div className="flex flex-col items-center">
              <div 
                className="w-12 h-12 bg-danger/10 text-danger rounded-2xl flex items-center justify-center cursor-pointer hover:bg-danger/20 transition-colors mb-1"
                onClick={(e) => { e.stopPropagation(); setShowAverageFor(showAverageFor === 'Total Expenses' ? null : 'Total Expenses'); }}
                title="Click for Average"
              >
                <Wallet className="w-6 h-6" />
              </div>
            </div>
            
            <AnimatePresence>
              {showAverageFor === 'Total Expenses' && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute left-0 right-0 -bottom-24 bg-white rounded-2xl border border-primary-100 p-4 shadow-xl z-50 cursor-default"
                  onClick={(e) => e.stopPropagation()}
                >
                   <p className="text-xs text-gray-500 font-bold tracking-widest uppercase text-center mb-2">
                     Average
                   </p>
                   <p className="text-base md:text-lg text-primary-700 font-bold text-center bg-primary-50 py-2.5 rounded-xl">
                     {formatPHP(totalExpensesAvg)} / {avgLabel}
                   </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div 
            className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary-100 transition-all relative group"
            onClick={() => setShowBreakdownModal('Total Non-Store Expense')}
          >
            <div>
              <p className="text-sm text-gray-500 mb-1 group-hover:text-primary-600 transition-colors">Total Non-Store Expense</p>
              <h3 className="text-3xl font-bold text-gray-900">{formatPHP(totalNonStoreExpense)}</h3>
            </div>
            <div className="flex flex-col items-center">
              <div 
                className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-orange-500/20 transition-colors mb-1"
                onClick={(e) => { e.stopPropagation(); setShowAverageFor(showAverageFor === 'Total Non-Store Expense' ? null : 'Total Non-Store Expense'); }}
                title="Click for Average"
              >
                <Wallet className="w-6 h-6" />
              </div>
            </div>

            <AnimatePresence>
              {showAverageFor === 'Total Non-Store Expense' && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute left-0 right-0 -bottom-24 bg-white rounded-2xl border border-primary-100 p-4 shadow-xl z-50 cursor-default"
                  onClick={(e) => e.stopPropagation()}
                >
                   <p className="text-xs text-gray-500 font-bold tracking-widest uppercase text-center mb-2">
                     Average
                   </p>
                   <p className="text-base md:text-lg text-primary-700 font-bold text-center bg-primary-50 py-2.5 rounded-xl">
                     {formatPHP(totalNonStoreAvg)} / {avgLabel}
                   </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Top Expenses by Description Grid */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg flex items-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full bg-primary-500"></span>
          Top Expenses
        </h3>
        
        <div className="w-full overflow-x-auto hide-scrollbar">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-12 gap-2 items-center text-xs text-gray-400 mb-4 px-2">
              <span className="col-span-4 text-left font-medium">Description</span>
              <span className="col-span-3 text-left font-medium">Category</span>
              <span className="col-span-2 text-right font-medium">Total Amount</span>
              <span className="col-span-3 text-right font-medium">Average Expense</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[350px] pr-1">
              {topExpensesList.length > 0 ? topExpensesList.slice(0, 20).map((expense, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded-2xl border border-transparent hover:bg-gray-50/50 hover:shadow-sm transition-all group">
                  <div className="col-span-4 text-left font-medium text-gray-900 truncate" title={expense.description}>
                    {expense.description}
                  </div>
                  <div className="col-span-3 text-left">
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[11px] sm:text-xs">
                      {expense.category}
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-bold text-danger truncate">
                    {formatPHP(expense.amount)}
                  </div>
                  <div className="col-span-3 text-right font-bold text-orange-500 truncate" title={`${formatPHP(expense.avgExpense)} per ${avgLabel.split(' ')[0]}`}>
                    {formatPHP(expense.avgExpense)}{avgSymbol}
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-12">
                  No expenses recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500"></span>
            Expense History
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Period:</span>
            <select
              value={tablePeriod}
              onChange={(e) => setTablePeriod(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="All Time">All Time</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-auto border border-gray-100 rounded-2xl max-h-[500px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/90 backdrop-blur-sm sticky top-0 z-10 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
              <tr className="text-gray-500">
                <th className="px-6 py-4 font-medium align-top">
                  <div className="mb-2">Date</div>
                  <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="text-xs font-normal border border-gray-200 rounded p-1 w-full bg-white text-gray-700" />
                </th>
                <th className="px-6 py-4 font-medium align-top">
                  <div className="mb-2">Description</div>
                  <input type="text" placeholder="Search..." value={filterDesc} onChange={e => setFilterDesc(e.target.value)} className="text-xs font-normal border border-gray-200 rounded p-1 w-full bg-white text-gray-700" />
                </th>
                <th className="px-6 py-4 font-medium align-top">
                  <div className="mb-2">Category</div>
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-xs font-normal border border-gray-200 rounded p-1 w-[120px] bg-white text-gray-700">
                    <option value="All">All Categories</option>
                    <option value="General">General</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Salary">Salary</option>
                    <option value="Store Use">Store Use</option>
                    <option value="Other">Other</option>
                  </select>
                </th>
                <th className="px-6 py-4 text-right font-medium align-top">
                  <div className="mb-2">Amount</div>
                  <input type="number" placeholder="Search..." value={filterAmount} onChange={e => setFilterAmount(e.target.value)} className="text-xs font-normal border border-gray-200 rounded p-1 w-20 bg-white text-right text-gray-700 float-right" />
                </th>
                <th className="px-6 py-4 text-center font-medium align-top">
                  <div className="mb-2">Action</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedExpenses.length > 0 ? paginatedExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">{new Date(expense.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{expense.description}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-danger">
                    {formatPHP(expense.amount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {expense.category !== 'Store Use' && (
                      <button 
                        onClick={() => deleteExpense(expense.id)}
                        className="text-danger hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No matching expenses found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-900">{filteredTableExpenses.length === 0 ? 0 : (currentPage - 1) * 10 + 1}</span> to <span className="font-medium text-gray-900">{Math.min(currentPage * 10, filteredTableExpenses.length)}</span> of <span className="font-medium text-gray-900">{filteredTableExpenses.length}</span> expenses
          </p>
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Previous
            </button>
            <div className="text-sm text-gray-600 font-medium px-4">
              {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-6 w-full max-w-md relative z-10 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Add New Expense</h3>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                  <CloseCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                    placeholder="e.g. Electricity Bill"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                  >
                    <option value="General">General</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Salary">Salary</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (PHP)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                    placeholder="0.00"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3.5 px-4 bg-gray-100 text-gray-700 font-medium rounded-2xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 px-4 bg-primary-500 text-white font-medium rounded-2xl hover:bg-primary-600 shadow-[0_8px_20px_-6px_rgba(59,130,246,0.5)] transition-all"
                  >
                    Save Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Download Modal */}
      <AnimatePresence>
        {showDownloadModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              onClick={() => setShowDownloadModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-xl"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Download Expense Report</h3>
              
              <div className="flex flex-col gap-4 mb-6">
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input 
                    type="radio" 
                    checked={downloadType === 'All'}
                    onChange={() => setDownloadType('All')}
                    className="w-4 h-4 text-primary-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">All Time Expenses</p>
                    <p className="text-xs text-gray-500">Download entire expense history</p>
                  </div>
                </label>
                
                <label className="flex flex-col gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      checked={downloadType === 'Custom'}
                      onChange={() => setDownloadType('Custom')}
                      className="w-4 h-4 text-primary-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Specific Period</p>
                      <p className="text-xs text-gray-500">Select date range</p>
                    </div>
                  </div>
                  
                  {downloadType === 'Custom' && (
                    <div className="flex flex-col gap-2 mt-2 ml-7">
                      <input 
                        type="date" 
                        value={downloadStart}
                        onChange={(e) => setDownloadStart(e.target.value)}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      />
                      <input 
                        type="date" 
                        value={downloadEnd}
                        onChange={(e) => setDownloadEnd(e.target.value)}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  )}
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDownload}
                  className="flex-1 py-3 px-4 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 transition-colors"
                >
                  Download
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Expense Breakdown Modal */}
      <AnimatePresence>
        {showBreakdownModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              onClick={() => setShowBreakdownModal(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-6 w-full max-w-2xl relative z-10 shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{showBreakdownModal} Breakdown</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 tracking-wider uppercase font-bold">Average:</span>
                    <span className="text-sm font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">
                      {formatPHP(showBreakdownModal === 'Total Expense' ? totalExpensesAvg : totalNonStoreAvg)} / {avgLabel}
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowBreakdownModal(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors self-start mt-1">
                  <CloseCircle className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              
              <div className="overflow-y-auto pr-2 hide-scrollbar">
                {(() => {
                  const filtered = chartExpenses.filter(e => showBreakdownModal === 'Total Non-Store Expense' ? e.category !== 'Store Use' : true);
                  const categories = Array.from(new Set(filtered.map(e => e.category)));
                  
                  return categories.length > 0 ? categories.map(cat => {
                    const catExpenses = filtered.filter(e => e.category === cat);
                    const catTotal = catExpenses.reduce((sum, e) => sum + e.amount, 0);
                    
                    // Group by description
                    const descMap = new Map<string, number>();
                    catExpenses.forEach(e => {
                      descMap.set(e.description, (descMap.get(e.description) || 0) + e.amount);
                    });
                    const descList = Array.from(descMap).sort((a, b) => b[1] - a[1]);
                    
                    return (
                      <div key={cat} className="mb-6 last:mb-0">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-gray-800 text-lg">{cat}</h4>
                          <span className="font-bold text-primary-600">{formatPHP(catTotal)}</span>
                        </div>
                        <div className="space-y-2">
                          {descList.map(([desc, amt]) => (
                            <div key={desc} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                              <span className="text-gray-700 font-medium">{desc}</span>
                              <span className="text-gray-900 font-bold">{formatPHP(amt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8 text-gray-500">No expenses recorded for this period.</div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
