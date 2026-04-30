
import { NavLink } from 'react-router-dom';
import { Widget, Cart, Box, Wallet, Settings, CloseCircle, Logout, DocumentText } from '@solar-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import SidebarInsights from './SidebarInsights';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Widget },
  { path: '/sales', label: 'Sales', icon: Cart },
  { path: '/inventory', label: 'Inventory', icon: Box },
  { path: '/history', label: 'History', icon: DocumentText },
  { path: '/expenses', label: 'Expenses', icon: Wallet },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { signOut } = useAuth();

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
                    flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300
                    ${isActive 
                      ? 'bg-primary-50 text-primary-600 font-bold shadow-sm' 
                      : 'text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  {({ isActive }) => (
                    <>
                      {/* @ts-ignore */}
                      <Icon className="w-6 h-6" variant={isActive ? "Bold" : "Outline"} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              );
            })}
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
    </>
  );
}
