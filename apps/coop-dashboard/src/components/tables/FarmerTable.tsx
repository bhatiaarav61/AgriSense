'use client';

import React from 'react';
import { Users, Leaf, MapPin, TrendingUp, Clock, AlertCircle, CheckCircle, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FarmerActivityProps {
  detailed?: boolean;
}

const mockFarmers = [
  {
    id: '1',
    name: 'Rajesh Kumar',
    village: 'Ludhiana',
    crop: 'Rice',
    fieldSize: 12.5,
    lastScan: '2 hours ago',
    scansThisWeek: 3,
    alerts: 1,
    status: 'active' as const,
  },
  {
    id: '2',
    name: 'Priya Sharma',
    village: 'Amritsar',
    crop: 'Wheat',
    fieldSize: 8.2,
    lastScan: '1 day ago',
    scansThisWeek: 2,
    alerts: 0,
    status: 'active' as const,
  },
  {
    id: '3',
    name: 'Amit Singh',
    village: 'Jalandhar',
    crop: 'Maize',
    fieldSize: 15.0,
    lastScan: '3 hours ago',
    scansThisWeek: 5,
    alerts: 2,
    status: 'alert' as const,
  },
  {
    id: '4',
    name: 'Sunita Devi',
    village: 'Patiala',
    crop: 'Cotton',
    fieldSize: 10.0,
    lastScan: '5 days ago',
    scansThisWeek: 0,
    alerts: 0,
    status: 'inactive' as const,
  },
  {
    id: '5',
    name: 'Harpreet Singh',
    village: 'Bathinda',
    crop: 'Rice',
    fieldSize: 20.0,
    lastScan: '30 min ago',
    scansThisWeek: 4,
    alerts: 0,
    status: 'active' as const,
  },
];

const statusStyles = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  alert: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const statusIcons = {
  active: CheckCircle,
  alert: AlertCircle,
  inactive: Clock,
};

function getCropIcon(crop: string) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    Rice: Leaf,
    Wheat: Leaf,
    Maize: Leaf,
    Cotton: Leaf,
    Sugarcane: Leaf,
  };
  return icons[crop] || Leaf;
}

export function FarmerActivity({ detailed = false }: FarmerActivityProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredFarmers = mockFarmers.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.village.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.crop.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!detailed) {
    // Overview version - just show summary stats
    const activeCount = mockFarmers.filter(f => f.status === 'active').length;
    const alertCount = mockFarmers.filter(f => f.status === 'alert').length;
    const inactiveCount = mockFarmers.filter(f => f.status === 'inactive').length;
    const totalScans = mockFarmers.reduce((sum, f) => sum + f.scansThisWeek, 0);

    return (
      <div className="card p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Farmer Activity</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{mockFarmers.length} registered farmers</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatItem label="Active" value={activeCount} icon={Users} color="text-green-600" bg="bg-green-100 dark:bg-green-900/30" />
          <StatItem label="Alerts" value={alertCount} icon={AlertCircle} color="text-red-600" bg="bg-red-100 dark:bg-red-900/30" />
          <StatItem label="Inactive" value={inactiveCount} icon={Clock} color="text-gray-600" bg="bg-gray-100 dark:bg-gray-700" />
          <StatItem label="Scans/Week" value={totalScans} icon={Leaf} color="text-primary-600" bg="bg-primary-100 dark:bg-primary-900/30" />
        </div>

        <div className="space-y-2">
          {mockFarmers.slice(0, 3).map((farmer) => (
            <FarmerRow key={farmer.id} farmer={farmer} compact />
          ))}
        </div>

        <div className="mt-4 text-center">
          <button className="text-primary-600 dark:text-primary-400 font-medium hover:underline text-sm">
            View All Farmers →
          </button>
        </div>
      </div>
    );
  }

  // Detailed version
  return (
    <div className="card overflow-hidden">
      <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Farmer Network</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{mockFarmers.length} registered farmers</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search farmers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-sm w-64 pl-10"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button className="btn-primary btn-sm">
              <Users className="w-4 h-4 mr-1" />
              Add Farmer
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatItem label="Active Farmers" value={mockFarmers.filter(f => f.status === 'active').length} icon={Users} color="text-green-600" bg="bg-green-100 dark:bg-green-900/30" />
          <StatItem label="With Alerts" value={mockFarmers.filter(f => f.status === 'alert').length} icon={AlertCircle} color="text-red-600" bg="bg-red-100 dark:bg-red-900/30" />
          <StatItem label="Inactive >7d" value={mockFarmers.filter(f => f.status === 'inactive').length} icon={Clock} color="text-gray-600" bg="bg-gray-100 dark:bg-gray-700" />
          <StatItem label="Total Scans/Week" value={mockFarmers.reduce((sum, f) => sum + f.scansThisWeek, 0)} icon={Leaf} color="text-primary-600" bg="bg-primary-100 dark:bg-primary-900/30" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Farmer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Crop</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Field (ha)</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Scan</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scans/Week</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alerts</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredFarmers.map((farmer) => (
              <tr key={farmer.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                        {farmer.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{farmer.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="w-3.5 h-3.5" />
                    {farmer.village}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <CropBadge crop={farmer.crop} />
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">{farmer.fieldSize}</td>
                <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{farmer.lastScan}</td>
                <td className="px-4 py-3 text-center">
                  <span className="badge badge-info">{farmer.scansThisWeek}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {farmer.alerts > 0 ? (
                    <span className="badge badge-error">{farmer.alerts}</span>
                  ) : (
                    <span className="badge badge-success">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={farmer.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredFarmers.length === 0 && (
        <div className="p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No farmers found matching your search</p>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, icon: Icon, color, bg }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }) {
  return (
    <div className={cn('p-3 rounded-xl', bg)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
        <Icon className={cn('w-6 h-6', color)} />
      </div>
    </div>
  );
}

function CropBadge({ crop }: { crop: string }) {
  const colors: Record<string, string> = {
    Rice: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    Wheat: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    Maize: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    Cotton: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    Sugarcane: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  };
  const Icon = getCropIcon(crop);
  return (
    <span className={cn('badge flex items-center gap-1', colors[crop] || 'bg-gray-100 text-gray-800')}>
      <Icon className="w-3 h-3" />
      {crop}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const Icon = statusIcons[status as keyof typeof statusIcons] || Clock;
  return (
    <span className={cn('badge flex items-center gap-1', statusStyles[status as keyof typeof statusStyles])}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function FarmerRow({ farmer, compact }: { farmer: typeof mockFarmers[0]; compact?: boolean }) {
  const Icon = statusIcons[farmer.status];

  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
            {farmer.name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{farmer.name}</p>
          {!compact && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{farmer.village} • {farmer.crop}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!compact && (
          <CropBadge crop={farmer.crop} />
        )}
        <span className={cn('badge flex items-center gap-1', statusStyles[farmer.status])}>
          <Icon className="w-3 h-3" />
          {farmer.status === 'active' ? 'Active' : farmer.status === 'alert' ? 'Alert' : 'Inactive'}
        </span>
      </div>
    </div>
  );
}