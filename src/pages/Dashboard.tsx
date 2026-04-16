import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Download, GraphUp, GraphDown, Magnifer, ChartSquare, Box, UsersGroupRounded, WadOfMoney, Wallet, CloseCircle } from '@solar-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTransactionStore } from '../store/useTransactionStore';
import { useInventoryStore } from '../store/useInventoryStore';
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
    start.setDate(start.getDate() - 6); // Last 7 days
    start.setHours(0,0,0,0);
  } else if (period === 'Weekly') {
    start.setDate(start.getDate() - 27); // Last 4 weeks (~28 days)
    start.setHours(0,0,0,0);
  } else if (period === 'Monthly') {
    start.setMonth(start.getMonth() - 11); // Last 12 months including this month
    start.setDate(1);
    start.setHours(0,0,0,0);
  } else if (period === 'All Time') {
    start = new Date(0); // Epoch start
    start.setHours(0,0,0,0);
  }
  return { start, end };
};

const getPreviousDateRange = (period: string, currentStart: Date) => {
  let end = new Date(currentStart);
  end.setMilliseconds(end.getMilliseconds() - 1);
  let start = new Date(end);
  if (period === 'Daily') {
    start.setDate(start.getDate() - 6);
    start.setHours(0,0,0,0);
  } else if (period === 'Weekly') {
    start.setDate(start.getDate() - 27);
    start.setHours(0,0,0,0);
  } else if (period === 'Monthly') {
    start.setMonth(start.getMonth() - 11);
  } else if (period === 'All Time') {
    start = new Date(0);
    end = new Date(0); // For All Time, previous is technically empty/0
  }
  return { start, end };
};

// Helper for calculating percentage growth
const calculateGrowth = (current: number, previous: number) => {
  if (previous === 0) return { amount: current, percentage: current > 0 ? 100 : 0, isPositive: current >= 0 };
  const amount = current - previous;
  const percentage = (amount / previous) * 100;
  return { amount, percentage, isPositive: amount >= 0 };
};

// Data Generator specifically for individual product charts
const getChartDataForProduct = (productId: string, transactions: any[], period: string) => {
  const chartDataMap = new Map<string, number>();
  
  if (period === 'Daily') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      chartDataMap.set(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 0);
    }
    transactions.forEach(t => {
      const item = t.items.find((i:any) => i.product.id === productId);
      if (item) {
        let ratioPaid = t.total > 0 ? t.amount_paid / t.total : 1;
        const val = (item.product.price * item.quantity) * ratioPaid;
        const dayLabel = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (chartDataMap.has(dayLabel)) chartDataMap.set(dayLabel, chartDataMap.get(dayLabel)! + val);
      }
    });
  } else if (period === 'Weekly') {
    const weekLabels: { label: string, start: Date, end: Date }[] = [];
    const now = new Date(); now.setHours(23, 59, 59, 999);
    for (let i = 3; i >= 0; i--) {
      const start = new Date(now); start.setDate(now.getDate() - (i * 7) - 6); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setDate(now.getDate() - (i * 7));
      const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      weekLabels.push({ label, start, end });
      chartDataMap.set(label, 0);
    }
    transactions.forEach(t => {
      const item = t.items.find((i:any) => i.product.id === productId);
      if (item) {
        let ratioPaid = t.total > 0 ? t.amount_paid / t.total : 1;
        const val = (item.product.price * item.quantity) * ratioPaid;
        const d = new Date(t.date);
        const week = weekLabels.find(w => d >= w.start && d <= w.end);
        if (week && chartDataMap.has(week.label)) chartDataMap.set(week.label, chartDataMap.get(week.label)! + val);
      }
    });
  } else if (period === 'Monthly') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      chartDataMap.set(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), 0);
    }
    transactions.forEach(t => {
      const item = t.items.find((i:any) => i.product.id === productId);
      if (item) {
        let ratioPaid = t.total > 0 ? t.amount_paid / t.total : 1;
        const val = (item.product.price * item.quantity) * ratioPaid;
        const monthLabel = new Date(t.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (chartDataMap.has(monthLabel)) chartDataMap.set(monthLabel, chartDataMap.get(monthLabel)! + val);
      }
    });
  } else if (period === 'All Time') {
    const years = Array.from(new Set(transactions.map(t => new Date(t.date).getFullYear()))).sort();
    if (years.length === 0) years.push(new Date().getFullYear());
    years.forEach(year => chartDataMap.set(year.toString(), 0));
    transactions.forEach(t => {
      const item = t.items.find((i:any) => i.product.id === productId);
      if (item) {
        let ratioPaid = t.total > 0 ? t.amount_paid / t.total : 1;
        const val = (item.product.price * item.quantity) * ratioPaid;
        const yearStr = new Date(t.date).getFullYear().toString();
        if (chartDataMap.has(yearStr)) chartDataMap.set(yearStr, chartDataMap.get(yearStr)! + val);
      }
    });
  }
  
  const chartData = Array.from(chartDataMap).map(([name, total]) => ({ name, total }));
  if (chartData.length === 0) chartData.push({ name: 'No Data', total: 0 });
  return chartData;
};

export default function Dashboard() {
  const [datePeriod, setDatePeriod] = useState('Monthly');
  const [showGraph, setShowGraph] = useState(true);
  const [showAverageFor, setShowAverageFor] = useState<string | null>(null);

  // Top Selling Products Search & Metrics
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductMetrics, setSelectedProductMetrics] = useState<any>(null);

  // Drag-to-scroll state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tableContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setScrollLeft(tableContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll-fast multiplier
    tableContainerRef.current.scrollLeft = scrollLeft - walk;
  };
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  // Payment edit state
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editPaymentStatus, setEditPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Partially Paid'>('Paid');
  const [editAmountPaid, setEditAmountPaid] = useState('');

  // Undo Modal State
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [transactionToUndo, setTransactionToUndo] = useState<string | null>(null);

  // Download Modal State
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadType, setDownloadType] = useState<'All' | 'Custom'>('All');
  const [downloadStart, setDownloadStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [downloadEnd, setDownloadEnd] = useState(new Date().toISOString().split('T')[0]);
  
  // Set default date range to the last 30 days
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  
  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');
  const [customerFilter, setCustomerFilter] = useState<string>('All');
  
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const { transactions, fetchTransactions, updateTransactionPayment } = useTransactionStore();
  const { items: inventoryItems, fetchItems: fetchInventoryItems } = useInventoryStore();
  const { expenses, fetchExpenses } = useExpenseStore();

  useEffect(() => {
    fetchTransactions();
    fetchInventoryItems();
    fetchExpenses();
  }, [fetchTransactions, fetchInventoryItems, fetchExpenses]);

  // Filter transactions based on datePeriod for Dashboard, and custom range for Table
  const { start: periodStart, end: periodEnd } = getDateRange(datePeriod);
  
  const dashboardTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= periodStart && d <= periodEnd;
  });

  // Unique options for filters
  const uniqueDates = Array.from(new Set(transactions.map(t => new Date(t.date).toLocaleDateString()))).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const uniqueCustomers = Array.from(new Set(transactions.map(t => t.customer))).sort();

  const filteredTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    const tableStart = new Date(startDate);
    tableStart.setHours(0,0,0,0);
    const tableEnd = new Date(endDate);
    tableEnd.setHours(23,59,59,999);
    
    // Overall date range
    const matchesDateRange = d >= tableStart && d <= tableEnd;
    
    // Header filters
    const matchesPayment = paymentFilter === 'All' ? true : t.payment === paymentFilter;
    const matchesExactDate = dateFilter === 'All' ? true : d.toLocaleDateString() === dateFilter;
    const matchesCustomer = customerFilter === 'All' ? true : t.customer === customerFilter;
    
    return matchesDateRange && matchesPayment && matchesExactDate && matchesCustomer;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aVal: any = a[key as keyof typeof a] || '';
    let bVal: any = b[key as keyof typeof b] || '';

    if (key === 'date') {
      aVal = new Date(a.date).getTime();
      bVal = new Date(b.date).getTime();
    } else if (key === 'amount_paid' || key === 'total') {
      aVal = Number(aVal);
      bVal = Number(bVal);
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const statCardTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    const end = new Date();
    const start = new Date();
    if (datePeriod === 'All Time') {
      return true;
    }
    
    if (datePeriod === 'Daily') {
      start.setHours(0,0,0,0);
    } else if (datePeriod === 'Weekly') {
      start.setDate(start.getDate() - 6);
      start.setHours(0,0,0,0);
    } else if (datePeriod === 'Monthly') {
      start.setDate(1);
      start.setHours(0,0,0,0);
    }
    return d >= start && d <= end;
  });

  const totalSales = statCardTransactions.reduce((sum, t) => sum + t.amount_paid, 0);
  const totalUnpaidAmount = statCardTransactions.reduce((sum, t) => sum + (t.total - t.amount_paid), 0);
  const totalOrders = statCardTransactions.length;
  const totalCapital = statCardTransactions.reduce((sum, t) => {
    return sum + t.items.reduce((itemSum, item) => {
      const origPrice = item.product.original_price_at_time ?? item.product.original_price ?? 0;
      return itemSum + (origPrice * item.quantity);
    }, 0);
  }, 0);
  const netProfit = totalSales - totalCapital;
  
  const totalItemsSold = statCardTransactions.reduce((sum, t) => {
    return sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);

  // Calculate Total Unused Capital from inventory
  const totalUnusedCapital = inventoryItems.reduce((sum, item) => {
    const origPrice = item.original_price || 0;
    return sum + (origPrice * item.stock);
  }, 0);

  // Calculate Value of Business (Net Profit - Non-Store Expenses)
  const statCardExpenses = expenses.filter(e => {
    if (e.category === 'Store Use') return false;
    const d = new Date(e.date);
    const end = new Date();
    const start = new Date();
    if (datePeriod === 'All Time') return true;
    if (datePeriod === 'Daily') start.setHours(0,0,0,0);
    else if (datePeriod === 'Weekly') {
      start.setDate(start.getDate() - 6);
      start.setHours(0,0,0,0);
    } else if (datePeriod === 'Monthly') {
      start.setDate(1);
      start.setHours(0,0,0,0);
    }
    return d >= start && d <= end;
  });
  const totalNonStoreExpense = statCardExpenses.reduce((sum, e) => sum + e.amount, 0);
  const valueOfBusiness = netProfit - totalNonStoreExpense;

  // Generate dynamic chart data based on dashboard transactions
  const chartDataMap = new Map<string, number>();
  
  if (datePeriod === 'Daily') {
    // For Daily, aggregate by Day for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      chartDataMap.set(dayLabel, 0);
    }
    dashboardTransactions.forEach(t => {
      const dayLabel = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (chartDataMap.has(dayLabel)) {
        chartDataMap.set(dayLabel, chartDataMap.get(dayLabel)! + t.amount_paid);
      }
    });
  } else if (datePeriod === 'Weekly') {
    // For Weekly, aggregate by Week for the last 4 weeks. Display the actual start to end dates
    const weekLabels: { label: string, start: Date, end: Date }[] = [];
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    // Generate ranges from oldest to newest
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
    
    dashboardTransactions.forEach(t => {
      const d = new Date(t.date);
      // Find the appropriate week bin
      const week = weekLabels.find(w => d >= w.start && d <= w.end);
      if (week && chartDataMap.has(week.label)) {
        chartDataMap.set(week.label, chartDataMap.get(week.label)! + t.amount_paid);
      }
    });
  } else if (datePeriod === 'Monthly') {
    // For Monthly, aggregate by Month for the last 12 months, and display the Year too for clarity
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1); // Set to 1st to avoid month skipping on 31st > 30th
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      chartDataMap.set(monthLabel, 0);
    }
    dashboardTransactions.forEach(t => {
      const monthLabel = new Date(t.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (chartDataMap.has(monthLabel)) {
        chartDataMap.set(monthLabel, chartDataMap.get(monthLabel)! + t.amount_paid);
      }
    });
  } else if (datePeriod === 'All Time') {
    // For All Time, we can aggregate by Year
    const years = Array.from(new Set(dashboardTransactions.map(t => new Date(t.date).getFullYear()))).sort();
    // Ensure we have at least the current year if empty
    if (years.length === 0) years.push(new Date().getFullYear());
    
    years.forEach(year => {
      chartDataMap.set(year.toString(), 0);
    });
    dashboardTransactions.forEach(t => {
      const yearStr = new Date(t.date).getFullYear().toString();
      if (chartDataMap.has(yearStr)) {
        chartDataMap.set(yearStr, chartDataMap.get(yearStr)! + t.amount_paid);
      }
    });
  }
  
  // Convert map to array. Natively sorted chronologically due to our ordered initialization loops.
  const chartData = Array.from(chartDataMap).map(([name, total]) => ({ name, total }));
  const graphTotalSales = chartData.reduce((sum, data) => sum + data.total, 0);
  const graphAmountLabel = datePeriod === 'Daily' ? '7-day sales' : datePeriod === 'Weekly' ? '30-day sales' : datePeriod === 'Monthly' ? 'Sales for the Year' : 'All Time Sales';

  const { start: prevPeriodStart, end: prevPeriodEnd } = getPreviousDateRange(datePeriod, periodStart);
  const previousDashboardTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= prevPeriodStart && d <= prevPeriodEnd;
  });
  const previousGraphTotalSales = previousDashboardTransactions.reduce((sum, t) => sum + t.amount_paid, 0);

  // Compute previous metrics for stat cards
  const prevTotalSales = previousGraphTotalSales;
  const prevTotalUnpaidAmount = previousDashboardTransactions.reduce((sum, t) => sum + (t.total - t.amount_paid), 0);
  const prevTotalOrders = previousDashboardTransactions.length;
  const prevTotalCapital = previousDashboardTransactions.reduce((sum, t) => {
    return sum + t.items.reduce((itemSum, item) => {
      const origPrice = item.product.original_price_at_time ?? item.product.original_price ?? 0;
      return itemSum + (origPrice * item.quantity);
    }, 0);
  }, 0);
  const prevNetProfit = prevTotalSales - prevTotalCapital;
  const prevTotalItemsSold = previousDashboardTransactions.reduce((sum, t) => {
    return sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);

  const previousStatCardExpenses = expenses.filter(e => {
    if (e.category === 'Store Use') return false;
    const d = new Date(e.date);
    return d >= prevPeriodStart && d <= prevPeriodEnd;
  });
  const prevTotalNonStoreExpense = previousStatCardExpenses.reduce((sum, e) => sum + e.amount, 0);
  const prevValueOfBusiness = prevNetProfit - prevTotalNonStoreExpense;

  // Average calculations
  let avgDivisor = 1;
  let avgLabel = "day";
  let earliestStatDate = new Date();
  if (dashboardTransactions.length > 0) {
    earliestStatDate = new Date(Math.min(...dashboardTransactions.map(t => new Date(t.date).getTime())));
  }
  const daysDiffStat = Math.ceil((new Date().getTime() - earliestStatDate.getTime()) / (1000 * 60 * 60 * 24));
  let calculatedDivisor = daysDiffStat;
  if (datePeriod === 'Weekly') { calculatedDivisor = Math.ceil(daysDiffStat / 7); avgLabel = "week"; }
  else if (datePeriod === 'Monthly') { calculatedDivisor = Math.ceil(daysDiffStat / 30.44); avgLabel = "month"; }
  else if (datePeriod === 'All Time') { calculatedDivisor = Math.ceil(daysDiffStat / 365.25); avgLabel = "year"; }
  else { avgLabel = "day"; }
  avgDivisor = Math.max(1, calculatedDivisor);
  const totalSalesAvg = totalSales / avgDivisor;

  const salesGrowth = calculateGrowth(totalSales, prevTotalSales);
  const capitalGrowth = calculateGrowth(totalCapital, prevTotalCapital);
  const profitGrowth = calculateGrowth(netProfit, prevNetProfit);
  const unpaidGrowth = calculateGrowth(totalUnpaidAmount, prevTotalUnpaidAmount);
  const itemsGrowth = calculateGrowth(totalItemsSold, prevTotalItemsSold);
  const ordersGrowth = calculateGrowth(totalOrders, prevTotalOrders);
  const valueOfBusinessGrowth = calculateGrowth(valueOfBusiness, prevValueOfBusiness);
  
  const profitMargin = totalCapital > 0 ? Math.round((netProfit / totalCapital) * 100) : 0;
  const prevProfitMargin = prevTotalCapital > 0 ? Math.round((prevNetProfit / prevTotalCapital) * 100) : 0;
  const profitMarginGrowth = calculateGrowth(profitMargin, prevProfitMargin);

  const growthAmount = graphTotalSales - previousGraphTotalSales;
  const isPositiveGrowth = growthAmount >= 0;

  let growthPercentage = 0;
  if (previousGraphTotalSales > 0) {
    growthPercentage = ((graphTotalSales - previousGraphTotalSales) / previousGraphTotalSales) * 100;
  } else if (graphTotalSales > 0) {
    growthPercentage = 100;
  }

  // Fill empty states if needed
  if (chartData.length === 0) {
    chartData.push({ name: 'No Data', total: 0 });
  }

  // Generate favorite products from dashboard transactions
  const productMap = new Map<string, { id: string, name: string, category: string, orders: number, sales: number, profit: number, image: string }>();
  dashboardTransactions.forEach(t => {
    t.items.forEach(item => {
      const existing = productMap.get(item.product.id);
      
      // Calculate how much was paid proportionally for this item
      // if it's partially paid we need to distribute the amount_paid across items
      // `item.product.price` is mapped to `price_at_time` inside `useTransactionStore.ts`
      const itemTotalValue = item.product.price * item.quantity;
      let ratioPaid = 1;
      if (t.total > 0) {
        ratioPaid = t.amount_paid / t.total;
      }
      
      const itemSales = itemTotalValue * ratioPaid;
      const origPrice = item.product.original_price_at_time ?? item.product.original_price ?? 0;
      const itemCost = origPrice * item.quantity;
      const itemProfit = itemSales - itemCost;
      
      if (existing) {
        existing.orders += item.quantity;
        existing.sales += itemSales;
        existing.profit += itemProfit;
      } else {
        productMap.set(item.product.id, {
          id: item.product.id,
          name: item.product.name,
          category: item.product.category,
          orders: item.quantity,
          sales: itemSales,
          profit: itemProfit,
          image: item.product.image || 'https://images.unsplash.com/photo-1549903072-7e6e0b3c2242?auto=format&fit=crop&q=80&w=100&h=100'
        });
      }
    });
  });
  
  const dynamicFavoriteProducts = Array.from(productMap.values()).sort((a, b) => b.sales - a.sales);
  const filteredProducts = dynamicFavoriteProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  const executeDownload = () => {
    let exportTransactions = transactions;
    if (downloadType === 'Custom') {
      const dStart = new Date(downloadStart);
      dStart.setHours(0,0,0,0);
      const dEnd = new Date(downloadEnd);
      dEnd.setHours(23,59,59,999);
      exportTransactions = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= dStart && d <= dEnd;
      });
    }

    const headers = ['Order ID', 'Date', 'Customer', 'Amount Paid (PHP)', 'Total Order (PHP)', 'Payment Status', 'Items Sold'];
    const rows = exportTransactions.map(t => [
      t.id,
      new Date(t.date).toLocaleString(),
      t.customer,
      t.amount_paid.toString(),
      t.total.toString(),
      t.payment,
      t.items.map((item: any) => `${item.quantity}x ${item.product.name}`).join('; ')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = downloadType === 'All' ? 'sales_report_all_time.csv' : `sales_report_${downloadStart}_to_${downloadEnd}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDownloadModal(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6 max-w-7xl mx-auto pb-8"
      onClick={() => setShowAverageFor(null)}
    >
      
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100 whitespace-nowrap overflow-x-auto hide-scrollbar">
            {['Daily', 'Weekly', 'Monthly', 'All Time'].map((period) => (
              <button
                key={period}
                onClick={() => setDatePeriod(period)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  datePeriod === period 
                    ? 'bg-primary-50 text-primary-600 shadow-sm' 
                    : 'text-gray-500 hover:text-text-main hover:bg-gray-50'
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

      {/* Stat Cards - Top Highlighted Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <StatCard 
          title="Value of Business" 
          value={formatPHP(valueOfBusiness)} 
          unit="" 
          growth={formatPHP(Math.abs(valueOfBusinessGrowth.amount))} 
          percentage={`${Math.abs(valueOfBusinessGrowth.percentage).toFixed(1)}%`} 
          isPositive={valueOfBusinessGrowth.isPositive} 
          icon={<WadOfMoney className="w-8 h-8 text-indigo-500" />} 
        />
        <StatCard 
          title="Net Profit" 
          value={formatPHP(netProfit)} 
          unit="" 
          growth={formatPHP(Math.abs(profitGrowth.amount))} 
          percentage={`${Math.abs(profitGrowth.percentage).toFixed(1)}%`} 
          isPositive={profitGrowth.isPositive} 
          icon={<WadOfMoney className="w-8 h-8 text-success" />} 
        />
        <StatCard 
          title="Profit Margin" 
          value={`${profitMargin}%`} 
          unit="" 
          growth={`${Math.abs(profitMarginGrowth.amount)}%`} 
          percentage={`${Math.abs(profitMarginGrowth.percentage).toFixed(1)}%`} 
          isPositive={profitMarginGrowth.isPositive} 
          icon={<GraphUp className="w-8 h-8 text-purple-500" />} 
        />
      </div>

      {/* Stat Cards - Secondary Smaller Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard 
          isSmall
          title="Total Sales" 
          value={formatPHP(totalSales)} 
          unit="" 
          growth={formatPHP(Math.abs(salesGrowth.amount))} 
          percentage={`${Math.abs(salesGrowth.percentage).toFixed(1)}%`} 
          isPositive={salesGrowth.isPositive} 
          icon={<ChartSquare className="w-5 h-5 text-primary-500" />} 
          onAverageClick={() => setShowAverageFor(showAverageFor === 'Total Sales' ? null : 'Total Sales')}
          showAverage={showAverageFor === 'Total Sales'}
          averageValue={formatPHP(totalSalesAvg)}
          averageLabel={avgLabel}
        />
        <StatCard 
          isSmall
          title="Used Capital" 
          value={formatPHP(totalCapital)} 
          unit="" 
          growth={formatPHP(Math.abs(capitalGrowth.amount))} 
          percentage={`${Math.abs(capitalGrowth.percentage).toFixed(1)}%`} 
          isPositive={capitalGrowth.isPositive} 
          icon={<Wallet className="w-5 h-5 text-indigo-500" />} 
        />
        <StatCard 
          isSmall
          title="Unused Capital" 
          value={formatPHP(totalUnusedCapital)} 
          unit="" 
          growth="0" 
          percentage="0.0%" 
          isPositive 
          icon={<Wallet className="w-5 h-5 text-blue-400" />} 
        />
        <StatCard 
          isSmall
          title="Unpaid Amount" 
          value={formatPHP(totalUnpaidAmount)} 
          unit="" 
          growth={formatPHP(Math.abs(unpaidGrowth.amount))} 
          percentage={`${Math.abs(unpaidGrowth.percentage).toFixed(1)}%`} 
          isPositive={unpaidGrowth.isPositive} 
          icon={<Wallet className="w-5 h-5 text-danger" />} 
        />
        <StatCard 
          isSmall
          title="Products Sold" 
          value={totalItemsSold.toString()} 
          unit="Items" 
          growth={`${Math.abs(itemsGrowth.amount)}`} 
          percentage={`${Math.abs(itemsGrowth.percentage).toFixed(1)}%`} 
          isPositive={itemsGrowth.isPositive} 
          icon={<Box className="w-5 h-5 text-orange-400" />} 
        />
        <StatCard 
          isSmall
          title="Total Orders" 
          value={totalOrders.toString()} 
          unit="Orders" 
          growth={`${Math.abs(ordersGrowth.amount)}`} 
          percentage={`${Math.abs(ordersGrowth.percentage).toFixed(1)}%`} 
          isPositive={ordersGrowth.isPositive} 
          icon={<UsersGroupRounded className="w-5 h-5 text-purple-500" />} 
        />
      </div>

      {/* Main Content Grid */}
      <div className={`grid grid-cols-1 ${showGraph ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
        
        {/* Chart Section */}
        {showGraph && (
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-500"></span>
              Sales Graph
            </h3>
            <div className="px-4 py-2 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-600 font-medium">
              {datePeriod} Sales Amount
            </div>
          </div>
          
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000000', fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000000', fontWeight: 'bold' }} tickFormatter={(value) => `₱${value.toLocaleString()}`} dx={-10} width={80} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="total" fill="url(#colorTotal)" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
             <div className="flex flex-col gap-1 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
               <span className="text-gray-500 text-sm">{graphAmountLabel}</span>
               <div className="flex items-baseline gap-2">
                 <span className="text-2xl font-medium">{formatPHP(graphTotalSales)}</span>
               </div>
             </div>
             <div className="flex flex-col gap-1 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
               <span className="text-gray-500 text-sm flex justify-between">
                 Growth
                 <span className={`flex items-center gap-1 ${isPositiveGrowth ? 'text-success' : 'text-danger'}`}>
                   {isPositiveGrowth ? <GraphUp className="w-3 h-3" /> : <GraphDown className="w-3 h-3" />}
                   {Math.abs(growthPercentage).toFixed(2)}%
                 </span>
               </span>
               <div className="flex items-baseline gap-2">
                 <span className={`text-2xl font-medium ${isPositiveGrowth ? 'text-success' : 'text-danger'}`}>
                   {isPositiveGrowth ? '+ ' : '- '}{formatPHP(Math.abs(growthAmount))}
                 </span>
               </div>
             </div>
          </div>
        </div>
        )}

        {/* Favorite Products */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <h3 className="text-lg flex items-center gap-2 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-primary-500"></span>
              Top Selling Products
            </h3>
            <div className="relative w-full sm:w-auto">
              <input 
                type="text" 
                placeholder="Search product..." 
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 w-full sm:w-48 transition-all"
              />
              <Magnifer className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
          
          <div className="w-full">
            {/* Header row using Grid */}
            <div className="grid grid-cols-12 gap-2 items-center text-xs text-gray-400 mb-4 px-2">
              <span className="col-span-2 text-center">Img</span>
              <span className="col-span-3 text-left font-medium">Product Name</span>
              <span className="col-span-2 text-center text-[11px] sm:text-xs">Orders</span>
              <span className="col-span-2 text-right text-[11px] sm:text-xs">Sales</span>
              <span className="col-span-2 text-right text-[11px] sm:text-xs">Profit</span>
              <span className="col-span-1 text-center text-[11px] sm:text-xs"></span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 max-h-[350px] pr-1">
              {filteredProducts.length > 0 ? filteredProducts.map((product) => (
                <div key={product.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-2xl border border-transparent hover:border-gray-50 hover:bg-gray-50/50 hover:shadow-sm transition-all group">
                  
                  {/* Image */}
                  <div className="col-span-2 flex justify-center">
                    <img src={product.image} alt={product.name} className="w-10 h-10 rounded-xl object-cover bg-gray-100 flex-shrink-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]" />
                  </div>
                  
                  {/* Name and Category */}
                  <div className="col-span-3 text-left min-w-0 pr-1 shrink">
                    <h4 className="text-sm font-medium text-text-main truncate" title={product.name}>{product.name}</h4>
                    <span className="text-[10px] text-primary-500 font-semibold tracking-wide truncate block uppercase">{product.category}</span>
                  </div>
                  
                  {/* Orders */}
                  <div className="col-span-2 text-center text-[12px] font-medium text-gray-600">
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md">{product.orders}</span>
                  </div>
                  
                  {/* Sales */}
                  <div className="col-span-2 text-right text-[12px] font-bold text-primary-600 truncate" title={formatPHP(product.sales)}>
                    {formatPHP(product.sales)}
                  </div>
                  
                  {/* Profit */}
                  <div className="col-span-2 text-right text-[12px] font-bold text-success truncate" title={formatPHP(product.profit)}>
                    {formatPHP(product.profit)}
                  </div>
                  
                  {/* Actions */}
                  <div className="col-span-1 flex justify-center">
                    <button 
                      onClick={() => setSelectedProductMetrics(product)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="View Metrics"
                    >
                      <ChartSquare className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-12">
                  <Box className="w-12 h-12 text-gray-200 mb-2" />
                  No products matched your search.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* All Orders Table */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
           <h3 className="text-lg flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-primary-500"></span>
             All Orders
           </h3>
           
           <div className="flex flex-wrap items-center gap-3 text-sm">
             <div className="flex items-center gap-2 text-gray-500">
               Date: 
               <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-text-main">
                 <input 
                   type="date" 
                   value={startDate}
                   onChange={(e) => setStartDate(e.target.value)}
                   className="bg-transparent border-none focus:outline-none text-sm"
                 />
               </div>
               -
               <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-text-main">
                 <input 
                   type="date" 
                   value={endDate}
                   onChange={(e) => setEndDate(e.target.value)}
                   className="bg-transparent border-none focus:outline-none text-sm"
                 />
               </div>
             </div>
           </div>
        </div>

        <div 
          ref={tableContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`overflow-auto max-h-[600px] relative border border-gray-100 rounded-2xl hide-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <table className="w-full min-w-[1000px] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-white z-10 shadow-sm">
              <tr className="text-gray-500">
                <th className="pb-4 pt-4 text-center cursor-pointer" onClick={() => requestSort('id')}>
                  <div className="border border-gray-200 hover:bg-gray-50 transition-colors rounded-full py-1 px-4 flex items-center justify-center gap-1 whitespace-nowrap">
                    Order Number {sortConfig?.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </div>
                </th>
                <th className="pb-4 pt-4">
                  <div className="border border-gray-200 rounded-full py-1 px-4 mx-2 flex items-center justify-center gap-2">
                    <span className="cursor-pointer hover:text-primary-600 transition-colors flex items-center gap-1" onClick={() => requestSort('date')}>
                      Date & Time {sortConfig?.key === 'date' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </span>
                    <select 
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="bg-transparent text-xs font-semibold outline-none cursor-pointer text-gray-700"
                    >
                      <option value="All">All Dates</option>
                      {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </th>
                <th className="pb-4 pt-4">
                  <div className="border border-gray-200 rounded-full py-1 px-4 mx-2 text-center flex items-center justify-center gap-2">
                    <span className="cursor-pointer hover:text-primary-600 transition-colors flex items-center gap-1" onClick={() => requestSort('customer')}>
                      Customer Name {sortConfig?.key === 'customer' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </span>
                    <select 
                      value={customerFilter}
                      onChange={(e) => setCustomerFilter(e.target.value)}
                      className="bg-transparent text-xs font-semibold outline-none cursor-pointer text-gray-700 max-w-[100px] truncate"
                    >
                      <option value="All">All Customers</option>
                      {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </th>
                <th className="pb-4 pt-4 cursor-pointer" onClick={() => requestSort('amount_paid')}>
                  <div className="border border-gray-200 hover:bg-gray-50 transition-colors rounded-full py-1 px-4 mx-2 text-center flex items-center justify-center gap-1">
                    Amount Paid {sortConfig?.key === 'amount_paid' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </div>
                </th>
                <th className="pb-4 pt-4 cursor-pointer" onClick={() => requestSort('total')}>
                  <div className="border border-gray-200 hover:bg-gray-50 transition-colors rounded-full py-1 px-4 mx-2 text-center flex items-center justify-center gap-1">
                    Total Order {sortConfig?.key === 'total' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </div>
                </th>
                <th className="pb-4 pt-4">
                  <div className="border border-gray-200 rounded-full py-1 px-4 mx-2 text-center flex items-center justify-center gap-2">
                    Payment Status
                    <select 
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value)}
                      className="bg-transparent text-xs font-semibold outline-none cursor-pointer text-gray-700"
                    >
                      <option value="All">All</option>
                      <option value="Paid">Paid</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                  </div>
                </th>
                <th className="pb-4 pt-4"><div className="border border-gray-200 rounded-full py-1 px-4 text-center">Details</div></th>
                <th className="pb-4 pt-4"><div className="border border-gray-200 rounded-full py-1 px-4 mx-2 text-center">Actions</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.length > 0 ? filteredTransactions.map((order) => (
                <tr key={order.id} className="text-center hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 text-gray-500">{order.id}</td>
                  <td className="py-4 text-left px-6">{new Date(order.date).toLocaleString()}</td>
                  <td className="py-4">{order.customer}</td>
                  <td className="py-4 font-medium text-primary-600">{formatPHP(order.amount_paid)}</td>
                  <td className="py-4 font-medium">
                    {order.items.some((i: any) => i.product.price === 0) 
                      ? <span className="text-danger" title="Profit (Expense)">{formatPHP(order.amount_paid - order.items.reduce((sum: number, item: any) => sum + ((item.product.original_price_at_time || item.product.original_price || 0) * item.quantity), 0))}</span> 
                      : formatPHP(order.total)}
                  </td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full ${
                      order.payment === 'Paid' ? 'text-success bg-success/10' : 
                      order.payment === 'Partially Paid' ? 'text-orange-500 bg-orange-500/10' : 
                      'text-danger bg-danger/10'
                    }`}>
                      {order.payment}
                    </span>
                  </td>
                  <td className="py-4 text-primary-500 cursor-pointer hover:underline" onClick={() => setSelectedOrder(order)}>Detail</td>
                  <td className="py-4">
                    <button 
                      onClick={() => {
                        setTransactionToUndo(order.id);
                        setShowUndoModal(true);
                      }}
                      className="text-danger hover:underline px-3 py-1 bg-danger/5 rounded-full text-xs font-medium"
                    >
                      Undo
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">No matching orders found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedOrder(null);
                setIsEditingPayment(false);
              }}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h2 className="text-xl font-medium text-gray-900 font-outfit">Order Details</h2>
                  <p className="text-sm text-gray-500">Transaction ID: {selectedOrder.id}</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedOrder(null);
                    setIsEditingPayment(false);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <CloseCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto hide-scrollbar">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <p className="text-sm text-gray-500">Customer</p>
                    <p className="font-medium">{selectedOrder.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Date & Time</p>
                    <p className="font-medium">{new Date(selectedOrder.date).toLocaleString()}</p>
                  </div>
                </div>

                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50/50">
                      <tr className="text-gray-500">
                        <th className="px-4 py-3 font-medium">Product</th>
                        <th className="px-4 py-3 font-medium text-center">Price</th>
                        <th className="px-4 py-3 font-medium text-center">Qty</th>
                        <th className="px-4 py-3 font-medium text-right">Total Sales</th>
                        <th className="px-4 py-3 font-medium text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedOrder.items.map((item: any, idx: number) => {
                        const totalSales = item.product.price * item.quantity;
                        const origPrice = item.product.original_price || item.product.originalPrice || 0;
                        const profit = totalSales - (origPrice * item.quantity);
                        
                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <img src={item.product.image || 'https://images.unsplash.com/photo-1549903072-7e6e0b3c2242?auto=format&fit=crop&q=80&w=100&h=100'} alt={item.product.name} className="w-10 h-10 rounded-lg object-cover bg-gray-50" />
                                <div>
                                  <p className="font-medium text-gray-900">{item.product.name}</p>
                                  <p className="text-[10px] text-primary-500">{item.product.category}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">{formatPHP(item.product.price)}</td>
                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">{formatPHP(totalSales)}</td>
                            <td className="px-4 py-3 text-right font-medium text-success">{formatPHP(profit)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50/50">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right font-medium text-gray-500 border-t border-gray-200">Total Order</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 border-t border-gray-200">{formatPHP(selectedOrder.total)}</td>
                        <td className="px-4 py-3 text-right font-bold text-success border-t border-gray-200">
                          {formatPHP(selectedOrder.items.reduce((sum: number, item: any) => {
                             const totalSales = item.product.price * item.quantity;
                             const origPrice = item.product.original_price || item.product.originalPrice || 0;
                             return sum + (totalSales - (origPrice * item.quantity));
                          }, 0))}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right font-medium text-gray-500">
                          <div className="flex items-center justify-end gap-2">
                            {isEditingPayment ? (
                              <>
                                <button 
                                  onClick={() => setIsEditingPayment(false)}
                                  className="text-xs text-gray-400 hover:text-gray-600 underline px-2 py-1"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={async () => {
                                    let finalAmount = 0;
                                    if (editPaymentStatus === 'Paid') finalAmount = selectedOrder.total;
                                    else if (editPaymentStatus === 'Partially Paid') finalAmount = parseFloat(editAmountPaid) || 0;
                                    
                                    await updateTransactionPayment(selectedOrder.id, editPaymentStatus, finalAmount);
                                    
                                    // Update local selectedOrder state to reflect immediately in modal without closing
                                    setSelectedOrder({
                                      ...selectedOrder,
                                      payment: editPaymentStatus,
                                      amount_paid: finalAmount
                                    });
                                    setIsEditingPayment(false);
                                  }}
                                  className="text-xs text-white bg-primary-600 hover:bg-primary-700 px-3 py-1 rounded-full font-medium shadow-sm transition-colors"
                                >
                                  Save
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => {
                                  setEditPaymentStatus(selectedOrder.payment);
                                  setEditAmountPaid(selectedOrder.amount_paid.toString());
                                  setIsEditingPayment(true);
                                }}
                                className="text-xs text-primary-600 bg-primary-50 px-3 py-1 rounded-full font-medium hover:bg-primary-100 transition-colors"
                              >
                                Edit Status
                              </button>
                            )}
                            <span>Payment Status</span>
                          </div>
                        </td>
                        <td colSpan={2} className="px-4 py-3 text-right font-medium">
                          {isEditingPayment ? (
                            <select 
                              value={editPaymentStatus}
                              onChange={(e) => setEditPaymentStatus(e.target.value as any)}
                              className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-primary-400 w-full"
                            >
                              <option value="Paid">Paid</option>
                              <option value="Partially Paid">Partially Paid</option>
                              <option value="Unpaid">Unpaid</option>
                            </select>
                          ) : (
                            <span className={`px-3 py-1 text-xs rounded-full inline-block ${
                              selectedOrder.payment === 'Paid' ? 'text-success bg-success/10' : 
                              selectedOrder.payment === 'Partially Paid' ? 'text-orange-500 bg-orange-500/10' : 
                              'text-danger bg-danger/10'
                            }`}>
                              {selectedOrder.payment}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right font-medium text-gray-700">Amount Paid</td>
                        <td colSpan={2} className="px-4 py-3 text-right font-bold text-primary-600 text-lg">
                          {isEditingPayment && editPaymentStatus === 'Partially Paid' ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-sm font-normal text-gray-500">₱</span>
                              <input 
                                type="number" 
                                value={editAmountPaid}
                                onChange={(e) => setEditAmountPaid(e.target.value)}
                                className="w-24 text-right text-sm px-2 py-1 rounded-lg border border-gray-200 outline-none focus:border-primary-400"
                                placeholder="0.00"
                              />
                            </div>
                          ) : isEditingPayment && editPaymentStatus === 'Paid' ? (
                            formatPHP(selectedOrder.total)
                          ) : isEditingPayment && editPaymentStatus === 'Unpaid' ? (
                            formatPHP(0)
                          ) : (
                            formatPHP(selectedOrder.amount_paid)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Undo Modal */}
      <AnimatePresence>
        {showUndoModal && transactionToUndo && (
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
              <p className="text-sm text-center text-gray-500 mb-6">
                Are you sure you want to undo transaction <strong>{transactionToUndo}</strong>? This will reverse the sale and restore inventory.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowUndoModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    await useTransactionStore.getState().reverseTransaction(transactionToUndo);
                    setShowUndoModal(false);
                    setTransactionToUndo(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-danger text-white rounded-xl font-medium hover:bg-danger/90 transition-colors shadow-sm"
                >
                  Undo Order
                </button>
              </div>
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
              <h3 className="text-xl font-bold text-gray-900 mb-6">Download Report</h3>
              
              <div className="flex flex-col gap-4 mb-6">
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input 
                    type="radio" 
                    checked={downloadType === 'All'}
                    onChange={() => setDownloadType('All')}
                    className="w-4 h-4 text-primary-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">All Time Sales</p>
                    <p className="text-xs text-gray-500">Download entire sales history</p>
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
      
      {/* Product Metrics Modal */}
      <AnimatePresence>
        {selectedProductMetrics && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              onClick={() => setSelectedProductMetrics(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-6 w-full max-w-2xl relative z-10 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-4">
                  <img src={selectedProductMetrics.image} className="w-12 h-12 rounded-xl object-cover shadow-sm bg-gray-50" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedProductMetrics.name}</h3>
                    <span className="text-sm text-primary-600 font-semibold tracking-wide uppercase">{selectedProductMetrics.category}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedProductMetrics(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                  <CloseCircle className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-center">
                  <span className="text-xs text-gray-500 font-medium mb-1">Total Items Ordered</span>
                  <span className="text-2xl font-bold text-gray-900">{selectedProductMetrics.orders}</span>
                </div>
                <div className="bg-primary-50 p-4 rounded-2xl border border-primary-100 flex flex-col justify-center">
                  <span className="text-xs text-primary-600 font-medium mb-1">Revenue Generated</span>
                  <span className="text-2xl font-bold text-primary-700">{formatPHP(selectedProductMetrics.sales)}</span>
                </div>
                <div className="bg-success/10 p-4 rounded-2xl border border-success/20 flex flex-col justify-center">
                  <span className="text-xs text-success font-medium mb-1">Total Net Profit</span>
                  <span className="text-2xl font-bold text-success">{formatPHP(selectedProductMetrics.profit)}</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col">
                <h4 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  {datePeriod} Sales Trend
                </h4>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getChartDataForProduct(selectedProductMetrics.id, dashboardTransactions, datePeriod)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorProduct" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(value) => `₱${value.toLocaleString()}`} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }} 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px -6px rgba(0,0,0,0.1)' }} 
                        formatter={(value: any) => [formatPHP(Number(value)), 'Sales Amount']} 
                        labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                      />
                      <Bar dataKey="total" fill="url(#colorProduct)" radius={[6, 6, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ title, value, unit, growth, percentage, isPositive, icon, isSmall = false, onAverageClick, showAverage, averageValue, averageLabel }: any) {
  const isNegativeValue = typeof value === 'string' && value.includes('-');

  return (
    <div className={`bg-white rounded-3xl ${isSmall ? 'p-4' : 'p-6'} shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow cursor-default h-full relative group`}>
      <div className={`flex items-start justify-between ${isSmall ? 'mb-2' : 'mb-4'}`}>
        <div className={`flex items-center gap-3`}>
          <span className="text-gray-400">{icon}</span>
          {!isSmall && <h4 className="text-gray-600 text-sm font-medium">{title}</h4>}
        </div>
        
        {/* Growth Bubble and possible popover trigger */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {onAverageClick && (
              <div 
                className="w-6 h-6 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-primary-100 transition-colors"
                onClick={(e) => { e.stopPropagation(); onAverageClick(); }}
                title="Click for Average"
              >
                <div style={{ transform: "scale(0.6)" }}><CalendarIcon /></div>
              </div>
            )}
            <span className={`flex items-center gap-0.5 ${isPositive ? 'text-success' : 'text-danger'} ${isSmall ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'} font-medium bg-${isPositive ? 'green' : 'red'}-50 rounded-lg`}>
              {isPositive ? <GraphUp className={isSmall ? "w-2.5 h-2.5" : "w-3 h-3"} /> : <GraphDown className={isSmall ? "w-2.5 h-2.5" : "w-3 h-3"} />}
              {percentage}
            </span>
          </div>
          {!isSmall && <span className={`text-[10px] font-medium ${isPositive ? 'text-success' : 'text-danger'}`}>{isPositive ? '+' : ''}{growth}</span>}
        </div>
      </div>
      
      {isSmall && <h4 className="text-gray-500 text-[11px] font-medium mb-1 line-clamp-1" title={title}>{title}</h4>}
      
      <div className={`flex items-baseline gap-1 break-all`}>
        <span className={`${isSmall ? 'text-lg md:text-xl' : 'text-3xl'} font-bold ${isNegativeValue ? 'text-danger' : 'text-gray-900'} tracking-tight leading-none`}>
          {value}
        </span>
        {unit && <span className={`${isSmall ? 'text-[10px]' : 'text-sm'} text-gray-400 font-medium`}>{unit}</span>}
      </div>

      <AnimatePresence>
        {showAverage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`absolute left-0 right-0 ${isSmall ? '-bottom-20' : '-bottom-24'} bg-white rounded-2xl border border-primary-100 p-4 shadow-xl z-50 cursor-default`}
            onClick={(e) => e.stopPropagation()}
          >
             <p className="text-xs text-gray-500 font-bold tracking-widest uppercase text-center mb-2">
               Average
             </p>
             <p className={`${isSmall ? 'text-sm' : 'text-base md:text-lg'} text-primary-700 font-bold text-center bg-primary-50 py-2.5 rounded-xl`}>
               {averageValue} / {averageLabel}
             </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Minimal calendar icon for the button
function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );
}
