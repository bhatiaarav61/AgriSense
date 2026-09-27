'use client';

import React from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  TrendingUp,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Leaf,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'diseases', label: 'Diseases', icon: AlertTriangle },
  { id: 'yield', label: 'Yield', icon: TrendingUp },
  { id: 'farmers', label: 'Farmers', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ open, onClose, activeTab, onTabChange }: SidebarProps) {
  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out',
          open ? 'w-64' : 'w-20'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700', !open && 'justify-center')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            {open && (
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">AgriSense</span>
            )}
          </div>
          {open && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full text-left',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                  !open && 'justify-center px-2'
                )}
                title={open ? undefined : item.label}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {open && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={cn('p-3 border-t border-gray-200 dark:border-gray-700', !open && 'hidden')}>
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            AgriSense v1.0.0
          </div>
        </div>
      </aside>

      {/* Collapsed sidebar toggle for desktop */}
      {!open && (
        <button
          onClick={onClose}
          className="fixed lg:static left-20 top-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      )}
    </>
  );
}