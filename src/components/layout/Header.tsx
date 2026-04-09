import { useEffect, useState } from 'react';
import { Calendar, ClockCircle, Power } from '@solar-icons/react';
import { useLocation } from 'react-router-dom';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({}: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = time.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const isSales = location.pathname === '/sales';

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-transparent">
      <div className="flex items-center gap-4">
        {/* Hamburger menu removed as requested */}

        {!isSales && (
          <h1 className="text-xl font-medium text-white ml-2 capitalize">
            {location.pathname.substring(1) || 'Dashboard'}
          </h1>
        )}

        <div className="hidden md:flex items-center gap-4 ml-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl shadow-sm text-sm text-text-main">
            <Calendar className="w-4 h-4 text-primary-500" />
            {formattedDate}
          </div>
          <span className="text-gray-300">-</span>
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl shadow-sm text-sm text-text-main">
            <ClockCircle className="w-4 h-4 text-primary-500" />
            {formattedTime}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isSales && (
          <button className="flex items-center gap-2 bg-white/80 hover:bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-danger/10 text-danger transition-colors text-sm cursor-pointer">
            <span className="w-2 h-2 rounded-full bg-danger"></span>
            Close Order
            <Power className="w-4 h-4 ml-1" />
          </button>
        )}
      </div>
    </header>
  );
}
