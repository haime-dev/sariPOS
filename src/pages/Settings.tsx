import { motion } from 'framer-motion';
import { Bell, BellOff, Settings as SettingsIcon } from '@solar-icons/react';
import { useSettingsStore } from '../store/useSettingsStore';

export default function Settings() {
  const { soundEnabled, toggleSound } = useSettingsStore();

  return (
    <div className="h-full flex flex-col gap-6 relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-outfit">Settings</h1>
          <p className="text-gray-200 text-sm mt-1">Manage your application preferences</p>
        </div>
      </div>

      {/* Main Content Area */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 overflow-hidden flex flex-col p-6"
      >
        <div className="max-w-2xl w-full mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary-100 p-3 rounded-2xl text-primary-500">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 font-outfit">General Preferences</h2>
          </div>

          <div className="bg-white/80 rounded-2xl border border-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${soundEnabled ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-100 text-gray-400'} transition-colors`}>
                  {soundEnabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">App Sounds</h3>
                  <p className="text-sm text-gray-500">Enable interactive sound effects for actions like checkout, delete, and payment updates.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={soundEnabled}
                  onChange={toggleSound}
                />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
