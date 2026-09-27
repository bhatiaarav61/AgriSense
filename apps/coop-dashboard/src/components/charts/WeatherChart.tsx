'use client';

import React from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, Wind, Droplets, Thermometer, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherWidgetProps {}

const weatherIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Clear sky': Sun,
  'Mainly clear': Sun,
  'Partly cloudy': Cloud,
  'Overcast': Cloud,
  'Rain': CloudRain,
  'Drizzle': CloudRain,
  'Thunderstorm': CloudRain,
  'Snow': CloudSnow,
  'Fog': Cloud,
};

const mockWeather = {
  current: {
    temperature: 24,
    condition: 'Partly cloudy',
    humidity: 65,
    windSpeed: 12,
    precipitation: 0,
    feelsLike: 26,
  },
  forecast: [
    { date: '2024-01-16', min: 18, max: 28, condition: 'Sunny', precipitation: 0, humidity: 55 },
    { date: '2024-01-17', min: 19, max: 29, condition: 'Partly cloudy', precipitation: 10, humidity: 60 },
    { date: '2024-01-18', min: 20, max: 27, condition: 'Light rain', precipitation: 60, humidity: 75 },
    { date: '2024-01-19', min: 17, max: 25, condition: 'Moderate rain', precipitation: 80, humidity: 85 },
    { date: '2024-01-20', min: 16, max: 24, condition: 'Cloudy', precipitation: 20, humidity: 70 },
    { date: '2024-01-21', min: 15, max: 26, condition: 'Sunny', precipitation: 0, humidity: 50 },
    { date: '2024-01-22', min: 16, max: 28, condition: 'Partly cloudy', precipitation: 10, humidity: 55 },
  ],
};

function formatDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

function getWeatherIcon(condition: string) {
  const Icon = weatherIcons[condition] || Cloud;
  return <Icon className="w-6 h-6" />;
}

export function WeatherWidget() {
  return (
    <div className="card p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Weather Forecast</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">7-day forecast for your region</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Updated now</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Punjab, India</p>
        </div>
      </div>

      {/* Current Weather */}
      <div className="flex items-center gap-4 lg:gap-6 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
        <div className="w-20 h-20 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <Sun className="w-10 h-10 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">{mockWeather.current.temperature}°</span>
            <span className="text-lg text-gray-500 dark:text-gray-400">C</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 capitalize">{mockWeather.current.condition}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Feels like {mockWeather.current.feelsLike}°C</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{mockWeather.current.humidity}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end gap-1">
              <Droplets className="w-3 h-3" /> Humidity
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{mockWeather.current.windSpeed}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end gap-1">
              <Wind className="w-3 h-3" /> km/h
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{mockWeather.current.precipitation}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end gap-1">
              <CloudRain className="w-3 h-3" /> Rain
            </p>
          </div>
        </div>
      </div>

      {/* 7-Day Forecast */}
      <div className="space-y-2">
        {mockWeather.forecast.map((day, index) => (
          <div
            key={day.date}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg transition-colors',
              index === 0 ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
            )}
          >
            <div className="flex items-center gap-3 min-w-[100px]">
              <span className={cn('text-sm font-medium', index === 0 ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-gray-100')}>
                {index === 0 ? 'Today' : formatDay(day.date)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                {getWeatherIcon(day.condition)}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <Thermometer className="w-4 h-4" />
                <span>{day.max}° / {day.min}°</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <Droplets className="w-4 h-4" />
                <span>{day.humidity}%</span>
              </div>
              <div className={cn('flex items-center gap-1', day.precipitation > 50 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400')}>
                <CloudRain className="w-4 h-4" />
                <span>{day.precipitation}%</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <Wind className="w-4 h-4" />
                <span>{8 + index * 2} km/h</span>
              </div>
            </div>

            <div className="text-right min-w-[80px]">
              <p className="text-xs text-gray-500 dark:text-gray-400">Precipitation</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{day.precipitation}%</p>
            </div>
          </div>
        ))}

        {/* Agriculture Advisory */}
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Thermometer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-900 dark:text-amber-100">Farming Advisory</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Light rain expected on Jan 18-19. Consider postponing fertilizer application.
                Good window for harvesting on Jan 16-17.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}