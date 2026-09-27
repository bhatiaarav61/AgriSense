'use client';

import React from 'react';
import { AlertTriangle, MapPin, Calendar, ChevronDown, ChevronUp, Eye, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiseaseOutbreaksProps {
  detailed?: boolean;
}

const mockOutbreaks = [
  {
    id: '1',
    disease: 'Bacterial Leaf Blight',
    crop: 'Rice',
    region: 'Punjab - Ludhiana',
    severity: 'high' as const,
    detected: '2024-01-15',
    farmers: 12,
    area: 45.2,
    status: 'active' as const,
  },
  {
    id: '2',
    disease: 'Yellow Rust',
    crop: 'Wheat',
    region: 'Punjab - Amritsar',
    severity: 'medium' as const,
    detected: '2024-01-12',
    farmers: 8,
    area: 28.5,
    status: 'contained' as const,
  },
  {
    id: '3',
    disease: 'Fall Armyworm',
    crop: 'Maize',
    region: 'Maharashtra - Nashik',
    severity: 'high' as const,
    detected: '2024-01-10',
    farmers: 15,
    area: 62.0,
    status: 'active' as const,
  },
  {
    id: '4',
    disease: 'Late Blight',
    crop: 'Potato',
    region: 'Punjab - Jalandhar',
    severity: 'low' as const,
    detected: '2024-01-08',
    farmers: 5,
    area: 12.3,
    status: 'monitoring' as const,
  },
  {
    id: '5',
    disease: 'Cotton Leaf Curl Virus',
    crop: 'Cotton',
    region: 'Maharashtra - Nagpur',
    severity: 'medium' as const,
    detected: '2024-01-05',
    farmers: 10,
    area: 35.7,
    status: 'active' as const,
  },
];

const severityStyles = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const statusStyles = {
  active: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  contained: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  monitoring: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DiseaseOutbreaks({ detailed = false }: DiseaseOutbreaksProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'detected', direction: 'desc' });

  const sortedOutbreaks = [...mockOutbreaks].sort((a, b) => {
    const aVal = a[sortConfig.key as keyof typeof a];
    const bVal = b[sortConfig.key as keyof typeof b];
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SeverityBadge = ({ severity }: { severity: string }) => (
    <span className={cn('badge px-2 py-1 text-xs', severityStyles[severity as keyof typeof severityStyles])}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );

  const StatusBadge = ({ status }: { status: string }) => (
    <span className={cn('badge px-2 py-1 text-xs', statusStyles[status as keyof typeof statusStyles])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );

  const SortableHeader = ({ children, key }: { children: React.ReactNode; key: string }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
      onClick={() => handleSort(key)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortConfig.key === key && (
          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  );

  return (
    <div className="card overflow-hidden">
      <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {detailed ? 'Disease Outbreaks' : 'Recent Disease Outbreaks'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {mockOutbreaks.length} {detailed ? 'outbreaks tracked' : 'recent cases'}
            </p>
          </div>
          {detailed && (
            <div className="flex items-center gap-2">
              <button className="btn-outline btn-sm">
                <Download className="w-4 h-4 mr-1" />
                Export
              </button>
            </div>
          )}
        </div>

        {detailed && (
          <div className="flex flex-wrap gap-2 mb-4">
            <select className="input input-sm w-auto" defaultValue="all">
              <option value="all">All Severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="input input-sm w-auto" defaultValue="all">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="contained">Contained</option>
              <option value="monitoring">Monitoring</option>
            </select>
            <input
              type="text"
              placeholder="Search outbreaks..."
              className="input input-sm w-48"
            />
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <SortableHeader key="disease">Disease</SortableHeader>
              <SortableHeader key="crop">Crop</SortableHeader>
              <SortableHeader key="region">Region</SortableHeader>
              <SortableHeader key="severity">Severity</SortableHeader>
              <SortableHeader key="detected">Detected</SortableHeader>
              {detailed && (
                <>
                  <SortableHeader key="farmers">Farmers</SortableHeader>
                  <SortableHeader key="area">Area (ha)</SortableHeader>
                </>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedOutbreaks.map((outbreak) => (
              <React.Fragment key={outbreak.id}>
                <tr
                  className={cn(
                    'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
                    expandedId === outbreak.id && 'bg-primary-50 dark:bg-primary-900/20'
                  )}
                  onClick={() => setExpandedId(expandedId === outbreak.id ? null : outbreak.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{outbreak.disease}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge badge-info">{outbreak.crop}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-3.5 h-3.5" />
                      {outbreak.region}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={outbreak.severity} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(outbreak.detected)}
                    </div>
                  </td>
                  {detailed && (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{outbreak.farmers}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{outbreak.area}</td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    <StatusBadge status={outbreak.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {detailed && (
                        <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="View details">
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {expandedId === outbreak.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </td>
                </tr>

                {/* Expanded Row */}
                {expandedId === outbreak.id && detailed && (
                  <tr className="bg-primary-50 dark:bg-primary-900/20">
                    <td colSpan={9} className="px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Affected Farmers</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{outbreak.farmers}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Affected Area</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{outbreak.area} ha</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Detection Source</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Mobile App Scan</p>
                        </div>
                        <div className="md:col-span-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recommended Actions</p>
                          <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                            <li>Immediate field inspection for affected farmers</li>
                            <li>Apply recommended treatment within 48 hours</li>
                            <li>Set up monitoring traps in surrounding fields</li>
                            <li>Coordinate with district agricultural office</li>
                          </ul>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {!detailed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <button className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
            View All Outbreaks →
          </button>
        </div>
      )}
    </div>
  );
}