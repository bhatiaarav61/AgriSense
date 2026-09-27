/**
 * Fields Management Hook
 * Handles field CRUD operations, GPS boundaries, and crop calendar
 */

import { useState, useCallback, useEffect } from 'react';
import {
  createField,
  updateField,
  deleteField,
  getFields,
  getField,
  getFieldsByCrop,
  Field,
} from '@/services/database';
import { useAuth } from './useAuth';

export interface FieldFormData {
  name: string;
  crop_id: string;
  crop_name?: string;
  area_hectares: number;
  latitude: number;
  longitude: number;
  boundary_points?: Array<{ lat: number; lng: number }>;
  soil_type?: string;
  irrigation_type?: 'rainfed' | 'irrigated' | 'partial';
  planting_date?: string;
  expected_harvest_date?: string;
}

export function useFields() {
  const { regionId, cropId } = useAuth();
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFields();
      setFields(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fields');
    } finally {
      setLoading(false);
    }
  }, []);

  const addField = useCallback(async (data: FieldFormData): Promise<string> => {
    setError(null);
    try {
      const boundary_points = data.boundary_points ? JSON.stringify(data.boundary_points) : undefined;
      const id = await createField({
        ...data,
        boundary_points,
      });
      await loadFields();
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create field');
      throw err;
    }
  }, [loadFields]);

  const editField = useCallback(async (id: string, data: Partial<FieldFormData>): Promise<void> => {
    setError(null);
    try {
      const updates: Partial<Field> = { ...data };
      if (data.boundary_points) {
        updates.boundary_points = JSON.stringify(data.boundary_points);
      }
      await updateField(id, updates);
      await loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update field');
      throw err;
    }
  }, [loadFields]);

  const removeField = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await deleteField(id);
      await loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete field');
      throw err;
    }
  }, [loadFields]);

  const getFieldById = useCallback(async (id: string): Promise<Field | null> => {
    try {
      return await getField(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get field');
      return null;
    }
  }, []);

  useEffect(() => {
    loadFields();
  }, [loadFields, regionId, cropId]);

  // Calculate field statistics
  const totalArea = fields.reduce((sum, f) => sum + f.area_hectares, 0);
  const fieldsByCrop = fields.reduce((acc, f) => {
    acc[f.crop_id] = (acc[f.crop_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    fields,
    loading,
    error,
    loadFields,
    addField,
    editField,
    removeField,
    getFieldById,
    totalArea,
    fieldsByCrop,
    fieldCount: fields.length,
  };
}

// Hook for a single field with related data
export function useField(fieldId: string) {
  const [field, setField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadField = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getField(fieldId);
      setField(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load field');
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    if (fieldId) {
      loadField();
    }
  }, [fieldId, loadField]);

  const updateFieldData = useCallback(async (data: Partial<FieldFormData>): Promise<void> => {
    if (!field) return;
    setError(null);
    try {
      const updates: Partial<Field> = { ...data };
      if (data.boundary_points) {
        updates.boundary_points = JSON.stringify(data.boundary_points);
      }
      await updateField(field.id, updates);
      await loadField();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update field');
      throw err;
    }
  }, [field, loadField]);

  const deleteFieldData = useCallback(async (): Promise<void> => {
    if (!field) return;
    setError(null);
    try {
      await deleteField(field.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete field');
      throw err;
    }
  }, [field]);

  return {
    field,
    loading,
    error,
    updateField: updateFieldData,
    deleteField: deleteFieldData,
    refresh: loadField,
  };
}

// Crop calendar hook
export interface CalendarEvent {
  id: string;
  field_id: string;
  field_name: string;
  crop_id: string;
  crop_name: string;
  type: 'planting' | 'fertilizer' | 'pesticide' | 'harvest' | 'irrigation' | 'custom';
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  is_completed: boolean;
  color: string;
}

export function useCropCalendar() {
  const { fields } = useFields();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const generateCalendarEvents = useCallback(async () => {
    setLoading(true);
    try {
      const calendarEvents: CalendarEvent[] = [];

      for (const field of fields) {
        if (!field.planting_date || !field.expected_harvest_date) continue;

        const plantingDate = new Date(field.planting_date);
        const harvestDate = new Date(field.expected_harvest_date);
        const growingDays = Math.ceil((harvestDate.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24));

        // Planting event
        calendarEvents.push({
          id: `planting_${field.id}`,
          field_id: field.id,
          field_name: field.name,
          crop_id: field.crop_id,
          crop_name: field.crop_name || field.crop_id,
          type: 'planting',
          title: `Plant ${field.crop_name || field.crop_id}`,
          description: `Planting date for ${field.name}`,
          date: field.planting_date,
          is_completed: new Date(field.planting_date) < new Date(),
          color: '#10B981',
        });

        // Fertilizer events (every 30 days during growth)
        const fertilizerIntervals = Math.max(1, Math.floor(growingDays / 30));
        for (let i = 1; i <= fertilizerIntervals; i++) {
          const fertDate = new Date(plantingDate);
          fertDate.setDate(fertDate.getDate() + i * 30);
          if (fertDate > harvestDate) break;

          calendarEvents.push({
            id: `fertilizer_${field.id}_${i}`,
            field_id: field.id,
            field_name: field.name,
            crop_id: field.crop_id,
            crop_name: field.crop_name || field.crop_id,
            type: 'fertilizer',
            title: `Fertilizer Application #${i}`,
            description: `Fertilizer for ${field.name} (${field.crop_name || field.crop_id})`,
            date: fertDate.toISOString().split('T')[0],
            is_completed: fertDate < new Date(),
            color: '#F59E0B',
          });
        }

        // Pesticide events (every 45 days)
        const pesticideIntervals = Math.max(1, Math.floor(growingDays / 45));
        for (let i = 1; i <= pesticideIntervals; i++) {
          const pestDate = new Date(plantingDate);
          pestDate.setDate(pestDate.getDate() + i * 45);
          if (pestDate > harvestDate) break;

          calendarEvents.push({
            id: `pesticide_${field.id}_${i}`,
            field_id: field.id,
            field_name: field.name,
            crop_id: field.crop_id,
            crop_name: field.crop_name || field.crop_id,
            type: 'pesticide',
            title: `Pesticide Check #${i}`,
            description: `Pest monitoring for ${field.name}`,
            date: pestDate.toISOString().split('T')[0],
            is_completed: pestDate < new Date(),
            color: '#EF4444',
          });
        }

        // Harvest event
        calendarEvents.push({
          id: `harvest_${field.id}`,
          field_id: field.id,
          field_name: field.name,
          crop_id: field.crop_id,
          crop_name: field.crop_name || field.crop_id,
          type: 'harvest',
          title: `Harvest ${field.crop_name || field.crop_id}`,
          description: `Expected harvest for ${field.name}`,
          date: field.expected_harvest_date,
          is_completed: new Date(field.expected_harvest_date) < new Date(),
          color: '#8B5CF6',
        });
      }

      setEvents(calendarEvents.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (err) {
      console.error('Failed to generate calendar:', err);
    } finally {
      setLoading(false);
    }
  }, [fields]);

  useEffect(() => {
    generateCalendarEvents();
  }, [generateCalendarEvents]);

  const getEventsForDate = useCallback((date: string): CalendarEvent[] => {
    return events.filter(e => e.date === date);
  }, [events]);

  const getEventsForDateRange = useCallback((startDate: string, endDate: string): CalendarEvent[] => {
    return events.filter(e => e.date >= startDate && e.date <= endDate);
  }, [events]);

  const getUpcomingEvents = useCallback((days = 7): CalendarEvent[] => {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + days);
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = future.toISOString().split('T')[0];

    return events
      .filter(e => !e.is_completed && e.date >= todayStr && e.date <= futureStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  return {
    events,
    loading,
    getEventsForDate,
    getEventsForDateRange,
    getUpcomingEvents,
    refresh: generateCalendarEvents,
  };
}