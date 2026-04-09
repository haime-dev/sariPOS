import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Sales from './pages/Sales';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Inventory from './pages/Inventory';
import History from './pages/History';
import Expenses from './pages/Expenses';
import { useAuth } from './contexts/AuthContext';

// Protected Route Wrapper
const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fff7ed] via-[#ffedd5] to-[#f97316]/10 flex items-center justify-center relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[120px] translate-x-1/3 translate-y-1/3 pointer-events-none" />
        
        <div className="w-8 h-8 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin z-10" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <Outlet />;
};

function App() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          
          <Route path="/sales" element={<Sales />} />
          
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/history" element={<History />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/settings" element={<div className="p-6 bg-white rounded-2xl shadow-sm">Settings coming soon</div>} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
