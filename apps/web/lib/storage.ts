'use client';

// Scan history persisted in IndexedDB.
import { get, set } from 'idb-keyval';
import type { DetectionResult } from './types';

const KEY = 'agrisense-history';
const MAX = 100;

export interface HistoryItem extends DetectionResult {
  historyId: string;
  regionId: string;
  thumbnail?: string; // small data URL
}

export async function getHistory(): Promise<HistoryItem[]> {
  return (await get<HistoryItem[]>(KEY)) ?? [];
}

export async function addHistory(item: Omit<HistoryItem, 'historyId'>): Promise<HistoryItem> {
  const withId: HistoryItem = { ...item, historyId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` };
  const list = [withId, ...(await getHistory())].slice(0, MAX);
  await set(KEY, list);
  return withId;
}

export async function clearHistory(): Promise<void> {
  await set(KEY, []);
}
