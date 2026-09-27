'use client';

import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Users, Leaf, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
}

function StatCard({ title, value, change, changeLabel, icon: Icon, iconColor, bgColor }: StatCardProps) {
  const isPositive = change && change > 0;

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <span className={cn(
                'text-sm font-medium',
                isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}>
                {isPositive ? <TrendingUp className="w-4 h-4 inline" /> : <TrendingDown className="w-4 h-4 inline" />}
                {Math.abs(change)}%
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{changeLabel || 'vs last period'}</span>
            </div>
          )}
        </div>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', bgColor)}>
          <Icon className={cn('w-6 h-6', iconColor)} />
        </div>
      </div>
    </div>
  );
}

export function StatsCards() {
  const stats = [
    {
      title: 'Active Farmers',
      value: '1,234',
      change: 12,
      changeLabel: 'vs last month',
      icon: Users,
      iconColor: 'text-primary-600',
      bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    },
    {
      title: 'Fields Monitored',
      value: '3,456',
      change: 8,
      changeLabel: 'vs last month',
      icon: Leaf,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: 'Disease Alerts',
      value: '23',
      change: -5,
      changeLabel: 'vs last week',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      title: 'Avg Yield Forecast',
      value: '4.2 t/ha',
      change: 3,
      changeLabel: 'vs last season',
      icon: TrendingUp,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}