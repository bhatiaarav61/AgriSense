'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, CircleMarker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Leaf, TrendingUp, AlertTriangle, Sun, Cloud, Droplets, Wind, Thermometer } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet marker icons
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface FieldData {
  id: string;
  name: string;
  crop: string;
  variety: string;
  area: number;
  coordinates: [number, number][];
  center: [number, number];
  yield: {
    predicted: number;
    actual?: number;
    confidence: number;
  };
  soilHealth: {
    ph: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    organicMatter: number;
  };
  irrigation: {
    lastIrrigated: string;
    nextScheduled: string;
    method: string;
    waterUsed: number;
  };
  diseases: Array<{
    name: string;
    severity: 'high' | 'medium' | 'low';
    detectedDate: string;
  }>;
  satelliteData: {
    ndvi: number;
    evi: number;
    lastImageDate: string;
  };
}

interface FieldMapProps {
  fields: FieldData[];
  selectedFieldId?: string;
  onFieldSelect: (field: FieldData | null) => void;
  viewMode: 'yield' | 'soil' | 'irrigation' | 'diseases' | 'satellite' | 'default';
  height?: number;
}

const mockFields: FieldData[] = [
  {
    id: 'F-001',
    name: 'North Field A-1',
    crop: 'Rice',
    variety: 'PR-126',
    area: 12.5,
    coordinates: [
      [30.9010, 75.8573],
      [30.9010, 75.8620],
      [30.8960, 75.8620],
      [30.8960, 75.8573],
    ],
    center: [30.8985, 75.8596],
    yield: { predicted: 4.8, actual: 4.6, confidence: 87 },
    soilHealth: { ph: 6.8, nitrogen: 280, phosphorus: 45, potassium: 180, organicMatter: 2.1 },
    irrigation: { lastIrrigated: '2024-01-10', nextScheduled: '2024-01-18', method: 'Drip', waterUsed: 450 },
    diseases: [
      { name: 'Bacterial Leaf Blight', severity: 'low', detectedDate: '2024-01-12' },
    ],
    satelliteData: { ndvi: 0.72, evi: 0.58, lastImageDate: '2024-01-14' },
  },
  {
    id: 'F-002',
    name: 'East Field B-3',
    crop: 'Wheat',
    variety: 'HD-3086',
    area: 8.2,
    coordinates: [
      [30.9050, 75.8630],
      [30.9050, 75.8680],
      [30.9000, 75.8680],
      [30.9000, 75.8630],
    ],
    center: [30.9025, 75.8655],
    yield: { predicted: 3.9, actual: 3.7, confidence: 82 },
    soilHealth: { ph: 7.2, nitrogen: 320, phosphorus: 38, potassium: 210, organicMatter: 1.8 },
    irrigation: { lastIrrigated: '2024-01-12', nextScheduled: '2024-01-20', method: 'Sprinkler', waterUsed: 380 },
    diseases: [
      { name: 'Yellow Rust', severity: 'medium', detectedDate: '2024-01-10' },
    ],
    satelliteData: { ndvi: 0.65, evi: 0.52, lastImageDate: '2024-01-13' },
  },
  {
    id: 'F-003',
    name: 'South Field C-2',
    crop: 'Maize',
    variety: 'DKC-9188',
    area: 15.0,
    coordinates: [
      [30.8920, 75.8580],
      [30.8920, 75.8640],
      [30.8860, 75.8640],
      [30.8860, 75.8580],
    ],
    center: [30.8890, 75.8610],
    yield: { predicted: 5.2, actual: 5.0, confidence: 79 },
    soilHealth: { ph: 6.5, nitrogen: 250, phosphorus: 52, potassium: 195, organicMatter: 2.4 },
    irrigation: { lastIrrigated: '2024-01-08', nextScheduled: '2024-01-16', method: 'Flood', waterUsed: 620 },
    diseases: [
      { name: 'Fall Armyworm', severity: 'high', detectedDate: '2024-01-11' },
    ],
    satelliteData: { ndvi: 0.78, evi: 0.64, lastImageDate: '2024-01-14' },
  },
  {
    id: 'F-004',
    name: 'West Field D-1',
    crop: 'Cotton',
    variety: 'Bt Cotton',
    area: 10.0,
    coordinates: [
      [30.8940, 75.8520],
      [30.8940, 75.8570],
      [30.8890, 75.8570],
      [30.8890, 75.8520],
    ],
    center: [30.8915, 75.8545],
    yield: { predicted: 1.8, actual: 1.7, confidence: 75 },
    soilHealth: { ph: 7.5, nitrogen: 300, phosphorus: 42, potassium: 220, organicMatter: 1.5 },
    irrigation: { lastIrrigated: '2024-01-14', nextScheduled: '2024-01-22', method: 'Drip', waterUsed: 340 },
    diseases: [
      { name: 'Cotton Leaf Curl Virus', severity: 'medium', detectedDate: '2024-01-09' },
    ],
    satelliteData: { ndvi: 0.58, evi: 0.45, lastImageDate: '2024-01-12' },
  },
];

const cropColors: Record<string, string> = {
  Rice: '#10B981',
  Wheat: '#F59E0B',
  Maize: '#8B5CF6',
  Cotton: '#EC4899',
  Sugarcane: '#06B6D4',
};

const severityColors = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

function getYieldColor(predicted: number, actual?: number) {
  if (!actual) return cropColors.Rice;
  const ratio = actual / predicted;
  if (ratio >= 0.95) return '#10B981';
  if (ratio >= 0.85) return '#F59E0B';
  return '#EF4444';
}

function getSoilHealthColor(value: number, type: string) {
  const thresholds: Record<string, { good: number; fair: number }> = {
    ph: { good: 7.0, fair: 6.0 },
    nitrogen: { good: 300, fair: 200 },
    phosphorus: { good: 50, fair: 30 },
    potassium: { good: 200, fair: 150 },
    organicMatter: { good: 2.5, fair: 1.5 },
  };
  const t = thresholds[type];
  if (value >= t.good) return '#10B981';
  if (value >= t.fair) return '#F59E0B';
  return '#EF4444';
}

function getNDVIColor(ndvi: number) {
  if (ndvi >= 0.7) return '#10B981';
  if (ndvi >= 0.5) return '#84CC16';
  if (ndvi >= 0.3) return '#F59E0B';
  if (ndvi >= 0.1) return '#F97316';
  return '#EF4444';
}

function FieldPolygon({ field, isSelected, viewMode, onClick }: { field: FieldData; isSelected: boolean; viewMode: string; onClick: () => void }) {
  let fillColor = cropColors[field.crop] || '#6B7280';
  let fillOpacity = 0.4;
  let tooltipContent = `${field.name} - ${field.crop} (${field.area} ha)`;

  switch (viewMode) {
    case 'yield':
      fillColor = getYieldColor(field.yield.predicted, field.yield.actual);
      tooltipContent = `${field.name}: Predicted ${field.yield.predicted} t/ha, Actual ${field.yield.actual || 'N/A'} t/ha (${field.yield.confidence}% confidence)`;
      break;
    case 'soil':
      const phColor = getSoilHealthColor(field.soilHealth.ph, 'ph');
      fillColor = phColor;
      tooltipContent = `${field.name}: pH ${field.soilHealth.ph}, N:${field.soilHealth.nitrogen} P:${field.soilHealth.phosphorus} K:${field.soilHealth.potassium}`;
      break;
    case 'irrigation':
      fillColor = field.irrigation.method === 'Drip' ? '#06B6D4' : field.irrigation.method === 'Sprinkler' ? '#3B82F6' : '#6366F1';
      tooltipContent = `${field.name}: ${field.irrigation.method}, Last: ${field.irrigation.lastIrrigated}, Next: ${field.irrigation.nextScheduled}`;
      break;
    case 'diseases':
      const maxSeverity = field.diseases.reduce((max, d) =>
        (d.severity === 'high' ? 3 : d.severity === 'medium' ? 2 : 1) > max ? (d.severity === 'high' ? 3 : d.severity === 'medium' ? 2 : 1) : max, 0);
      fillColor = maxSeverity === 3 ? '#EF4444' : maxSeverity === 2 ? '#F59E0B' : '#10B981';
      tooltipContent = `${field.name}: ${field.diseases.map(d => `${d.name} (${d.severity})`).join(', ')}`;
      break;
    case 'satellite':
      fillColor = getNDVIColor(field.satelliteData.ndvi);
      tooltipContent = `${field.name}: NDVI ${field.satelliteData.ndvi.toFixed(2)}, EVI ${field.satelliteData.evi.toFixed(2)} (${field.satelliteData.lastImageDate})`;
      break;
  }

  return (
    <Polygon
      positions={field.coordinates}
      pathOptions={{
        color: isSelected ? '#1E40AF' : fillColor,
        fillColor,
        fillOpacity,
        weight: isSelected ? 3 : 2,
        dashArray: isSelected ? '5, 5' : undefined,
      }}
      onClick={onClick}
    >
      <Popup position={field.center}>
        <div className="p-2 min-w-[200px]">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{field.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{field.crop} - {field.variety}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Area: {field.area} ha</p>
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="mt-2 text-xs text-primary-600 hover:underline"
          >
            View Details
          </button>
        </div>
      </Popup>
    </Polygon>
  );
}

function DiseaseMarkers({ fields }: { fields: FieldData[] }) {
  const markers = fields.flatMap(field =>
    field.diseases.map((disease, idx) => ({
      ...disease,
      fieldId: field.id,
      fieldName: field.name,
      position: [
        field.center[0] + (Math.random() - 0.5) * 0.005,
        field.center[1] + (Math.random() - 0.5) * 0.005,
      ] as [number, number],
    }))
  );

  return (
    <>
      {markers.map((disease, idx) => (
        <Marker key={`${disease.fieldId}-${idx}`} position={disease.position}>
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{disease.name}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Field: {disease.fieldName}</p>
              <span className={cn('badge px-2 py-1',
                disease.severity === 'high' && 'bg-red-100 text-red-800',
                disease.severity === 'medium' && 'bg-amber-100 text-amber-800',
                disease.severity === 'low' && 'bg-green-100 text-green-800'
              )}>
                {disease.severity.charAt(0).toUpperCase() + disease.severity.slice(1)}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Detected: {disease.detectedDate}</p>
            </div>
          </Popup>
          <CircleMarker
            center={disease.position}
            radius={disease.severity === 'high' ? 12 : disease.severity === 'medium' ? 8 : 5}
            pathOptions={{
              color: severityColors[disease.severity],
              fillColor: severityColors[disease.severity],
              fillOpacity: 0.8,
              weight: 2,
            }}
          />
        </Marker>
      ))}
    </>
  );
}

function Legend({ viewMode }: { viewMode: string }) {
  if (viewMode === 'default') return null;

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
      <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2 capitalize">{viewMode} Legend</h4>
      {viewMode === 'yield' && (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-600" /> ≥95% of predicted</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500" /> 85-95% of predicted</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500" /> <85% of predicted</div>
        </div>
      )}
      {viewMode === 'soil' && (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-600" /> Optimal</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500" /> Adequate</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500" /> Deficient</div>
        </div>
      )}
      {viewMode === 'irrigation' && (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-cyan-500" /> Drip</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500" /> Sprinkler</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-indigo-500" /> Flood</div>
        </div>
      )}
      {viewMode === 'diseases' && (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500" /> High</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500" /> Medium</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-500" /> Low</div>
        </div>
      )}
      {viewMode === 'satellite' && (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-600" /> NDVI ≥0.7</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-lime-500" /> NDVI 0.5-0.7</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500" /> NDVI 0.3-0.5</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-orange-500" /> NDVI 0.1-0.3</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500" /> NDVI <0.1</div>
        </div>
      )}
    </div>
  );
}

export function FieldMap({
  fields = mockFields,
  selectedFieldId,
  onFieldSelect,
  viewMode = 'default',
  height = 500
}: FieldMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>([30.895, 75.858]);
  const [zoom, setZoom] = useState(13);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height }}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
        onViewportChanged={(e) => {
          setMapCenter(e.center);
          setZoom(e.zoom);
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {fields.map((field) => (
          <FieldPolygon
            key={field.id}
            field={field}
            isSelected={selectedFieldId === field.id}
            viewMode={viewMode}
            onClick={() => onFieldSelect(field)}
          />
        ))}

        {(viewMode === 'diseases' || viewMode === 'default') && (
          <DiseaseMarkers fields={fields} />
        )}

        <Legend viewMode={viewMode} />
      </MapContainer>

      {/* View Mode Indicator */}
      <div className="absolute top-4 right-4 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700">
        <select
          value={viewMode}
          onChange={(e) => {
            // Parent handles view mode change
          }}
          className="text-xs px-2 py-1 bg-transparent border-0 focus:outline-none text-gray-700 dark:text-gray-300 cursor-pointer"
        >
          <option value="default">Overview</option>
          <option value="yield">Yield Predictions</option>
          <option value="soil">Soil Health</option>
          <option value="irrigation">Irrigation</option>
          <option value="diseases">Diseases</option>
          <option value="satellite">Satellite (NDVI)</option>
        </select>
      </div>
    </div>
  );
}

// Heatmap layer for disease outbreaks
interface DiseaseHeatmapData {
  lat: number;
  lng: number;
  intensity: number;
  disease: string;
  severity: 'high' | 'medium' | 'low';
  cases: number;
}

export function DiseaseHeatmap({
  data = mockHeatmapData,
  height = 500
}: {
  data?: DiseaseHeatmapData[];
  height?: number;
}) {
  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height }}>
      <MapContainer center={[30.895, 75.858]} zoom={11} scrollWheelZoom={true} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Heatmap circles */}
        {data.map((point, idx) => (
          <CircleMarker
            key={idx}
            center={[point.lat, point.lng]}
            radius={Math.max(10, point.intensity * 30)}
            pathOptions={{
              color: point.severity === 'high' ? '#EF4444' : point.severity === 'medium' ? '#F59E0B' : '#10B981',
              fillColor: point.severity === 'high' ? '#EF4444' : point.severity === 'medium' ? '#F59E0B' : '#10B981',
              fillOpacity: 0.15 + point.intensity * 0.3,
              weight: 1,
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">{point.disease}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Cases: {point.cases}</p>
                <span className={cn('badge px-2 py-1',
                  point.severity === 'high' && 'bg-red-100 text-red-800',
                  point.severity === 'medium' && 'bg-amber-100 text-amber-800',
                  point.severity === 'low' && 'bg-green-100 text-green-800'
                )}>
                  {point.severity.charAt(0).toUpperCase() + point.severity.slice(1)} Risk
                </span>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

const mockHeatmapData: DiseaseHeatmapData[] = [
  { lat: 30.895, lng: 75.858, intensity: 0.9, disease: 'Bacterial Leaf Blight', severity: 'high', cases: 12 },
  { lat: 30.910, lng: 75.870, intensity: 0.7, disease: 'Yellow Rust', severity: 'medium', cases: 8 },
  { lat: 30.880, lng: 75.850, intensity: 0.95, disease: 'Fall Armyworm', severity: 'high', cases: 15 },
  { lat: 30.920, lng: 75.840, intensity: 0.5, disease: 'Late Blight', severity: 'low', cases: 5 },
  { lat: 30.870, lng: 75.880, intensity: 0.6, disease: 'Cotton Leaf Curl Virus', severity: 'medium', cases: 10 },
];