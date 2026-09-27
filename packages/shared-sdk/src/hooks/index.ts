/**
 * React Hooks for AgriSense SDK
 * Requires React as peer dependency
 */

import { useState, useCallback, useEffect } from 'react';
import {
  detectDisease,
  predictYield,
  getAdvisory,
  getWeather,
  getCrops,
  getDiseases,
  healthCheck,
  DiseaseResult,
  YieldPrediction,
  Advisory,
  WeatherData,
  Crop,
  Disease,
  DetectRequest,
  PredictYieldRequest,
  AdvisoryRequest,
  WeatherRequest,
  AgriSenseError,
} from './api';

// Generic async state hook
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: AgriSenseError | null;
}

function useAsyncState<T>(): [AsyncState<T>, (promise: Promise<T>) => Promise<T>] {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (promise: Promise<T>): Promise<T> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await promise;
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      const agriError = error instanceof AgriSenseError ? error : new AgriSenseError(
        (error as Error).message || 'Unknown error',
        500
      );
      setState({ data: null, loading: false, error: agriError });
      throw agriError;
    }
  }, []);

  return [state, execute];
}

/**
 * Hook for disease detection
 */
export function useDiseaseDetection() {
  const [state, execute] = useAsyncState<DiseaseResult>();

  const detect = useCallback(async (request: DetectRequest) => {
    return execute(detectDisease(request));
  }, [execute]);

  return { ...state, detect };
}

/**
 * Hook for yield prediction
 */
export function useYieldPrediction() {
  const [state, execute] = useAsyncState<YieldPrediction>();

  const predict = useCallback(async (request: PredictYieldRequest) => {
    return execute(predictYield(request));
  }, [execute]);

  return { ...state, predict };
}

/**
 * Hook for advisory
 */
export function useAdvisory() {
  const [state, execute] = useAsyncState<Advisory>();

  const fetch = useCallback(async (request: AdvisoryRequest) => {
    return execute(getAdvisory(request));
  }, [execute]);

  return { ...state, fetch };
}

/**
 * Hook for weather data
 */
export function useWeather() {
  const [state, execute] = useAsyncState<WeatherData>();

  const fetch = useCallback(async (request: WeatherRequest) => {
    return execute(getWeather(request));
  }, [execute]);

  return { ...state, fetch };
}

/**
 * Hook for crops list
 */
export function useCrops(regionId: string | null) {
  const [state, execute] = useAsyncState<Crop[]>();

  useEffect(() => {
    if (regionId) {
      execute(getCrops(regionId));
    }
  }, [regionId, execute]);

  const refetch = useCallback(async () => {
    if (regionId) {
      return execute(getCrops(regionId));
    }
  }, [regionId, execute]);

  return { ...state, refetch };
}

/**
 * Hook for diseases list
 */
export function useDiseases(regionId: string | null, cropId?: string) {
  const [state, execute] = useAsyncState<Disease[]>();

  useEffect(() => {
    if (regionId) {
      execute(getDiseases(regionId, cropId));
    }
  }, [regionId, cropId, execute]);

  const refetch = useCallback(async () => {
    if (regionId) {
      return execute(getDiseases(regionId, cropId));
    }
  }, [regionId, cropId, execute]);

  return { ...state, refetch };
}

/**
 * Hook for health check
 */
export function useHealthCheck() {
  const [state, execute] = useAsyncState<{
    status: string;
    timestamp: string;
    version: string;
    regions: string[];
  }>();

  const check = useCallback(async () => {
    return execute(healthCheck());
  }, [execute]);

  // Auto-check on mount
  useEffect(() => {
    check();
  }, [check]);

  return { ...state, check };
}

/**
 * Combined hook for farmer app - disease detection flow
 */
export function useFarmerFlow(regionId: string, cropId: string) {
  const disease = useDiseaseDetection();
  const advisory = useAdvisory();
  const crops = useCrops(regionId);
  const diseases = useDiseases(regionId, cropId);

  const detectAndAdvise = useCallback(async (image: File | Blob | string, location?: { lat: number; lon: number }) => {
    // Detect disease
    const detection = await disease.detect({
      image,
      crop_id: cropId,
      region_id: regionId,
      location,
    });

    // Get advisory for detected disease
    if (detection.disease_id !== 'unknown') {
      await advisory.fetch({
        disease_id: detection.disease_id,
        crop_id: cropId,
        region_id: regionId,
        severity: detection.confidence > 0.8 ? 'high' : detection.confidence > 0.5 ? 'medium' : 'low',
      });
    }

    return { detection, advisory: advisory.data };
  }, [disease, advisory, regionId, cropId]);

  return {
    disease,
    advisory,
    crops,
    diseases,
    detectAndAdvise,
  };
}

/**
 * Combined hook for coop dashboard - yield prediction flow
 */
export function useCoopFlow(regionId: string) {
  const yieldPrediction = useYieldPrediction();
  const weather = useWeather();
  const crops = useCrops(regionId);

  const predictWithWeather = useCallback(async (request: PredictYieldRequest) => {
    // Get weather data first
    await weather.fetch({ lat: request.location.lat, lon: request.location.lon, days: 30 });

    // Predict yield
    const prediction = await yieldPrediction.predict(request);

    return { prediction, weather: weather.data };
  }, [yieldPrediction, weather]);

  return {
    yieldPrediction,
    weather,
    crops,
    predictWithWeather,
  };
}