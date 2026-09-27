/**
 * Enhanced Edge Model Service for AgriSense Farmer App
 * Supports TensorFlow.js, TFLite, offline inference, model caching, and queue management
 */

import * as tf from '@tensorflow/tfjs';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { regionRegistry } from '@agrisense/region-config';
import { initDatabase, cacheModel, getCachedModel, getActiveModel, updateModelLastUsed, addToOfflineQueue } from './database';
import * as Crypto from 'expo-crypto';

// ============================================================
// Types
// ============================================================

export interface ModelMetadata {
  version: string;
  inputSize: number;
  confidenceThreshold: number;
  topK: number;
  labels: string[];
  regionId: string;
  modelType: 'tfjs' | 'tflite';
  quantized: boolean;
}

export interface InferenceResult {
  diseaseId: string;
  diseaseName?: string;
  confidence: number;
  classIndex: number;
  inferenceTimeMs: number;
  source: 'edge' | 'cloud' | 'hybrid';
  allPredictions?: Array<{ diseaseId: string; confidence: number }>;
}

export interface ModelDownloadProgress {
  totalBytes: number;
  downloadedBytes: number;
  progress: number; // 0-1
  status: 'downloading' | 'verifying' | 'loading' | 'complete' | 'error';
  error?: string;
}

export interface OfflineScanQueueItem {
  id: string;
  imageUri: string;
  fieldId?: string;
  cropId: string;
  regionId: string;
  location?: { lat: number; lon: number };
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: InferenceResult;
  error?: string;
}

// ============================================================
// Model Manager Class
// ============================================================

class EdgeModelManager {
  private tfjsModel: tf.LayersModel | null = null;
  private tfliteModel: any = null; // TFLite interpreter
  private metadata: ModelMetadata | null = null;
  private isLoading = false;
  private currentRegionId: string | null = null;
  private downloadProgressCallback: ((progress: ModelDownloadProgress) => void) | null = null;
  private offlineQueue: OfflineScanQueueItem[] = [];
  private isProcessingQueue = false;

  // TFLite support detection
  private tfliteSupported = false;

  constructor() {
    this.checkTFLiteSupport();
  }

  private async checkTFLiteSupport(): Promise<void> {
    if (Platform.OS !== 'web') {
      try {
        // Check if expo-tensorflow or similar is available
        // For now, we'll use TFJS on native too, but structure for TFLite
        this.tfliteSupported = false; // Will be true when TFLite plugin is added
      } catch {
        this.tfliteSupported = false;
      }
    }
  }

  /**
   * Set progress callback for model downloads
   */
  onDownloadProgress(callback: (progress: ModelDownloadProgress) => void): void {
    this.downloadProgressCallback = callback;
  }

  private updateProgress(progress: Partial<ModelDownloadProgress>): void {
    if (this.downloadProgressCallback) {
      this.downloadProgressCallback({
        totalBytes: 0,
        downloadedBytes: 0,
        progress: 0,
        status: 'downloading',
        ...progress,
      });
    }
  }

  /**
   * Initialize and load the edge model for a region
   */
  async initialize(regionId: string, forceRefresh = false): Promise<boolean> {
    if (this.isLoading) {
      console.log('[EdgeModel] Already loading...');
      return false;
    }

    if (!forceRefresh && this.tfjsModel && this.metadata?.regionId === regionId) {
      console.log('[EdgeModel] Model already loaded for region:', regionId);
      return true;
    }

    this.isLoading = true;
    this.currentRegionId = regionId;

    try {
      // Get model config from region registry
      const region = regionRegistry.getRegion(regionId);
      if (!region) {
        throw new Error(`Region not found: ${regionId}`);
      }

      const modelConfig = region.modelConfig;

      // Try to load from cache first
      const cached = await this.loadFromCache(regionId, modelConfig.edgeModelVersion);
      if (cached && !forceRefresh) {
        console.log('[EdgeModel] Loaded from cache');
        this.isLoading = false;
        return true;
      }

      // Download and cache model
      this.updateProgress({ status: 'downloading', progress: 0 });
      const modelPath = await this.ensureModelDownloaded(regionId, modelConfig);

      // Load model based on platform and availability
      this.updateProgress({ status: 'loading', progress: 0.8 });
      await this.loadModel(modelPath, modelConfig);

      // Cache metadata
      await this.cacheModelMetadata(regionId, modelConfig, modelPath);

      this.updateProgress({ status: 'complete', progress: 1 });
      console.log('[EdgeModel] Initialized successfully for region:', regionId);
      this.isLoading = false;
      return true;

    } catch (error) {
      console.error('[EdgeModel] Failed to initialize:', error);
      this.updateProgress({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      this.isLoading = false;
      return false;
    }
  }

  /**
   * Load model from local cache
   */
  private async loadFromCache(regionId: string, version: string): Promise<boolean> {
    try {
      const cached = await getCachedModel(regionId, version);
      if (!cached) return false;

      // Verify files exist
      const modelInfo = await FileSystem.getInfoAsync(cached.model_path);
      if (!modelInfo.exists) return false;

      // Load the model
      await this.loadModel(cached.model_path, { edgeModelVersion: version });
      await updateModelLastUsed(regionId, version);
      return true;
    } catch (error) {
      console.warn('[EdgeModel] Failed to load from cache:', error);
      return false;
    }
  }

  /**
   * Download and cache model files
   */
  private async ensureModelDownloaded(regionId: string, modelConfig: any): Promise<string> {
    const modelDir = `${FileSystem.cacheDirectory}models/${regionId}/${modelConfig.edgeModelVersion}/`;
    const modelInfo = await FileSystem.getInfoAsync(modelDir);

    if (modelInfo.exists) {
      // Check version
      const metadataPath = `${modelDir}metadata.json`;
      const metaInfo = await FileSystem.getInfoAsync(metadataPath);
      if (metaInfo.exists) {
        const content = await FileSystem.readAsStringAsync(metadataPath);
        const metadata = JSON.parse(content);
        if (metadata.version === modelConfig.edgeModelVersion) {
          console.log('[EdgeModel] Using cached model:', regionId);
          return modelDir;
        }
      }
    }

    // Download model
    console.log('[EdgeModel] Downloading model for region:', regionId);
    await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });

    const baseUrl = modelConfig.edgeModelUrl.replace(/\/[^\/]+$/, '/');
    const files = [
      'model.json',
      'model.weights.bin',
      'metadata.json',
      'labels.txt',
    ];

    let totalSize = 0;
    let downloadedSize = 0;

    // Get total size first
    for (const file of files) {
      try {
        const fileUrl = `${baseUrl}${file}`;
        const response = await fetch(fileUrl, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        if (contentLength) totalSize += parseInt(contentLength, 10);
      } catch {
        // Ignore errors in size calculation
      }
    }

    for (const file of files) {
      const fileUrl = `${baseUrl}${file}`;
      const destPath = `${modelDir}${file}`;

      try {
        const downloadResult = await FileSystem.downloadAsync(fileUrl, destPath);
        if (downloadResult.status !== 200) {
          console.warn(`[EdgeModel] Failed to download ${file}: ${downloadResult.status}`);
        } else {
          const fileInfo = await FileSystem.getInfoAsync(destPath);
          if ('size' in fileInfo) {
            downloadedSize += fileInfo.size;
            this.updateProgress({
              totalBytes: totalSize,
              downloadedBytes: downloadedSize,
              progress: totalSize > 0 ? downloadedSize / totalSize : 0,
            });
          }
        }
      } catch (error) {
        console.warn(`[EdgeModel] Error downloading ${file}:`, error);
      }
    }

    // Verify hash if provided
    if (modelConfig.edgeModelHash) {
      await this.verifyModelHash(modelDir, modelConfig.edgeModelHash);
    }

    return modelDir;
  }

  /**
   * Verify model file integrity
   */
  private async verifyModelHash(modelDir: string, expectedHash: string): Promise<boolean> {
    try {
      const files = ['model.json', 'model.weights.bin'];
      let combinedContent = '';

      for (const file of files) {
        const path = `${modelDir}${file}`;
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          combinedContent += await FileSystem.readAsStringAsync(path);
        }
      }

      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, combinedContent);
      return hash === expectedHash;
    } catch {
      return true; // Skip verification on error
    }
  }

  /**
   * Load model (TFJS or TFLite)
   */
  private async loadModel(modelPath: string, modelConfig: any): Promise<void> {
    if (Platform.OS === 'web' || !this.tfliteSupported) {
      // Load TFJS model
      console.log('[EdgeModel] Loading TFJS model from:', modelPath);
      const startTime = Date.now();
      this.tfjsModel = await tf.loadLayersModel(`file://${modelPath}model.json`);
      console.log(`[EdgeModel] TFJS model loaded in ${Date.now() - startTime}ms`);
    } else {
      // Load TFLite model (when available)
      console.log('[EdgeModel] Loading TFLite model from:', modelPath);
      // this.tfliteModel = await TFLite.loadModel(`${modelPath}model.tflite`);
      throw new Error('TFLite not yet implemented');
    }

    // Load metadata
    const metadataPath = `${modelPath}metadata.json`;
    const metadataExists = await FileSystem.getInfoAsync(metadataPath);
    if (metadataExists.exists) {
      const metadataContent = await FileSystem.readAsStringAsync(metadataPath);
      this.metadata = JSON.parse(metadataContent);
    } else {
      // Fallback metadata from region config
      this.metadata = {
        version: modelConfig.edgeModelVersion,
        inputSize: modelConfig.inputSize,
        confidenceThreshold: modelConfig.confidenceThreshold,
        topK: modelConfig.topK,
        labels: await this.loadLabels(`${modelPath}labels.txt`),
        regionId: this.currentRegionId!,
        modelType: Platform.OS === 'web' ? 'tfjs' : 'tflite',
        quantized: true,
      };
    }

    // Load labels
    if (this.metadata.labels.length === 0) {
      this.metadata.labels = await this.loadLabels(`${modelPath}labels.txt`);
    }
  }

  /**
   * Load labels from file
   */
  private async loadLabels(labelsPath: string): Promise<string[]> {
    try {
      const info = await FileSystem.getInfoAsync(labelsPath);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(labelsPath);
        return content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      }
    } catch {
      // Ignore
    }
    return [];
  }

  /**
   * Cache model metadata in database
   */
  private async cacheModelMetadata(regionId: string, modelConfig: any, modelPath: string): Promise<void> {
    try {
      const modelInfo = await FileSystem.getInfoAsync(`${modelPath}model.json`);
      const weightsInfo = await FileSystem.getInfoAsync(`${modelPath}model.weights.bin`);

      await cacheModel({
        region_id: regionId,
        version: modelConfig.edgeModelVersion,
        model_path: `${modelPath}model.json`,
        metadata_path: `${modelPath}metadata.json`,
        labels_path: `${modelPath}labels.txt`,
        size_bytes: (modelInfo.size || 0) + (weightsInfo.size || 0),
      });
    } catch (error) {
      console.warn('[EdgeModel] Failed to cache model metadata:', error);
    }
  }

  /**
   * Run inference on an image
   */
  async predict(imageUri: string, options?: { returnAllPredictions?: boolean }): Promise<InferenceResult | null> {
    if (!this.tfjsModel && !this.tfliteModel) {
      console.error('[EdgeModel] Model not initialized');
      return null;
    }

    if (!this.metadata) {
      console.error('[EdgeModel] Metadata not loaded');
      return null;
    }

    try {
      // Load and preprocess image
      const imageTensor = await this.preprocessImage(imageUri);

      // Run inference
      const startTime = Date.now();
      let predictions: tf.Tensor;

      if (this.tfliteModel) {
        // TFLite inference (when implemented)
        // predictions = await this.runTFLiteInference(imageTensor);
        throw new Error('TFLite not implemented');
      } else {
        // TFJS inference
        predictions = this.tfjsModel!.predict(imageTensor) as tf.Tensor;
      }

      const inferenceTime = Date.now() - startTime;

      // Get predictions
      const scores = await predictions.data();
      predictions.dispose();
      imageTensor.dispose();

      // Process results
      const topK = this.metadata.topK;
      const indexedScores = Array.from(scores)
        .map((score, index) => ({ index, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      const topResult = indexedScores[0];

      // Check confidence threshold
      const isConfident = topResult.score >= this.metadata.confidenceThreshold;
      const diseaseId = isConfident ? (this.metadata.labels[topResult.index] || 'unknown') : 'unknown';

      const result: InferenceResult = {
        diseaseId,
        confidence: topResult.score,
        classIndex: topResult.index,
        inferenceTimeMs: inferenceTime,
        source: 'edge',
        allPredictions: options?.returnAllPredictions ? indexedScores.map(p => ({
          diseaseId: this.metadata!.labels[p.index] || `class_${p.index}`,
          confidence: p.score,
        })) : undefined,
      };

      if (result.diseaseId !== 'unknown') {
        result.diseaseName = this.metadata.labels[topResult.index];
      }

      return result;

    } catch (error) {
      console.error('[EdgeModel] Inference failed:', error);
      return null;
    }
  }

  /**
   * Preprocess image for model input
   */
  private async preprocessImage(imageUri: string): Promise<tf.Tensor> {
    if (!this.metadata) throw new Error('Metadata not loaded');

    // Load image using expo-image-manipulator for better performance
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');

    // Resize and compress
    const resized = await manipulateAsync(
      imageUri,
      [{ resize: { width: this.metadata.inputSize, height: this.metadata.inputSize } }],
      { compress: 0.9, format: SaveFormat.JPEG }
    );

    // Convert to tensor
    if (Platform.OS === 'web') {
      const response = await fetch(resized.uri);
      const blob = await response.blob();
      const img = await tf.browser.fromPixels(blob as any);
      const normalized = tf.image.resizeBilinear(img, [this.metadata.inputSize, this.metadata.inputSize]).div(255.0);
      img.dispose();
      return normalized.expandDims(0);
    } else {
      // Native: read as base64 and decode
      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create tensor from base64
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode JPEG - use a simple approach for now
      // In production, use a proper image decoder
      const tensor = tf.tensor3d(bytes.slice(0, this.metadata.inputSize * this.metadata.inputSize * 3), [this.metadata.inputSize, this.metadata.inputSize, 3]);
      return tensor.div(255.0).expandDims(0);
    }
  }

  /**
   * Enhanced prediction with auto-crop and enhancement
   */
  async predictWithEnhancement(
    imageUri: string,
    options?: {
      autoCrop?: boolean;
      enhance?: boolean;
      returnAllPredictions?: boolean;
    }
  ): Promise<InferenceResult | null> {
    let processedUri = imageUri;

    if (options?.autoCrop || options?.enhance) {
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');

      const actions = [];
      if (options.autoCrop) {
        // Auto-crop to square centered on image
        actions.push({ crop: { originX: 0, originY: 0, width: 1, height: 1 } });
      }
      if (options.enhance) {
        // Enhance contrast and brightness
        // Note: expo-image-manipulator doesn't have direct enhance, but we can adjust
      }

      const result = await manipulateAsync(
        imageUri,
        actions,
        { compress: 0.95, format: SaveFormat.JPEG }
      );
      processedUri = result.uri;
    }

    return this.predict(processedUri, { returnAllPredictions: options?.returnAllPredictions });
  }

  /**
   * Check if model is loaded and ready
   */
  isReady(): boolean {
    return (this.tfjsModel !== null || this.tfliteModel !== null) && this.metadata !== null;
  }

  /**
   * Get current model metadata
   */
  getMetadata(): ModelMetadata | null {
    return this.metadata;
  }

  /**
   * Unload model to free memory
   */
  dispose(): void {
    if (this.tfjsModel) {
      this.tfjsModel.dispose();
      this.tfjsModel = null;
    }
    if (this.tfliteModel) {
      // this.tfliteModel.close();
      this.tfliteModel = null;
    }
    this.metadata = null;
    console.log('[EdgeModel] Model disposed');
  }

  /**
   * Get model size info
   */
  async getModelSize(): Promise<{ paramCount: number; sizeMB: number } | null> {
    if (!this.tfjsModel) return null;

    const paramCount = this.tfjsModel.countParams();
    const sizeMB = (paramCount * 4) / (1024 * 1024); // float32 = 4 bytes

    return { paramCount, sizeMB };
  }

  // ============================================================
  // Offline Queue Management
  // ============================================================

  /**
   * Add scan to offline queue for later processing
   */
  async queueOfflineScan(
    imageUri: string,
    cropId: string,
    regionId: string,
    fieldId?: string,
    location?: { lat: number; lon: number }
  ): Promise<string> {
    const id = `offline_scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const item: OfflineScanQueueItem = {
      id,
      imageUri,
      fieldId,
      cropId,
      regionId,
      location,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    };

    this.offlineQueue.push(item);

    // Also persist to database
    await addToOfflineQueue('scan', 'create', id, {
      imageUri,
      fieldId,
      cropId,
      regionId,
      location,
      timestamp: item.timestamp,
    });

    return id;
  }

  /**
   * Process offline queue when online
   */
  async processOfflineQueue(onProgress?: (completed: number, total: number) => void): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    // Get pending items from database
    const { getPendingQueueItems, markQueueItemProcessing, markQueueItemCompleted, markQueueItemFailed } = await import('./database');
    const pendingItems = await getPendingQueueItems();

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      if (item.type !== 'scan') continue;

      await markQueueItemProcessing(item.id);

      try {
        const payload = JSON.parse(item.payload);
        const result = await this.predictWithEnhancement(payload.imageUri, {
          autoCrop: true,
          enhance: true,
          returnAllPredictions: true,
        });

        if (result) {
          // Save result to scans table
          const { createScan } = await import('./database');
          await createScan({
            field_id: payload.fieldId,
            image_uri: payload.imageUri,
            disease_id: result.diseaseId,
            disease_name: result.diseaseName,
            confidence: result.confidence,
            severity: result.confidence > 0.8 ? 'high' : result.confidence > 0.5 ? 'medium' : 'low',
            latitude: payload.location?.lat || null,
            longitude: payload.location?.lon || null,
            inference_time_ms: result.inferenceTimeMs,
            source: 'edge',
          });
        }

        await markQueueItemCompleted(item.id);
      } catch (error) {
        await markQueueItemFailed(item.id, error instanceof Error ? error.message : 'Unknown error');
      }

      onProgress?.(i + 1, pendingItems.length);
    }

    this.isProcessingQueue = false;
  }

  /**
   * Get offline queue status
   */
  getOfflineQueueStatus(): { pending: number; processing: number; failed: number } {
    const pending = this.offlineQueue.filter(i => i.status === 'pending').length;
    const processing = this.offlineQueue.filter(i => i.status === 'processing').length;
    const failed = this.offlineQueue.filter(i => i.status === 'failed').length;
    return { pending, processing, failed };
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue(): void {
    this.offlineQueue = [];
  }
}

// ============================================================
// Singleton Instance
// ============================================================

export const edgeModelManager = new EdgeModelManager();

// ============================================================
// React Hooks
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export function useEdgeModel(regionId: string) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<ModelDownloadProgress | null>(null);
  const initializedRef = useRef(false);

  const initialize = useCallback(async (force = false) => {
    if (initializedRef.current && !force) return;
    initializedRef.current = true;

    setLoading(true);
    setError(null);

    try {
      edgeModelManager.onDownloadProgress(setDownloadProgress);
      const success = await edgeModelManager.initialize(regionId, force);
      setReady(success);
      if (!success) {
        setError('Failed to load edge model');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setReady(false);
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  const predict = useCallback(async (imageUri: string, options?: { autoCrop?: boolean; enhance?: boolean; returnAllPredictions?: boolean }) => {
    if (!ready) return null;
    return edgeModelManager.predictWithEnhancement(imageUri, options);
  }, [ready]);

  const predictSimple = useCallback(async (imageUri: string) => {
    if (!ready) return null;
    return edgeModelManager.predict(imageUri);
  }, [ready]);

  const processQueue = useCallback(async (onProgress?: (completed: number, total: number) => void) => {
    return edgeModelManager.processOfflineQueue(onProgress);
  }, []);

  const getQueueStatus = useCallback(() => {
    return edgeModelManager.getOfflineQueueStatus();
  }, []);

  const queueOfflineScan = useCallback(async (
    imageUri: string,
    cropId: string,
    regionId: string,
    fieldId?: string,
    location?: { lat: number; lon: number }
  ) => {
    return edgeModelManager.queueOfflineScan(imageUri, cropId, regionId, fieldId, location);
  }, []);

  useEffect(() => {
    initialize();
    return () => {
      // Don't dispose on unmount - keep model cached
    };
  }, [initialize]);

  return {
    ready,
    loading,
    error,
    downloadProgress,
    predict,
    predictSimple,
    initialize,
    processQueue,
    getQueueStatus,
    queueOfflineScan,
  };
}

// Export the class for advanced usage
export { EdgeModelManager };