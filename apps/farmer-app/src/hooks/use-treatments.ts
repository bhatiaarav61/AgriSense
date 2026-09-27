/**
 * Treatment Management Hook
 * Handles treatment wizard, cost calculator, follow-up reminders
 */

import { useState, useCallback, useEffect } from 'react';
import {
  createTreatment,
  updateTreatment,
  getTreatment,
  getTreatmentsByField,
  Treatment,
} from '@/services/database';
import { createReminder, getRemindersByField, Reminder } from '@/services/database';
import { edgeModelManager, InferenceResult } from '@/services/edge-inference';

export interface TreatmentStep {
  id: string;
  order: number;
  title: string;
  description: string;
  product_id?: string;
  product_name?: string;
  dosage?: string;
  timing?: string; // e.g., "Day 1", "Week 2"
  duration_days?: number;
  safety_notes?: string;
  completed: boolean;
  completed_at?: string;
}

export interface TreatmentProduct {
  id: string;
  name: string;
  type: 'fungicide' | 'insecticide' | 'herbicide' | 'fertilizer' | 'biological' | 'other';
  active_ingredient: string;
  concentration: string;
  unit: string; // ml, g, kg per hectare
  price_per_unit: number;
  currency: string;
  supplier_ids: string[];
  application_method: 'spray' | 'soil' | 'seed_treatment' | 'foliar';
  pre_harvest_interval_days: number;
  re_entry_interval_hours: number;
}

export interface TreatmentPlan {
  disease_id: string;
  disease_name: string;
  severity: 'low' | 'medium' | 'high';
  steps: TreatmentStep[];
  products: TreatmentProduct[];
  total_estimated_cost: number;
  currency: string;
  duration_days: number;
  follow_up_schedule: Array<{ day: number; description: string }>;
}

export function useTreatments() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTreatmentsForField = useCallback(async (fieldId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTreatmentsByField(fieldId);
      setTreatments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load treatments');
    } finally {
      setLoading(false);
    }
  }, []);

  const createTreatmentFromDetection = useCallback(async (
    scanId: string,
    detectionResult: InferenceResult,
    treatmentPlan: TreatmentPlan
  ): Promise<string> => {
    setError(null);
    try {
      const id = await createTreatment({
        scan_id: scanId,
        disease_id: detectionResult.diseaseId,
        treatment_plan: JSON.stringify(treatmentPlan.steps),
        products: JSON.stringify(treatmentPlan.products),
        estimated_cost: treatmentPlan.total_estimated_cost,
        currency: treatmentPlan.currency,
        supplier_ids: JSON.stringify(treatmentPlan.products.map(p => p.supplier_ids).flat()),
        status: 'planned',
      });

      // Create follow-up reminders
      for (const followUp of treatmentPlan.follow_up_schedule) {
        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + followUp.day);

        await createReminder({
          field_id: null, // Will be set when we have field context
          type: 'treatment_followup',
          title: `Treatment Follow-up: ${treatmentPlan.disease_name}`,
          description: followUp.description,
          scheduled_at: reminderDate.toISOString(),
          status: 'pending',
          priority: followUp.day <= 7 ? 'high' : 'medium',
          recurrence: 'none',
          metadata: JSON.stringify({ treatment_id: id, follow_up_day: followUp.day }),
        });
      }

      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create treatment');
      throw err;
    }
  }, []);

  const updateTreatmentStatus = useCallback(async (
    id: string,
    status: Treatment['status'],
    completedStepId?: string
  ): Promise<void> => {
    setError(null);
    try {
      const updates: Partial<Treatment> = { status };

      if (status === 'in_progress' && !updates.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      await updateTreatment(id, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update treatment');
      throw err;
    }
  }, []);

  const completeTreatmentStep = useCallback(async (
    treatmentId: string,
    stepId: string
  ): Promise<void> => {
    setError(null);
    try {
      const treatment = treatments.find(t => t.id === treatmentId);
      if (!treatment) throw new Error('Treatment not found');

      const steps: TreatmentStep[] = JSON.parse(treatment.treatment_plan);
      const stepIndex = steps.findIndex(s => s.id === stepId);
      if (stepIndex === -1) throw new Error('Step not found');

      steps[stepIndex].completed = true;
      steps[stepIndex].completed_at = new Date().toISOString();

      // Check if all steps completed
      const allCompleted = steps.every(s => s.completed);

      await updateTreatment(treatmentId, {
        treatment_plan: JSON.stringify(steps),
        status: allCompleted ? 'completed' : 'in_progress',
        completed_at: allCompleted ? new Date().toISOString() : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete step');
      throw err;
    }
  }, [treatments]);

  const getTreatmentByScan = useCallback(async (scanId: string): Promise<Treatment | null> => {
    try {
      return await getTreatment(scanId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get treatment');
      return null;
    }
  }, []);

  return {
    treatments,
    loading,
    error,
    loadTreatmentsForField,
    createTreatmentFromDetection,
    updateTreatmentStatus,
    completeTreatmentStep,
    getTreatmentByScan,
  };
}

// Treatment Wizard Hook - generates step-by-step treatment plans
export function useTreatmentWizard() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateTreatmentPlan = useCallback(async (
    diseaseId: string,
    diseaseName: string,
    severity: 'low' | 'medium' | 'high',
    cropId: string,
    regionId: string
  ): Promise<TreatmentPlan | null> => {
    setGenerating(true);
    setError(null);

    try {
      // In a real app, this would fetch from API or use local knowledge base
      // For now, we'll generate a comprehensive plan based on disease type

      const plan = generateLocalTreatmentPlan(diseaseId, diseaseName, severity, cropId);
      return plan;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate treatment plan');
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  return { generateTreatmentPlan, generating, error };
}

// Local treatment plan generator (would be replaced by API in production)
function generateLocalTreatmentPlan(
  diseaseId: string,
  diseaseName: string,
  severity: 'low' | 'medium' | 'high',
  cropId: string
): TreatmentPlan {
  // Base products for common diseases
  const commonProducts: Record<string, TreatmentProduct[]> = {
    rice_blast: [
      {
        id: 'prod_1',
        name: 'Tricyclazole 75% WP',
        type: 'fungicide',
        active_ingredient: 'Tricyclazole',
        concentration: '75% WP',
        unit: 'g/ha',
        price_per_unit: 450,
        currency: 'INR',
        supplier_ids: ['sup_1', 'sup_2'],
        application_method: 'spray',
        pre_harvest_interval_days: 30,
        re_entry_interval_hours: 24,
      },
      {
        id: 'prod_2',
        name: 'Azoxystrobin 23% SC',
        type: 'fungicide',
        active_ingredient: 'Azoxystrobin',
        concentration: '23% SC',
        unit: 'ml/ha',
        price_per_unit: 1200,
        currency: 'INR',
        supplier_ids: ['sup_1', 'sup_3'],
        application_method: 'spray',
        pre_harvest_interval_days: 21,
        re_entry_interval_hours: 12,
      },
    ],
    bacterial_blight: [
      {
        id: 'prod_3',
        name: 'Streptomycin Sulphate 9% + Tetracycline 1% SP',
        type: 'fungicide',
        active_ingredient: 'Streptomycin + Tetracycline',
        concentration: '9% + 1% SP',
        unit: 'g/ha',
        price_per_unit: 380,
        currency: 'INR',
        supplier_ids: ['sup_2'],
        application_method: 'spray',
        pre_harvest_interval_days: 15,
        re_entry_interval_hours: 48,
      },
    ],
    brown_spot: [
      {
        id: 'prod_4',
        name: 'Propiconazole 25% EC',
        type: 'fungicide',
        active_ingredient: 'Propiconazole',
        concentration: '25% EC',
        unit: 'ml/ha',
        price_per_unit: 650,
        currency: 'INR',
        supplier_ids: ['sup_1', 'sup_3'],
        application_method: 'spray',
        pre_harvest_interval_days: 25,
        re_entry_interval_hours: 24,
      },
    ],
  };

  const products = commonProducts[diseaseId] || [
    {
      id: 'prod_default',
      name: 'Copper Oxychloride 50% WP',
      type: 'fungicide',
      active_ingredient: 'Copper Oxychloride',
      concentration: '50% WP',
      unit: 'g/ha',
      price_per_unit: 320,
      currency: 'INR',
      supplier_ids: ['sup_1'],
      application_method: 'spray',
      pre_harvest_interval_days: 20,
      re_entry_interval_hours: 24,
    },
  ];

  // Generate steps based on severity
  const applicationCount = severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
  const intervalDays = severity === 'high' ? 7 : severity === 'medium' ? 10 : 14;

  const steps: TreatmentStep[] = [];
  for (let i = 0; i < applicationCount; i++) {
    const day = i * intervalDays + 1;
    products.forEach((product, pIndex) => {
      steps.push({
        id: `step_${i}_${pIndex}`,
        order: i * products.length + pIndex + 1,
        title: `Application ${i + 1}: ${product.name}`,
        description: `Apply ${product.name} at ${getDosage(product, severity)} ${product.unit} per hectare. ${getApplicationNotes(product, cropId)}`,
        product_id: product.id,
        product_name: product.name,
        dosage: getDosage(product, severity),
        timing: `Day ${day}`,
        duration_days: intervalDays,
        safety_notes: `Pre-harvest interval: ${product.pre_harvest_interval_days} days. Re-entry interval: ${product.re_entry_interval_hours} hours. Wear protective gear.`,
        completed: false,
      });
    });
  }

  const totalCost = products.reduce((sum, p) => sum + p.price_per_unit * applicationCount, 0);

  return {
    disease_id: diseaseId,
    disease_name: diseaseName,
    severity,
    steps,
    products,
    total_estimated_cost: totalCost,
    currency: 'INR',
    duration_days: (applicationCount - 1) * intervalDays + 7,
    follow_up_schedule: [
      { day: 3, description: 'Check for initial response to treatment' },
      { day: 7, description: 'Monitor disease progression; consider second application if needed' },
      { day: 14, description: 'Assess treatment efficacy; plan next steps' },
      { day: 21, description: 'Final evaluation before harvest interval' },
    ],
  };
}

function getDosage(product: TreatmentProduct, severity: 'low' | 'medium' | 'high'): string {
  const baseDosage = {
    'g/ha': severity === 'high' ? '500' : severity === 'medium' ? '400' : '300',
    'ml/ha': severity === 'high' ? '1000' : severity === 'medium' ? '750' : '500',
  };
  return baseDosage[product.unit as keyof typeof baseDosage] || '500';
}

function getApplicationNotes(product: TreatmentProduct, cropId: string): string {
  const notes = [
    `Apply during early morning or late evening`,
    `Use minimum 200L water per hectare`,
    `Do not mix with alkaline products`,
  ];
  if (cropId === 'rice') {
    notes.push('Maintain 3-5cm standing water during application');
  }
  return notes.join('. ') + '.';
}

// Treatment Cost Calculator Hook
export function useTreatmentCostCalculator() {
  const calculateCost = useCallback((
    products: TreatmentProduct[],
    areaHectares: number,
    applications: number
  ): { totalCost: number; breakdown: Array<{ product: string; quantity: number; cost: number }> } => {
    const breakdown = products.map(product => {
      const quantity = parseFloat(getDosage(product, 'medium')) * areaHectares * applications;
      const cost = quantity * product.price_per_unit;
      return {
        product: product.name,
        quantity,
        cost,
      };
    });

    const totalCost = breakdown.reduce((sum, b) => sum + b.cost, 0);

    return { totalCost, breakdown };
  }, []);

  return { calculateCost };
}

// Follow-up Reminders Hook
export function useTreatmentReminders(fieldId: string) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReminders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRemindersByField(fieldId);
      setReminders(data.filter(r => r.type === 'treatment_followup'));
    } catch (err) {
      console.error('Failed to load reminders:', err);
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  const snoozeReminder = useCallback(async (reminderId: string, minutes: number = 60): Promise<void> => {
    const newTime = new Date(Date.now() + minutes * 60 * 1000);
    try {
      // Update reminder in database
      // This would need an updateReminder function in database.ts
    } catch (err) {
      console.error('Failed to snooze reminder:', err);
    }
  }, []);

  const completeReminder = useCallback(async (reminderId: string): Promise<void> => {
    try {
      // Update reminder in database
    } catch (err) {
      console.error('Failed to complete reminder:', err);
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  return {
    reminders,
    loading,
    snoozeReminder,
    completeReminder,
    refresh: loadReminders,
  };
}