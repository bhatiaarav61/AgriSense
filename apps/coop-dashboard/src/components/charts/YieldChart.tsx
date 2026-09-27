'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Calendar, Download, ChevronDown, ChevronUp, Eye, BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { cn } from '@/lib/utils';

interface YieldPredictionsProps {
  detailed?: boolean;
}

const mockPredictions = [
  {
    id: '1',
    field: 'Field A-1',
    crop: 'Rice',
    variety: 'PR-126',
    season: 'Kharif 2024',
    area: 12.5,
    predicted: 4.8,
    min: 4.2,
    max: 5.4,
    confidence: 87,
    lastUpdated: '2024-01-15',
    trend: 'up' as const,
    history: [
      { week: 'W1', actual: 4.1, predicted: 4.2 },
      { week: 'W2', actual: 4.3, predicted: 4.3 },
      { week: 'W3', actual: 4.5, predicted: 4.4 },
      { week: 'W4', actual: 4.6, predicted: 4.5 },
      { week: 'W5', actual: 4.7, predicted: 4.6 },
      { week: 'W6', actual: 4.8, predicted: 4.7 },
    ],
  },
  {
    id: '2',
    field: 'Field B-3',
    crop: 'Wheat',
    variety: 'HD-3086',
    season: 'Rabi 2023-24',
    area: 8.2,
    predicted: 3.9,
    min: 3.5,
    max: 4.3,
    confidence: 82,
    lastUpdated: '2024-01-14',
    trend: 'stable' as const,
    history: [
      { week: 'W1', actual: 3.6, predicted: 3.7 },
      { week: 'W2', actual: 3.7, predicted: 3.8 },
      { week: 'W3', actual: 3.8, predicted: 3.8 },
      { week: 'W4', actual: 3.9, predicted: 3.9 },
    ],
  },
  {
    id: '3',
    field: 'Field C-2',
    crop: 'Maize',
    variety: 'DKC-9188',
    season: 'Kharif 2024',
    area: 15.0,
    predicted: 5.2,
    min: 4.6,
    max: 5.8,
    confidence: 79,
    lastUpdated: '2024-01-13',
    trend: 'up' as const,
    history: [
      { week: 'W1', actual: 4.8, predicted: 4.9 },
      { week: 'W2', actual: 5.0, predicted: 5.0 },
      { week: 'W3', actual: 5.1, predicted: 5.1 },
      { week: 'W4', actual: 5.2, predicted: 5.2 },
    ],
  },
  {
    id: '4',
    field: 'Field D-1',
    crop: 'Cotton',
    variety: 'Bt Cotton',
    season: 'Kharif 2024',
    area: 10.0,
    predicted: 1.8,
    min: 1.5,
    max: 2.1,
    confidence: 75,
    lastUpdated: '2024-01-12',
    trend: 'down' as const,
    history: [
      { week: 'W1', actual: 1.9, predicted: 1.9 },
      { week: 'W2', actual: 1.8, predicted: 1.8 },
      { week: 'W3', actual: 1.8, predicted: 1.8 },
    ],
  },
];

const cropColors: Record<string, string> = {
  Rice: '#10B981',
  Wheat: '#F59E0B',
  Maize: '#8B5CF6',
  Cotton: '#EC4899',
  Sugarcane: '#06B6D4',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const color = confidence >= 80 ? '#10B981' : confidence >= 60 ? '#F59E0B' : '#EF4444';
  return (
    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${confidence}%`, backgroundColor: color }}
      />
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case 'down':
      return <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />;
    default:
      return <span className="w-4 h-4 text-gray-400">—</span>;
  }
}

export function YieldPredictions({ detailed = false }: YieldPredictionsProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [chartData, setChartData] = React.useState(mockPredictions[0].history);

  // Simple line chart for overview
  const OverviewChart = () => (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis
          dataKey="week"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          tickFormatter={(v) => `${v}t`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          formatter={(value: number) => [`${value} t/ha`, 'Yield']}
        />
        <Area
          type="monotone"
          dataKey="predicted"
          stroke="#10B981"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorYield)"
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#059669"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );

  const SortableHeader = ({ children, key, onSort }: { children: React.ReactNode; key: string; onSort: (key: string) => void }) => (
    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none">
      <div className="flex items-center gap-1" onClick={() => onSort(key)}>
        {children}
      </div>
    </th>
  );

  return (
    <div className="card overflow-hidden">
      <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {detailed ? 'Yield Predictions' : 'Yield Forecast Overview'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {mockPredictions.length} {detailed ? 'fields tracked' : 'active predictions'}
            </p>
          </div>
          {detailed && (
            <div className="flex items-center gap-2">
              <button className="btn-outline btn-sm">
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </button>
              <button className="btn-primary btn-sm">
                <BarChart3 className="w-4 h-4 mr-1" />
                New Prediction
              </button>
            </div>
          )}
        </div>

        {!detailed && (
          <OverviewChart />
        )}
      </div>

      {detailed && (
        <>
          <div className="px-4 lg:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              <select className="input input-sm w-auto" defaultValue="all">
                <option value="all">All Crops</option>
                <option value="Rice">Rice</option>
                <option value="Wheat">Wheat</option>
                <option value="Maize">Maize</option>
                <option value="Cotton">Cotton</option>
              </select>
              <select className="input input-sm w-auto" defaultValue="all">
                <option value="all">All Seasons</option>
                <option value="kharif">Kharif</option>
                <option value="rabi">Rabi</option>
              </select>
              <input
                type="text"
                placeholder="Search fields..."
                className="input input-sm w-48"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Field</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Crop</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Season</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Area (ha)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Predicted</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Range</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confidence</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trend</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {mockPredictions.map((pred) => (
                  <React.Fragment key={pred.id}>
                    <tr
                      className={cn(
                        'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
                        expandedId === pred.id && 'bg-primary-50 dark:bg-primary-900/20'
                      )}
                      onClick={() => {
                        setExpandedId(expandedId === pred.id ? null : pred.id);
                        setChartData(pred.history);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{pred.field}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{pred.variety}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge" style={{ backgroundColor: `${cropColors[pred.crop]}20`, color: cropColors[pred.crop] }}>
                          {pred.crop}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{pred.season}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">{pred.area}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{pred.predicted}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">t/ha</div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                        {pred.min} - {pred.max}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ConfidenceBar confidence={pred.confidence} />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10 text-right">
                            {pred.confidence}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TrendIcon trend={pred.trend} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="View details">
                            <Eye className="w-4 h-4" />
                          </button>
                          {expandedId === pred.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </div>
                      </td>
                    </tr>

                    {expandedId === pred.id && (
                      <tr className="bg-primary-50 dark:bg-primary-900/20">
                        <td colSpan={9} className="px-4 pb-4">
                          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Yield History & Prediction</h4>
                                <ResponsiveContainer width="100%" height={250}>
                                  <LineChart data={pred.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                                    <Tooltip
                                      contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '8px',
                                      }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="actual"
                                      stroke="#10B981"
                                      strokeWidth={2}
                                      dot={{ r: 4, strokeWidth: 2 }}
                                      name="Actual"
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="predicted"
                                      stroke="#059669"
                                      strokeWidth={2}
                                      strokeDasharray="5 5"
                                      dot={{ r: 4, strokeWidth: 2 }}
                                      name="Predicted"
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Key Drivers</h4>
                                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                  <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary-600" /> Adequate monsoon rainfall</li>
                                  <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary-600" /> Optimal temperature range</li>
                                  <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Moderate pest pressure</li>
                                  <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Soil nutrient levels</li>
                                </ul>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100 mt-4 mb-2">Risk Factors</h4>
                                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                  <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> Late season drought risk</li>
                                  <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> Potential disease outbreak</li>
                                </ul>
                              </div>
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
        </>
      )}

      {!detailed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <button className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
            View All Predictions →
          </button>
        </div>
      )}
    </div>
  );
}