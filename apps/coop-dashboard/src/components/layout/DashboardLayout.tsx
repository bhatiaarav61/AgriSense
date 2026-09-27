'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Leaf,
  TrendingUp,
  AlertTriangle,
  MapPin,
  Calendar,
  Download,
  Settings,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { StatsCards } from './StatsCards';
import { DiseaseOutbreaks } from './DiseaseOutbreaks';
import { YieldPredictions } from './YieldPredictions';
import { WeatherWidget } from './WeatherWidget';
import { FarmerActivity } from './FarmerActivity';

export function DashboardContent() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'diseases' | 'yield' | 'farmers' | 'settings'>('overview');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'diseases' && <DiseasesTab />}
          {activeTab === 'yield' && <YieldTab />}
          {activeTab === 'farmers' && <FarmersTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard Overview</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor your cooperative's crop health and yield predictions</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button className="btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Disease Outbreaks */}
        <DiseaseOutbreaks />

        {/* Yield Predictions */}
        <YieldPredictions />
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weather */}
        <WeatherWidget />

        {/* Farmer Activity */}
        <FarmerActivity />
      </div>
    </div>
  );
}

function DiseasesTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Disease Monitoring</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track disease outbreaks across your cooperative</p>
        </div>
        <button className="btn-primary">
          <AlertTriangle className="w-4 h-4 mr-2" />
          Report New Case
        </button>
      </div>

      <DiseaseOutbreaks detailed />
    </div>
  );
}

function YieldTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Yield Predictions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">AI-powered yield forecasts for your fields</p>
        </div>
        <button className="btn-primary">
          <TrendingUp className="w-4 h-4 mr-2" />
          Generate Prediction
        </button>
      </div>

      <YieldPredictions detailed />
    </div>
  );
}

function FarmersTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Farmer Network</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and monitor your cooperative members</p>
        </div>
        <button className="btn-primary">
          <Users className="w-4 h-4 mr-2" />
          Add Farmer
        </button>
      </div>

      <FarmerActivity detailed />
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure your cooperative dashboard</p>
      </div>

      <div className="card p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Cooperative Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Cooperative Name</label>
              <input type="text" className="input" defaultValue="Green Valley Cooperative" />
            </div>
            <div>
              <label className="label">Region</label>
              <select className="input">
                <option>India - Punjab</option>
                <option>India - Maharashtra</option>
                <option>Kenya - Rift Valley</option>
                <option>Brazil - Mato Grosso</option>
              </select>
            </div>
            <div>
              <label className="label">Primary Contact</label>
              <input type="text" className="input" defaultValue="Rajesh Kumar" />
            </div>
            <div>
              <label className="label">Contact Email</label>
              <input type="email" className="input" defaultValue="contact@greenvalley.coop" />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Crops Monitored</h2>
          <div className="flex flex-wrap gap-2">
            {['Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane'].map(crop => (
              <span key={crop} className="badge badge-info">{crop}</span>
            ))}
          </div>
          <button className="btn-outline mt-3">
            <span className="w-4 h-4 mr-2">+</span>
            Add Crop
          </button>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Notification Preferences</h2>
          <div className="space-y-3">
            {[
              { label: 'Disease outbreak alerts', desc: 'Get notified when diseases are detected in your region' },
              { label: 'Yield prediction updates', desc: 'Receive weekly yield forecast updates' },
              { label: 'Weather advisories', desc: 'Get weather-based farming recommendations' },
              { label: 'Weekly summary report', desc: 'Receive a weekly summary of all activities' },
            ].map((item, i) => (
              <label key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                </div>
                <input type="checkbox" className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500" defaultChecked />
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-6">
          <button className="btn-secondary">Cancel</button>
          <button className="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  );
}