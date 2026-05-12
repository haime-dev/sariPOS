
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Widget, Cart, Box, Wallet, Settings, CloseCircle, Logout, DocumentText } from '@solar-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import SidebarInsights from './SidebarInsights';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Widget, color: 'text-blue-500', bg: 'bg-blue-50', activeColor: 'text-blue-600' },
  { path: '/sales', label: 'Sales', icon: Cart, color: 'text-emerald-500', bg: 'bg-emerald-50', activeColor: 'text-emerald-600' },
  { path: '/inventory', label: 'Inventory', icon: Box, color: 'text-orange-500', bg: 'bg-orange-50', activeColor: 'text-orange-600' },
  { path: '/history', label: 'History', icon: DocumentText, color: 'text-purple-500', bg: 'bg-purple-50', activeColor: 'text-purple-600' },
  { path: '/expenses', label: 'Expenses', icon: Wallet, color: 'text-rose-500', bg: 'bg-rose-50', activeColor: 'text-rose-600' },
  { path: '/settings', label: 'Settings', icon: Settings, color: 'text-slate-500', bg: 'bg-slate-50', activeColor: 'text-slate-600' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const [showToc, setShowToc] = useState(false);

  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/';

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShowToc(false);
      if (window.innerWidth < 768) {
        onClose();
      }
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
        flex items-center
      `}>
        <div className="w-full h-full flex flex-col py-6">
          <div className="px-6 flex items-center justify-between mb-8">
            <h2 className="text-2xl font-medium text-primary-600 tracking-tight">SariPOS</h2>
            <button 
              onClick={onClose}
              className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full"
            >
              <CloseCircle className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => window.innerWidth < 768 && onClose()}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-300 group
                    ${isActive 
                      ? `${item.bg} ${item.activeColor} font-bold shadow-sm` 
                      : 'text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <div className={`p-1.5 rounded-xl transform transition-transform duration-300 group-hover:scale-125 ${isActive ? 'bg-white shadow-sm ' + item.activeColor : 'text-gray-400 group-hover:' + item.bg + ' group-hover:' + item.color}`}>
                        {/* @ts-ignore */}
                        <Icon className="w-5 h-5" variant={isActive ? "Bold" : "Outline"} />
                      </div>
                      {item.label}
                    </>
                  )}
                </NavLink>
              );
            })}
            {isDashboard && (
              <div className="px-4 mt-2 mb-2">
                <button
                  onClick={() => setShowToc(true)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-primary-50 text-primary-600 rounded-2xl transition-all duration-300 hover:bg-primary-100 font-bold shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    Jump to Section
                  </div>
                </button>
              </div>
            )}
          </nav>

          <div className="mt-auto px-4 pb-4">
            <SidebarInsights />
            <button
              onClick={signOut}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all duration-200 mt-2"
            >
              <Logout className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Table of Contents Modal for Sidebar */}
      <AnimatePresence>
        {showToc && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowToc(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[65]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-72 bg-white/95 backdrop-blur-xl border border-white shadow-2xl rounded-3xl p-6 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Sections</h3>
                <button 
                  onClick={() => setShowToc(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <CloseCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => scrollToSection('low-stock-alert')} className="text-left px-4 py-2 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                  Critical Stock Alert
                </button>
                <button onClick={() => scrollToSection('summary-stats')} className="text-left px-4 py-2 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  Summary Stats
                </button>
                <button onClick={() => scrollToSection('secondary-stats')} className="text-left px-4 py-2 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                  Secondary Stats
                </button>
                <button onClick={() => scrollToSection('performance-graph')} className="text-left px-4 py-2 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                  Performance Graph
                </button>
                <button onClick={() => scrollToSection('top-selling-products')} className="text-left px-4 py-2 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0"></span>
                  Top Selling Products
                </button>
                <button onClick={() => scrollToSection('all-orders')} className="text-left px-4 py-2 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0"></span>
                  All Orders
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
