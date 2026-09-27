/**
 * Offline Sync & Data Management Hook
 * Handles background sync, data export/import, and queue management
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getUnsyncedCount,
  markEntitySynced,
  exportAllData,
  importAllData,
  getPendingQueueItems,
  markQueueItemProcessing,
  markQueueItemCompleted,
  markQueueItemFailed,
  OfflineQueueItem,
} from '@/services/database';
import { NetInfo } from '@react-native-community/netinfo';
import { edgeModelManager } from '@/services/edge-inference';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCounts: {
    fields: number;
    scans: number;
    treatments: number;
    inputs: number;
    expenses: number;
    yields: number;
    reminders: number;
    total: number;
  };
  queueStatus: {
    pending: number;
    processing: number;
    failed: number;
  };
}

export function useOfflineSync() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    lastSyncedAt: null,
    pendingCounts: {
      fields: 0,
      scans: 0,
      treatments: 0,
      inputs: 0,
      expenses: 0,
      yields: 0,
      reminders: 0,
      total: 0,
    },
    queueStatus: {
      pending: 0,
      processing: 0,
      failed: 0,
    },
  });

  const syncInProgress = useRef(false);
  const netInfoUnsubscribe = useRef<(() => void) | null>(null);

  // Load pending counts
  const loadPendingCounts = useCallback(async () => {
    try {
      const [pendingCounts, queueItems] = await Promise.all([
        getUnsyncedCount(),
        getPendingQueueItems(),
      ]);

      const queueStatus = {
        pending: queueItems.filter(i => i.status === 'pending').length,
        processing: queueItems.filter(i => i.status === 'processing').length,
        failed: queueItems.filter(i => i.status === 'failed').length,
      };

      setStatus(prev => ({
        ...prev,
        pendingCounts: {
          ...pendingCounts,
          total: Object.values(pendingCounts).reduce((a, b) => a + b, 0),
        },
        queueStatus,
      }));
    } catch (err) {
      console.error('Failed to load pending counts:', err);
    }
  }, []);

  // Perform sync
  const sync = useCallback(async (onProgress?: (progress: { completed: number; total: number; current: string }) => void): Promise<boolean> => {
    if (syncInProgress.current || !status.isOnline) return false;
    syncInProgress.current = true;

    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      // Process offline queue first
      const queueItems = await getPendingQueueItems();
      const pendingItems = queueItems.filter(i => i.status === 'pending' || i.status === 'failed');

      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];
        await markQueueItemProcessing(item.id);

        onProgress?.({
          completed: i,
          total: pendingItems.length,
          current: `${item.type} - ${item.action}`,
        });

        try {
          // In a real app, this would call the API to sync the data
          // For now, we'll simulate success
          await new Promise(resolve => setTimeout(resolve, 100));

          await markQueueItemCompleted(item.id);

          // Mark related entity as synced
          if (item.entity_id) {
            const tableMap: Record<string, string> = {
              field: 'fields',
              scan: 'scans',
              treatment: 'treatments',
              input: 'input_records',
              expense: 'expense_records',
              yield: 'yield_records',
              reminder: 'reminders',
            };
            const table = tableMap[item.type];
            if (table) {
              await markEntitySynced(table, item.entity_id);
            }
          }
        } catch (error) {
          await markQueueItemFailed(item.id, error instanceof Error ? error.message : 'Sync failed');
        }
      }

      onProgress?.({
        completed: pendingItems.length,
        total: pendingItems.length,
        current: 'Complete',
      });

      // Update last synced time
      const now = new Date().toISOString();
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncedAt: now,
      }));

      await loadPendingCounts();
      return true;
    } catch (err) {
      console.error('Sync failed:', err);
      setStatus(prev => ({ ...prev, isSyncing: false }));
      return false;
    } finally {
      syncInProgress.current = false;
    }
  }, [status.isOnline, loadPendingCounts]);

  // Auto-sync when online
  const enableAutoSync = useCallback(() => {
    netInfoUnsubscribe.current = NetInfo.addEventListener(state => {
      const isOnline = state.isConnected ?? false;
      setStatus(prev => ({ ...prev, isOnline }));

      if (isOnline && !syncInProgress.current && status.pendingCounts.total > 0) {
        // Auto-sync after a short delay
        setTimeout(() => {
          sync();
        }, 5000);
      }
    });

    // Initial check
    NetInfo.fetch().then(state => {
      setStatus(prev => ({ ...prev, isOnline: state.isConnected ?? false }));
      loadPendingCounts();
    });
  }, [sync, loadPendingCounts, status.pendingCounts.total]);

  const disableAutoSync = useCallback(() => {
    if (netInfoUnsubscribe.current) {
      netInfoUnsubscribe.current();
      netInfoUnsubscribe.current = null;
    }
  }, []);

  // Export data for backup
  const exportData = useCallback(async (): Promise<string> => {
    return exportAllData();
  }, []);

  // Import data from backup
  const importData = useCallback(async (jsonData: string): Promise<void> => {
    await importAllData(jsonData);
    await loadPendingCounts();
  }, [loadPendingCounts]);

  // Clear all local data (for testing/reset)
  const clearAllData = useCallback(async (): Promise<void> => {
    // This would clear all local tables
    // Implementation depends on requirements
    console.warn('Clear all data not implemented');
  }, []);

  // Retry failed queue items
  const retryFailedItems = useCallback(async (): Promise<void> => {
    const queueItems = await getPendingQueueItems();
    const failedItems = queueItems.filter(i => i.status === 'failed');

    for (const item of failedItems) {
      // Reset to pending for retry
      // This would need an update function in database.ts
    }

    await loadPendingCounts();
  }, [loadPendingCounts]);

  useEffect(() => {
    enableAutoSync();
    loadPendingCounts();

    // Periodic refresh
    const interval = setInterval(loadPendingCounts, 30000); // Every 30 seconds

    return () => {
      disableAutoSync();
      clearInterval(interval);
    };
  }, [enableAutoSync, disableAutoSync, loadPendingCounts]);

  return {
    ...status,
    sync,
    exportData,
    importData,
    clearAllData,
    retryFailedItems,
    refresh: loadPendingCounts,
  };
}

// Hook for managing model downloads
export function useModelDownload() {
  const [downloads, setDownloads] = useState<Record<string, {
    progress: number;
    status: 'idle' | 'downloading' | 'verifying' | 'complete' | 'error';
    error?: string;
  }>>({});

  const downloadModel = useCallback(async (regionId: string, version: string): Promise<boolean> => {
    setDownloads(prev => ({
      ...prev,
      [regionId]: { progress: 0, status: 'downloading' },
    }));

    try {
      const success = await edgeModelManager.initialize(regionId, true);
      if (success) {
        setDownloads(prev => ({
          ...prev,
          [regionId]: { progress: 1, status: 'complete' },
        }));
      } else {
        setDownloads(prev => ({
          ...prev,
          [regionId]: { progress: 0, status: 'error', error: 'Failed to initialize model' },
        }));
      }
      return success;
    } catch (err) {
      setDownloads(prev => ({
        ...prev,
        [regionId]: { progress: 0, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' },
      }));
      return false;
    }
  }, []);

  const getDownloadStatus = useCallback((regionId: string) => {
    return downloads[regionId] || { progress: 0, status: 'idle' };
  }, [downloads]);

  return {
    downloads,
    downloadModel,
    getDownloadStatus,
  };
}

// Hook for storage management
export function useStorageInfo() {
  const [storageInfo, setStorageInfo] = useState<{
    totalSpace: number;
    usedSpace: number;
    availableSpace: number;
    databaseSize: number;
    cacheSize: number;
    modelsSize: number;
  } | null>(null);

  const refreshStorageInfo = useCallback(async () => {
    try {
      const { getInfoAsync } = await import('expo-file-system');

      // Get database size
      const dbInfo = await getInfoAsync(`${FileSystem.documentDirectory}SQLite/agrisense.db`);

      // Get cache size
      const cacheInfo = await getInfoAsync(FileSystem.cacheDirectory);

      // Get models size
      const modelsDir = `${FileSystem.cacheDirectory}models/`;
      const modelsInfo = await getInfoAsync(modelsDir);

      // Estimate total (this is approximate)
      const dbSize = dbInfo.exists && 'size' in dbInfo ? dbInfo.size : 0;
      const cacheSize = cacheInfo.exists && 'size' in cacheInfo ? cacheInfo.size : 0;
      const modelsSize = modelsInfo.exists && 'size' in modelsInfo ? modelsInfo.size : 0;

      setStorageInfo({
        totalSpace: 0, // Would need native module
        usedSpace: dbSize + cacheSize + modelsSize,
        availableSpace: 0, // Would need native module
        databaseSize: dbSize,
        cacheSize,
        modelsSize,
      });
    } catch (err) {
      console.error('Failed to get storage info:', err);
    }
  }, []);

  useEffect(() => {
    refreshStorageInfo();
  }, [refreshStorageInfo]);

  return {
    storageInfo,
    refresh: refreshStorageInfo,
  };
}

// Need to import FileSystem
import * as FileSystem from 'expo-file-system';