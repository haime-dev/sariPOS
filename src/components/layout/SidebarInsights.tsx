import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DangerTriangle, WalletMoney, LightbulbMinimalistic, Rocket, GraphDown, Stars, CloseCircle, ChartSquare, Wallet } from '@solar-icons/react';
import { useTransactionStore } from '../../store/useTransactionStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useExpenseStore } from '../../store/useExpenseStore';

// Format currency as PHP
const formatPHP = (amount: number) => {
  if (amount >= 1000) {
    return `₱${(amount / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export default function SidebarInsights() {
  const { transactions } = useTransactionStore();
  const { items: inventoryItems } = useInventoryStore();
  const { expenses } = useExpenseStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Compute metrics based on 30-day period (Monthly)
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(thirtyDaysAgo);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 30);

  const currentPeriodTransactions = transactions.filter(t => new Date(t.date) >= thirtyDaysAgo);
  const previousPeriodTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo;
  });

  const totalSales = currentPeriodTransactions.reduce((sum, t) => sum + (t.customer === 'Family Expense' ? 0 : t.amount_paid), 0);
  const totalCapital = currentPeriodTransactions.reduce((sum, t) => {
    let ratioPaid = t.total > 0 ? t.amount_paid / t.total : 1;
    return sum + t.items.reduce((itemSum, item) => {
      const isExpense = t.customer === 'Family Expense' || (item.product.price === 0 && item.quantity > 0);
      const origPrice = item.product.original_price_at_time ?? item.product.original_price ?? 0;
      const effectiveRatioPaid = isExpense ? 1 : ratioPaid;
      return itemSum + (origPrice * item.quantity * effectiveRatioPaid);
    }, 0);
  }, 0);
  
  const netProfit = totalSales - totalCapital;
  const profitMargin = totalCapital > 0 ? Math.round((netProfit / totalCapital) * 100) : 0;

  const prevTotalSales = previousPeriodTransactions.reduce((sum, t) => sum + (t.customer === 'Family Expense' ? 0 : t.amount_paid), 0);
  const salesGrowth = {
    percentage: prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : (totalSales > 0 ? 100 : 0),
    isPositive: totalSales >= prevTotalSales
  };

  const totalUnpaidAmount = transactions.reduce((sum, t) => sum + (t.customer === 'Family Expense' ? 0 : (t.total - t.amount_paid)), 0);

  // All Time metrics for Value of Business and Expenses
  const allTimeSales = transactions.reduce((sum, t) => sum + (t.customer === 'Family Expense' ? 0 : t.amount_paid), 0);
  const allTimeCapital = transactions.reduce((sum, t) => {
    let ratioPaid = t.total > 0 ? t.amount_paid / t.total : 1;
    return sum + t.items.reduce((itemSum, item) => {
      const isExpense = t.customer === 'Family Expense' || (item.product.price === 0 && item.quantity > 0);
      const origPrice = item.product.original_price_at_time ?? item.product.original_price ?? 0;
      const effectiveRatioPaid = isExpense ? 1 : ratioPaid;
      return itemSum + (origPrice * item.quantity * effectiveRatioPaid);
    }, 0);
  }, 0);
  const allTimeNetProfit = allTimeSales - allTimeCapital;
  
  const allTimeNonStoreExpenses = expenses
    .filter(e => e.category !== 'Store Use')
    .reduce((sum, e) => sum + e.amount, 0);
    
  const allTimeValueOfBusiness = allTimeNetProfit - allTimeNonStoreExpenses;
  const allTimeProfitMargin = allTimeCapital > 0 ? Math.round((allTimeNetProfit / allTimeCapital) * 100) : 0;
  
  const currentMonthExpenses = expenses.filter(e => {
    if (e.category === 'Store Use') return false;
    return new Date(e.date) >= thirtyDaysAgo;
  }).reduce((sum, e) => sum + e.amount, 0);

  const prevMonthExpenses = expenses.filter(e => {
    if (e.category === 'Store Use') return false;
    const d = new Date(e.date);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo;
  }).reduce((sum, e) => sum + e.amount, 0);

  
  // Get top selling product names for low stock alerts (simplified)
  const productSales = new Map<string, number>();
  transactions.forEach(t => {
    t.items.forEach(item => {
      productSales.set(item.product.name, (productSales.get(item.product.name) || 0) + item.quantity);
    });
  });
  const topProductNames = Array.from(productSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(entry => entry[0]);

  const lowStockAlerts = inventoryItems.filter(item => 
    topProductNames.includes(item.name) && 
    (item.status === 'Low Stock' || item.status === 'Out of Stock' || item.stock < 10)
  );

  // Build Insights array
  const insights = [];

  if (transactions.length === 0) {
    insights.push({
      id: 'empty',
      type: 'info',
      icon: <Stars className="w-5 h-5 text-indigo-500" />,
      title: 'Welcome!',
      message: "Start recording transactions to see insights."
    });
  } else {
    if (lowStockAlerts.length > 0) {
      insights.push({
        id: 'low-stock',
        type: 'warning',
        icon: <DangerTriangle className="w-5 h-5 text-red-500" />,
        title: 'Low Stock',
        message: `${lowStockAlerts.length} top items need restocking!`
      });
    }

    if (totalUnpaidAmount > 0) {
      insights.push({
        id: 'unpaid',
        type: 'warning',
        icon: <WalletMoney className="w-5 h-5 text-orange-500" />,
        title: 'Unpaid Debts',
        message: `Collect ${formatPHP(totalUnpaidAmount)} to boost cash!`
      });
    }

    if (profitMargin < 20 && totalCapital > 0) {
      insights.push({
        id: 'margin',
        type: 'info',
        icon: <LightbulbMinimalistic className="w-5 h-5 text-blue-500" />,
        title: 'Margin Tip',
        message: `Margin is ${profitMargin}%. Consider adjusting prices.`
      });
    }

    if (salesGrowth.isPositive && salesGrowth.percentage > 5) {
      insights.push({
        id: 'growth-pos',
        type: 'success',
        icon: <Rocket className="w-5 h-5 text-emerald-500" />,
        title: 'Great Job!',
        message: `Sales grew by ${salesGrowth.percentage.toFixed(0)}% this month.`
      });
    } else if (!salesGrowth.isPositive && prevTotalSales > 0) {
      insights.push({
        id: 'growth-neg',
        type: 'info',
        icon: <GraphDown className="w-5 h-5 text-purple-500" />,
        title: 'Sales Down',
        message: `Sales dropped ${Math.abs(salesGrowth.percentage).toFixed(0)}%. Try a promo!`
      });
    }

    if (allTimeValueOfBusiness > 0) {
      insights.push({
        id: 'value',
        type: 'success',
        icon: <ChartSquare className="w-5 h-5 text-indigo-500" />,
        title: 'Business Value',
        message: `Your business is valued at ${formatPHP(allTimeValueOfBusiness)}. Awesome!`
      });
    }

    if (allTimeProfitMargin >= 20) {
      insights.push({
        id: 'all-margin',
        type: 'success',
        icon: <LightbulbMinimalistic className="w-5 h-5 text-blue-500" />,
        title: 'Overall Margin',
        message: `Your all-time profit margin is a healthy ${allTimeProfitMargin}%.`
      });
    }

    if (currentMonthExpenses > prevMonthExpenses && currentMonthExpenses > 0) {
      insights.push({
        id: 'high-expenses',
        type: 'warning',
        icon: <Wallet className="w-5 h-5 text-orange-500" />,
        title: 'Rising Expenses',
        message: `Expenses are up by ${formatPHP(currentMonthExpenses - prevMonthExpenses)} this month. Keep an eye on costs!`
      });
    } else if (currentMonthExpenses < prevMonthExpenses && prevMonthExpenses > 0) {
      insights.push({
        id: 'low-expenses',
        type: 'success',
        icon: <Wallet className="w-5 h-5 text-emerald-500" />,
        title: 'Expenses Down',
        message: `Great! Expenses are down by ${formatPHP(prevMonthExpenses - currentMonthExpenses)} this month.`
      });
    }
  }

  // Auto-rotate insights every 5 seconds if not hovered
  useEffect(() => {
    if (insights.length <= 1 || isHovered) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % insights.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [insights.length, isHovered]);

  if (insights.length === 0) return null;

  const currentInsight = insights[currentIndex];

  return (
    <>
      <div 
        className="w-full relative mb-2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          onClick={() => setShowAll(true)}
          className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-sm rounded-2xl p-3 overflow-hidden cursor-pointer transition-shadow hover:shadow-md h-24 flex items-center relative"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentInsight.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3 w-full"
            >
              <div className={`p-2 rounded-xl shrink-0 ${
                currentInsight.type === 'warning' ? 'bg-orange-100/80' :
                currentInsight.type === 'success' ? 'bg-emerald-100/80' :
                'bg-indigo-100/80'
              }`}>
                {currentInsight.icon}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="text-xs font-bold text-gray-800 mb-0.5 truncate">{currentInsight.title}</h4>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 leading-tight">
                  {currentInsight.message}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Indicators for multiple insights */}
          {insights.length > 1 && (
            <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
              {insights.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-3 bg-primary-400' : 'w-1 bg-gray-200'}`} 
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pop-up Overlay for All Insights */}
      <AnimatePresence>
        {showAll && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-[60] backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed bottom-6 left-6 md:bottom-12 md:left-72 z-[70] w-[calc(100vw-3rem)] md:w-[400px] bg-white/95 backdrop-blur-xl border border-white shadow-2xl rounded-3xl p-6 overflow-hidden flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Financial Insights</h3>
                <button 
                  onClick={() => setShowAll(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <CloseCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-3">
                {insights.map(insight => (
                  <div key={insight.id} className="bg-gray-50/80 border border-gray-100 p-4 rounded-2xl flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      insight.type === 'warning' ? 'bg-orange-100' :
                      insight.type === 'success' ? 'bg-emerald-100' :
                      'bg-indigo-100'
                    }`}>
                      {insight.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-800 mb-1">{insight.title}</h4>
                      <p className="text-xs font-medium text-gray-600 leading-relaxed">
                        {insight.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
