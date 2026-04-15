import { Package, Terminal, Moon, Sun } from 'lucide-react';

export default function Header({ 
  isConnected, 
  showInventoryView, 
  onToggleInventory,
  theme,
  onToggleTheme
}: { 
  isConnected: boolean, 
  showInventoryView: boolean, 
  onToggleInventory: () => void,
  theme: string,
  onToggleTheme: () => void
}) {
  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-6 flex-shrink-0 theme-container">
      <div className="flex items-center gap-2.5 font-bold text-xl text-[#4F46E5]">
        <div className="w-8 h-8 bg-[#4F46E5] rounded-md flex items-center justify-center text-white">
          <Package size={20} />
        </div>
        InventoryFlow
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleTheme}
          className="p-2 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#1E293B] transition-colors theme-container"
          title="Toggle Dark Mode"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <button 
          onClick={onToggleInventory}
          className="px-4 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#1E293B] rounded-lg font-semibold text-sm transition-colors theme-container"
        >
          {showInventoryView ? "Back to Scanner" : "View Inventory"}
        </button>
        
        <div className="flex items-center gap-3 text-sm border-l border-[#E2E8F0] pl-4">
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5",
            isConnected ? "bg-[#DCFCE7] text-[#166534]" : "bg-red-100 text-red-700"
          )}>
            <span className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-[#10B981]" : "bg-red-500"
            )}></span>
            {isConnected ? "Supabase Connected" : "Disconnected"}
          </div>
          <span className="opacity-20 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-2">
            <Terminal size={16} className="text-[#64748B]" />
            <strong className="text-[#1E293B]">Admin Terminal 01</strong>
          </div>
        </div>
      </div>
    </header>
  );
}

import { cn } from '@/src/lib/utils';
