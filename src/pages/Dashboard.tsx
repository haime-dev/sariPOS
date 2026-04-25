import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Download, GraphUp, GraphDown, Magnifer, ChartSquare, Box, UsersGroupRounded, WadOfMoney, Wallet, CloseCircle, DangerTriangle } from '@solar-icons/react';
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
  const [graphMetric, setGraphMetric] = useState<'Sales' | 'Net Profit' | 'Value of Business' | 'Used Capital' | 'Profit Margin' | 'Available Cash'>('Sales');

  // Top Selling Products Search & Metrics
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductMetrics, setSelectedProductMetrics] = useState<any>(null);
  const [isAlertMinimized, setIsAlertMinimized] = useState(false);
  const [showUnpaidBreakdown, setShowUnpaidBreakdown] = useState(false);

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
  const [transactionsToUndo, setTransactionsToUndo] = useState<string[]>([]);
  const [selectedOrdersToUndo, setSelectedOrdersToUndo] = useState<string[]>([]);

  // Download Modal State
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadType, setDownloadType] = useState<'All' | 'Custom'>('All');
  const [downloadStart, setDownloadStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [downloadEnd, setDownloadEnd] = useState(new Date().toISOString().split('T')[0]);
  
  // Set default date range to today
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
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
  
  const { transactions, fetchTransactions, updateTransactionPayment, reverseTransaction } = useTransactionStore();
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

  const totalSales = statCardTransactions.reduce((sum, t) => sum + (t.customer === 'Family Expense' ? 0 : t.amount_paid), 0);
  const totalUnpaidAmount = statCardTransactions.reduce((sum, t) => sum + (t.customer === 'Family Expense' ? 0 : (t.total - t.amount_paid)), 0);
  const totalOrders = statCardTransactions.length;
  const totalCapital = statCardTransactions.reduce((sum, t) => {
    let ratioPaid = t.total > 0 ? t.amount_paid / t.total : 1;
    return sum + t.items.reduce((itemSum, item) => {
      const isExpense = t.customer === 'Family Expense' || (item.product.price === 0 && item.quantity > 0);
      const origPrice = item.product.original_price_at_time ?? item.product.original_price ?? 0;
      const effectiveRatioPaid = isExpense ? 1 : ratioPaid;
      return itemSum + (origPrice * item.quantity * effectiveRatioPaid);
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

  // Generate dynamic chart data based on dashboard transactions and expenses
  const chartDataMap = new Map<string, { Sales: number; 'Net Profit': number; 'Value of Business': number; 'Used Capital': number; 'Profit Margin': number; 'Available Cash': number }>();
  const createEmptyBin = () => ({ Sales: 0, 'Net Profit': 0, 'Value of Business': 0, 'Used Capital': 0, 'Profit Margin': 0, 'Available Cash': 0 });
  const weekLabels: { label: string, start: Date, end: Date }[] = [];
  
  if (datePeriod === 'Daily') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      chartDataMap.set(dayLabel, createEmptyBin());
    }
  } else if (datePeriod === 'Weekly') {
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
      chartDataMap.set(label, createEmptyBin());
    }
  } else if (datePeriod === 'Monthly') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1); 
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      chartDataMap.set(monthLabel, createEmptyBin());
    }
  } else if (datePeriod === 'All Time') {
    const years = Array.from(new Set(dashboardTransactions.map(t => new Date(t.date).getFullYear()))).sort();
    if (years.length === 0) years.push(new Date().getFullYear());
    years.forEach(year => {
      chartDataMap.set(year.toString(), createEmptyBin());
    });
  }

  // Aggregate transactions
  dashboardTransactions.forEach(t => {
    let binLabel = null;
    const d = new Date(t.date);
    if (datePeriod === 'Daily') binLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    else if (datePeriod === 'Weekly') {
      const week = weekLabels.find(w => d >= w.start && d <= w.end);
      if (week) binLabel = week.label;
    } else if (datePeriod === 'Monthly') {
      binLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else if (datePeriod === 'All Time') {
      binLabel = d.getFullYear().toString();
    }

    if (binLabel && chartDataMap.has(binLabel)) {
      const bin = chartDataMap.get(binLabel)!;
      const isExpenseOrder = t.customer === 'Family Expense';
      const sales = isExpenseOrder ? 0 : t.amount_paid;
      let ratioPaid = t.total > 0 ? t.amount_paid / t.total : 1;
      const capital = t.items.reduce((s, item) => {
        const isExpense = isExpenseOrder || (item.product.price === 0 && item.quantity > 0);
        const effectiveRatioPaid = isExpense ? 1 : ratioPaid;
        return s + (item.product.original_price_at_time ?? item.product.original_price ?? 0) * item.quantity * effectiveRatioPaid;
      }, 0);
      const profit = sales - capital;
      
      bin.Sales += sales;
      bin['Used Capital'] += capital;
      bin['Net Profit'] += profit;
      bin['Value of Business'] += profit;
    }
  });

  // Distribute expenses into bins for Value of Business
  statCardExpenses.forEach(e => {
    if (e.category === 'Store Use') return;
    let binLabel = null;
    const d = new Date(e.date);
    if (datePeriod === 'Daily') binLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    else if (datePeriod === 'Weekly') {
      const week = weekLabels.find(w => d >= w.start && d <= w.end);
      if (week) binLabel = week.label;
    } else if (datePeriod === 'Monthly') {
      binLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else if (datePeriod === 'All Time') {
      binLabel = d.getFullYear().toString();
    }
    
    if (binLabel && chartDataMap.has(binLabel)) {
      const bin = chartDataMap.get(binLabel)!;
      bin['Value of Business'] -= e.amount;
    }
  });

  chartDataMap.forEach(bin => {
    bin['Profit Margin'] = bin['Used Capital'] > 0 ? (bin['Net Profit'] / bin['Used Capital']) * 100 : 0;
    bin['Available Cash'] = bin['Value of Business'] + bin['Used Capital'];
  });

  const chartDataRaw = Array.from(chartDataMap).map(([name, data]) => ({ name, ...data }));
  const chartData = chartDataRaw.map(data => ({ name: data.name, total: data[graphMetric] }));
  const graphAmountLabel = datePeriod === 'Daily' ? `7-day ${graphMetric}` : datePeriod === 'Weekly' ? `30-day ${graphMetric}` : datePeriod === 'Monthly' ? `${graphMetric} for the Year` : `All Time ${graphMetric}`;

  const { start: prevPeriodStart, end: prevPeriodEnd } = getPreviousDateRange(datePeriod, periodStart);
  const previousDashboardTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= prevPeriodStart && d <= prevPeriodEnd;
  });

  // Compute previous metrics for stat cards
  const prevTotalSales = previousDashboardTransactions.reduce((sum, t) => sum + (t.customer === 'Family Expense' ? 0 : t.amount_paid), 0);
  const prevTotalUnpaidAmount = previousDashboardTransactions.reduce((sum, t) => sum + (t.customer === 'Family Expense' ? 0 : (t.total - t.amount_paid)), 0);
  const prevTotalOrders = previousDashboardTransactions.length;
  const prevTotalCapital = previousDashboardTransactions.reduce((sum, t) => {
    let ratioPaid = t.total > 0 ? t.amount_paid / t.total : 1;
    return sum + t.items.reduce((itemSum, item) => {
      const isExpense = t.customer === 'Family Expense' || (item.product.price === 0 && item.quantity > 0);
      const origPrice = item.product.original_price_at_time ?? item.product.original_price ?? 0;
      const effectiveRatioPaid = isExpense ? 1 : ratioPaid;
      return itemSum + (origPrice * item.quantity * effectiveRatioPaid);
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

  let absoluteEarliestDate = new Date();
  if (transactions.length > 0) {
    absoluteEarliestDate = new Date(Math.min(...transactions.map(t => new Date(t.date).getTime())));
  }
  const absoluteDaysSinceFirstItem = Math.max(1, Math.ceil((new Date().getTime() - absoluteEarliestDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  let divisor = 1;
  let avgLabel = "";
  let avgSymbol = "/d";
  if (datePeriod === 'Daily') {
    divisor = 7;
    avgLabel = "day (this period)";
    avgSymbol = "/d";
  } else if (datePeriod === 'Weekly') {
    divisor = 4;
    avgLabel = "week (this period)";
    avgSymbol = "/w";
  } else if (datePeriod === 'Monthly') {
    divisor = 12;
    avgLabel = "month (this period)";
    avgSymbol = "/mo";
  } else if (datePeriod === 'All Time') {
    divisor = absoluteDaysSinceFirstItem;
    avgLabel = "day (all time)";
    avgSymbol = "/d";
  }
  
  const totalSalesAvg = totalSales / divisor;
  const netProfitAvg = netProfit / divisor;
  const valueOfBusinessAvg = valueOfBusiness / divisor;

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

  const availableCash = valueOfBusiness + totalCapital;
  const prevAvailableCash = prevValueOfBusiness + prevTotalCapital;
  const availableCashAvg = availableCash / divisor;
  const availableCashGrowth = calculateGrowth(availableCash, prevAvailableCash);

  const previousGraphTotalValue = 
    graphMetric === 'Sales' ? prevTotalSales :
    graphMetric === 'Net Profit' ? prevNetProfit :
    graphMetric === 'Value of Business' ? prevValueOfBusiness :
    graphMetric === 'Used Capital' ? prevTotalCapital :
    graphMetric === 'Profit Margin' ? prevProfitMargin : 
    graphMetric === 'Available Cash' ? prevAvailableCash : 0;

  const currentGraphTotalValue = 
    graphMetric === 'Sales' ? totalSales :
    graphMetric === 'Net Profit' ? netProfit :
    graphMetric === 'Value of Business' ? valueOfBusiness :
    graphMetric === 'Used Capital' ? totalCapital :
    graphMetric === 'Profit Margin' ? profitMargin :
    graphMetric === 'Available Cash' ? availableCash : 0;

  const growthAmount = currentGraphTotalValue - previousGraphTotalValue;
  const isPositiveGrowth = growthAmount >= 0;

  let growthPercentage = 0;
  if (previousGraphTotalValue > 0) {
    growthPercentage = ((currentGraphTotalValue - previousGraphTotalValue) / previousGraphTotalValue) * 100;
  } else if (currentGraphTotalValue > 0) {
    growthPercentage = 100;
  }

  const formatGraphValue = (val: number) => graphMetric === 'Profit Margin' ? `${val.toFixed(1)}%` : formatPHP(val);

  // Fill empty states if needed
  if (chartData.length === 0) {
    chartData.push({ name: 'No Data', total: 0 });
  }

  // Compute first sold dates globally to calculate average profit properly
  const firstSoldDates = new Map<string, Date>();
  transactions.forEach(t => {
    const tDate = new Date(t.date);
    t.items.forEach((item: any) => {
      const pid = item.product.id;
      if (!firstSoldDates.has(pid) || tDate < firstSoldDates.get(pid)!) {
        firstSoldDates.set(pid, tDate);
      }
    });
  });

  // Generate favorite products from dashboard transactions
  const productMap = new Map<string, { id: string, name: string, category: string, orders: number, sales: number, profit: number, avgProfit: number, avgSales: number, avgOrders: number, image: string }>();
  dashboardTransactions.forEach(t => {
    const isExpenseOrder = t.customer === 'Family Expense';
    t.items.forEach(item => {
      const existing = productMap.get(item.product.id);
      
      const isExpense = isExpenseOrder || (item.product.price === 0 && item.quantity > 0);
      const itemTotalValue = isExpense ? 0 : (item.product.price * item.quantity);
      let ratioPaid = 1;
      if (t.total > 0 && !isExpense) {
        ratioPaid = t.amount_paid / t.total;
      }
      
      const itemSales = itemTotalValue * ratioPaid;
      const origPrice = item.product.original_price_at_time ?? item.product.original_price ?? 0;
      const effectiveRatioPaid = isExpense ? 1 : (t.total > 0 ? t.amount_paid / t.total : 1);
      const itemCost = origPrice * item.quantity * effectiveRatioPaid;
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
          avgProfit: 0,
          avgSales: 0,
          avgOrders: 0,
          image: item.product.image || 'https://images.unsplash.com/photo-1549903072-7e6e0b3c2242?auto=format&fit=crop&q=80&w=100&h=100'
        });
      }
    });
  });
  
  // Calculate averages per product based on the selected time frame
  Array.from(productMap.values()).forEach(product => {
    product.avgProfit = product.profit / divisor;
    product.avgSales = product.sales / divisor;
    product.avgOrders = product.orders / divisor;
  });

  const dynamicFavoriteProducts = Array.from(productMap.values()).sort((a, b) => b.profit - a.profit);
  const filteredProducts = dynamicFavoriteProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  // Get top 20 selling products names to check their stock
  const top20ProductNames = dynamicFavoriteProducts.slice(0, 20).map(p => p.name);
  const lowStockAlerts = inventoryItems.filter(item => 
    top20ProductNames.includes(item.name) && 
    (item.status === 'Low Stock' || item.status === 'Out of Stock' || item.stock < 10)
  );

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
      
      {/* Low Stock Alert */}
      {lowStockAlerts.length > 0 && (
        <motion.div 
          layout
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={(e) => { e.stopPropagation(); setIsAlertMinimized(!isAlertMinimized); }}
          className={`cursor-pointer border shadow-sm relative overflow-hidden transition-colors ${
            isAlertMinimized 
              ? 'bg-red-50 border-red-200 hover:bg-red-100 p-3 rounded-2xl flex flex-row items-center gap-3 self-start w-auto' 
              : 'bg-red-50 border-red-200 p-6 flex flex-col gap-2 rounded-3xl w-full'
          }`}
        >
          {isAlertMinimized ? (
            <>
              <DangerTriangle className="w-5 h-5 text-red-600" />
              <span className="text-red-700 font-bold text-sm tracking-wide">
                {lowStockAlerts.length} items low on stock
              </span>
            </>
          ) : (
            <>
              <div className="absolute -right-6 -top-6 text-red-500/10">
                <DangerTriangle className="w-48 h-48" />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2 text-red-700 font-extrabold mb-1">
                  <DangerTriangle className="w-7 h-7" />
                  <h3 className="text-xl font-outfit">Critical Stock Alert</h3>
                </div>
                <span className="text-xs font-semibold text-red-500 px-3 py-1 bg-white rounded-lg border border-red-100">Click to minimize</span>
              </div>
              <p className="text-red-600/90 text-sm font-medium relative z-10 max-w-3xl">
                Some of your <span className="font-bold underline decoration-red-300 underline-offset-2">top 20 best-selling products</span> are running critically low or are completely out of stock! Restock these immediately to avoid missing out on potential sales:
              </p>
              <div className="flex flex-wrap gap-2 mt-3 relative z-10">
                {lowStockAlerts.map(item => (
                  <span key={item.id} className="bg-white border border-red-100 text-red-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-shadow">
                    {item.name} 
                    <span className={`px-2 py-0.5 rounded-md mx-1 ${item.stock === 0 ? 'bg-red-500 text-white' : 'bg-orange-100 text-orange-800'}`}>
                      {item.stock} left
                    </span>
                  </span>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
        <StatCard 
          title="Available Cash" 
          value={formatPHP(availableCash)} 
          unit="" 
          growth={formatPHP(Math.abs(availableCashGrowth.amount))} 
          percentage={`${Math.abs(availableCashGrowth.percentage).toFixed(1)}%`} 
          isPositive={availableCashGrowth.isPositive} 
          icon={<WadOfMoney className="w-8 h-8 text-emerald-500" />} 
          onClick={() => setShowAverageFor(showAverageFor === 'Available Cash' ? null : 'Available Cash')}
          showAverage={showAverageFor === 'Available Cash'}
          averageValue={formatPHP(availableCashAvg)}
          averageLabel={avgLabel}
          description="The sum of Value of Business and Used Capital. Represents total theoretical cash value if business was liquidated."
        />
        <StatCard 
          title="Value of Business" 
          value={formatPHP(valueOfBusiness)} 
          unit="" 
          growth={formatPHP(Math.abs(valueOfBusinessGrowth.amount))} 
          percentage={`${Math.abs(valueOfBusinessGrowth.percentage).toFixed(1)}%`} 
          isPositive={valueOfBusinessGrowth.isPositive} 
          icon={<WadOfMoney className="w-8 h-8 text-indigo-500" />} 
          onClick={() => setShowAverageFor(showAverageFor === 'Value of Business' ? null : 'Value of Business')}
          showAverage={showAverageFor === 'Value of Business'}
          averageValue={formatPHP(valueOfBusinessAvg)}
          averageLabel={avgLabel}
          description="Net Profit minus Non-Store Expenses. Shows how much money remains after paying for external costs."
        />
        <StatCard 
          title="Net Profit" 
          value={formatPHP(netProfit)} 
          unit="" 
          growth={formatPHP(Math.abs(profitGrowth.amount))} 
          percentage={`${Math.abs(profitGrowth.percentage).toFixed(1)}%`} 
          isPositive={profitGrowth.isPositive} 
          icon={<WadOfMoney className="w-8 h-8 text-success" />} 
          onClick={() => setShowAverageFor(showAverageFor === 'Net Profit' ? null : 'Net Profit')}
          showAverage={showAverageFor === 'Net Profit'}
          averageValue={formatPHP(netProfitAvg)}
          averageLabel={avgLabel}
          description="Total Sales minus the Cost of Goods Sold. Tells you exactly how much actual money you've made."
        />
        <StatCard 
          title="Profit Margin" 
          value={`${profitMargin}%`} 
          unit="" 
          growth={`${Math.abs(profitMarginGrowth.amount)}%`} 
          percentage={`${Math.abs(profitMarginGrowth.percentage).toFixed(1)}%`} 
          isPositive={profitMarginGrowth.isPositive} 
          icon={<GraphUp className="w-8 h-8 text-purple-500" />} 
          onClick={() => setShowAverageFor(showAverageFor === 'Profit Margin' ? null : 'Profit Margin')}
          showAverage={showAverageFor === 'Profit Margin'}
          averageValue={`${profitMargin}%`}
          averageLabel="overall (this period)"
          description="The percentage of Net Profit generated from the Used Capital. Measures how efficiently your capital is generating profit."
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
          onClick={() => setShowAverageFor(showAverageFor === 'Total Sales' ? null : 'Total Sales')}
          showAverage={showAverageFor === 'Total Sales'}
          averageValue={formatPHP(totalSalesAvg)}
          averageLabel={avgLabel}
          description="The total amount of money collected from all items sold before any costs or expenses are deducted."
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
          onClick={() => setShowUnpaidBreakdown(true)}
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

      {/* Main Content Sections */}
      <div className="flex flex-col gap-6">
        
        {/* Chart Section */}
        {showGraph && (
        <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center justify-start gap-4 mb-8">
            <h3 className="text-lg flex items-center gap-2 flex-grow">
              <span className="w-2 h-2 rounded-full bg-primary-500"></span>
              Performance Graph
            </h3>
            
            <div className="px-4 py-2 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-600 font-medium">
              {datePeriod}
            </div>

            <select 
              value={graphMetric}
              onChange={(e) => setGraphMetric(e.target.value as any)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary-100 cursor-pointer shadow-sm hover:bg-gray-50 transition-colors"
            >
              <option value="Sales">Sales Amount</option>
              <option value="Net Profit">Net Profit</option>
              <option value="Profit Margin">Profit Margin</option>
              <option value="Value of Business">Value of Business</option>
              <option value="Available Cash">Available Cash</option>
            </select>
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
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000000', fontWeight: 'bold' }} tickFormatter={(value) => graphMetric === 'Profit Margin' ? `${value.toLocaleString()}%` : `₱${value.toLocaleString()}`} dx={-10} width={80} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }} 
                  formatter={(value: any) => [graphMetric === 'Profit Margin' ? `${Number(value).toFixed(1)}%` : formatPHP(Number(value)), graphMetric]}
                />
                <Bar dataKey="total" fill="url(#colorTotal)" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
             <div className="flex flex-col gap-1 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
               <span className="text-gray-500 text-sm">{graphAmountLabel}</span>
               <div className="flex items-baseline gap-2">
                 <span className="text-2xl font-medium">{formatGraphValue(currentGraphTotalValue)}</span>
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
                   {isPositiveGrowth ? '+ ' : '- '}{formatGraphValue(Math.abs(growthAmount))}
                 </span>
               </div>
             </div>
          </div>
        </div>
        )}

        {/* Favorite Products */}
        <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col overflow-hidden">
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
          
          <div className="w-full overflow-x-auto hide-scrollbar">
            <div className="min-w-[900px]">
              {/* Header row using Grid */}
              <div className="grid grid-cols-10 gap-2 items-center text-xs sm:text-sm font-bold text-gray-600 uppercase tracking-wider mb-4 px-3 pb-3 border-b border-gray-100">
                <span className="col-span-1 text-center">Img</span>
                <span className="col-span-2 text-left">Product Name</span>
                <span className="col-span-1 text-center">Items</span>
                <span className="col-span-1 text-center">Avg Items</span>
                <span className="col-span-1 text-right">Sales</span>
                <span className="col-span-1 text-right">Avg Sales</span>
                <span className="col-span-1 text-right">Profit</span>
                <span className="col-span-1 text-right">Avg Profit</span>
                <span className="col-span-1 text-center"></span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 max-h-[320px] pr-1">
                {filteredProducts.length > 0 ? filteredProducts.map((product) => (
                  <div key={product.id} className="grid grid-cols-10 gap-2 items-center bg-white p-2 rounded-2xl border border-transparent hover:border-gray-50 hover:bg-gray-50/50 hover:shadow-sm transition-all group">
                    
                    {/* Image */}
                    <div className="col-span-1 flex justify-center">
                      <img src={product.image} alt={product.name} className="w-8 h-8 rounded-xl object-cover bg-gray-100 flex-shrink-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]" />
                    </div>
                    
                    {/* Name and Category */}
                    <div className="col-span-2 text-left min-w-0 pr-1 shrink">
                      <h4 className="text-sm font-medium text-text-main truncate" title={product.name}>{product.name}</h4>
                      <span className="text-[10px] text-primary-500 font-semibold tracking-wide truncate block uppercase">{product.category}</span>
                    </div>
                    
                    {/* Orders */}
                    <div className="col-span-1 text-center text-[12px] font-medium text-gray-600">
                      <span className="bg-gray-100 px-2 py-0.5 rounded-md">{product.orders}</span>
                    </div>
                    
                    {/* Avg Orders */}
                    <div className="col-span-1 text-center text-[12px] font-medium text-orange-500 truncate" title={`${product.avgOrders.toFixed(1)} per ${avgLabel.split(' ')[0]}`}>
                      {product.avgOrders.toFixed(1)}{avgSymbol}
                    </div>
                    
                    {/* Sales */}
                    <div className="col-span-1 text-right text-[12px] font-bold text-primary-600 truncate" title={formatPHP(product.sales)}>
                      {formatPHP(product.sales)}
                    </div>
                    
                    {/* Avg Sales */}
                    <div className="col-span-1 text-right text-[12px] font-medium text-blue-400 truncate" title={`${formatPHP(product.avgSales)} per ${avgLabel.split(' ')[0]}`}>
                      {formatPHP(product.avgSales)}{avgSymbol}
                    </div>
                    
                    {/* Profit */}
                    <div className="col-span-1 text-right text-[12px] font-bold text-success truncate" title={formatPHP(product.profit)}>
                      {formatPHP(product.profit)}
                    </div>

                    {/* Avg Profit */}
                    <div className="col-span-1 text-right text-[12px] font-medium text-indigo-500 truncate" title={`${formatPHP(product.avgProfit)} per ${avgLabel.split(' ')[0]}`}>
                      {formatPHP(product.avgProfit)}{avgSymbol}
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

      </div>

      {/* All Orders Table */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
           <div className="flex items-center gap-4">
             <h3 className="text-lg flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-primary-500"></span>
               All Orders
             </h3>
             {selectedOrdersToUndo.length > 0 && (
               <button 
                 onClick={() => {
                   setTransactionsToUndo(selectedOrdersToUndo);
                   setShowUndoModal(true);
                 }}
                 className="px-3 py-1.5 bg-danger text-white rounded-xl text-sm font-medium hover:bg-danger/90 transition-colors shadow-sm flex items-center gap-1.5"
               >
                 Undo Selected ({selectedOrdersToUndo.length})
               </button>
             )}
           </div>
           
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
                <th className="pb-4 pt-4 pl-4 w-12 text-center">
                  <input 
                    type="checkbox"
                    checked={filteredTransactions.length > 0 && selectedOrdersToUndo.length === filteredTransactions.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedOrdersToUndo(filteredTransactions.map((t: any) => t.id));
                      else setSelectedOrdersToUndo([]);
                    }}
                    className="w-4 h-4 text-primary-500 rounded border-gray-300 focus:ring-primary-500"
                  />
                </th>
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
                  <td className="py-4 pl-4">
                    <input 
                      type="checkbox" 
                      checked={selectedOrdersToUndo.includes(order.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedOrdersToUndo(prev => [...prev, order.id]);
                        else setSelectedOrdersToUndo(prev => prev.filter(id => id !== order.id));
                      }}
                      className="w-4 h-4 text-primary-500 rounded border-gray-300 focus:ring-primary-500"
                    />
                  </td>
                  <td className="py-4 relative">
                    <div className="group inline-block relative cursor-help">
                      <span className="text-gray-500 border-b border-dashed border-gray-300 pb-[1px]">
                        {order.id}
                      </span>
                      {/* Enhanced Hover Popover */}
                      <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 absolute left-[calc(100%+16px)] top-1/2 -translate-y-1/2 bg-white border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl p-4 w-64 z-[100] text-left pointer-events-none scale-95 group-hover:scale-100 origin-left">
                        {/* Tooltip Arrow */}
                        <div className="absolute w-3 h-3 bg-white border-l border-b border-gray-100 -left-[6px] top-1/2 -translate-y-1/2 rotate-45"></div>
                        
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">Items Sold</span>
                        <div className="flex flex-col gap-2.5 max-h-[200px] overflow-y-auto hide-scrollbar">
                          {order.items.map((i: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-start text-sm">
                              <span className="font-semibold text-gray-800 leading-snug pr-3">{i.product.name}</span>
                              <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg border border-primary-100 whitespace-nowrap mt-0.5">
                                {i.quantity}x
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
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
                        setTransactionsToUndo([order.id]);
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
                  <td colSpan={9} className="py-8 text-center text-gray-400">No matching orders found</td>
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
        {showUndoModal && transactionsToUndo.length > 0 && (
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
                Are you sure you want to undo {transactionsToUndo.length === 1 ? `transaction ${transactionsToUndo[0]}` : `${transactionsToUndo.length} transactions`}? This will reverse the sale and restore inventory.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowUndoModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    for (const id of transactionsToUndo) {
                      await reverseTransaction(id);
                    }
                    setTransactionsToUndo([]);
                    setSelectedOrdersToUndo([]);
                    setShowUndoModal(false);
                  }}
                  className="flex-1 py-3 bg-danger text-white rounded-2xl font-medium shadow-sm hover:shadow-md hover:bg-red-600 transition-all"
                >
                  Confirm Undo
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

      {/* Unpaid Breakdown Modal */}
      <AnimatePresence>
        {showUnpaidBreakdown && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnpaidBreakdown(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-xl relative z-10 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-red-100 p-2 rounded-xl text-red-500">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-medium text-gray-900 font-outfit">Unpaid Breakdown</h2>
                    <p className="text-sm text-gray-500 font-medium">Total: <span className="text-danger font-bold">{formatPHP(totalUnpaidAmount)}</span></p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowUnpaidBreakdown(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <CloseCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-6">
                {totalUnpaidAmount === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>No unpaid amounts for the selected period.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(
                      statCardTransactions
                        .filter(t => t.total > t.amount_paid)
                        .reduce((acc, t) => {
                          const unpaid = t.total - t.amount_paid;
                          acc[t.customer] = (acc[t.customer] || 0) + unpaid;
                          return acc;
                        }, {} as Record<string, number>)
                    )
                    .sort((a, b) => b[1] - a[1])
                    .map(([customer, amount]) => (
                      <div key={customer} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 hover:border-red-200 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 font-bold flex items-center justify-center text-sm shadow-sm">
                            {customer.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900 group-hover:text-red-700 transition-colors">{customer}</span>
                        </div>
                        <span className="font-bold text-danger text-lg">{formatPHP(amount)}</span>
                      </div>
                    ))}
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

function StatCard({ title, value, unit, growth, percentage, isPositive, icon, isSmall = false, onClick, showAverage, averageValue, averageLabel, description }: any) {
  const isNegativeValue = typeof value === 'string' && value.includes('-');

  return (
    <div 
      className={`bg-white rounded-3xl ${isSmall ? 'p-4' : 'p-6'} shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow relative group ${onClick ? 'cursor-pointer hover:bg-gray-50/50' : 'cursor-default'} h-full`}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <div className={`flex items-start justify-between ${isSmall ? 'mb-2' : 'mb-4'}`}>
        <div className={`flex items-center gap-3`}>
          <span className="text-gray-400">{icon}</span>
          {!isSmall && <h4 className="text-gray-600 text-sm font-medium">{title}</h4>}
        </div>
        
        {/* Growth Bubble */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
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
            className="absolute left-0 right-0 top-[105%] bg-white rounded-3xl border border-primary-200 p-5 shadow-2xl z-50 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
             <p className="text-xs text-primary-600 font-bold tracking-widest uppercase text-center mb-2">
               Average
             </p>
             <p className={`${isSmall ? 'text-lg' : 'text-xl'} text-gray-900 font-bold text-center bg-gray-50 py-3 rounded-2xl mb-3`}>
               {averageValue} <span className="text-sm font-medium text-gray-500">/ {averageLabel}</span>
             </p>
             {description && (
               <p className="text-sm text-gray-600 text-center leading-relaxed font-medium bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                 {description}
               </p>
             )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
