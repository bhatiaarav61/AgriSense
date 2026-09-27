/**
 * SQLite Database Service for Offline-First Architecture
 * Handles all local data persistence for the farmer app
 */

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// Database instance
const dbName = 'agrisense.db';
let db: SQLite.SQLiteDatabase | null = null;

// Types
export interface Field {
  id: string;
  name: string;
  crop_id: string;
  crop_name?: string;
  area_hectares: number;
  latitude: number;
  longitude: number;
  boundary_points?: string; // JSON string of polygon points
  soil_type?: string;
  irrigation_type?: 'rainfed' | 'irrigated' | 'partial';
  planting_date?: string; // YYYY-MM-DD
  expected_harvest_date?: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
  synced: number; // 0 = not synced, 1 = synced
}

export interface Scan {
  id: string;
  field_id: string | null;
  image_uri: string;
  image_thumbnail_uri?: string;
  disease_id: string | null;
  disease_name?: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'unknown';
  latitude: number | null;
  longitude: number | null;
  location_name?: string;
  inference_time_ms: number;
  source: 'edge' | 'cloud' | 'hybrid';
  notes?: string;
  created_at: string;
  synced: number;
  uploaded_at?: string;
}

export interface Treatment {
  id: string;
  scan_id: string;
  disease_id: string;
  treatment_plan: string; // JSON string of step-by-step plan
  products: string; // JSON string of required products
  estimated_cost: number;
  currency: string;
  supplier_ids: string; // JSON string of supplier IDs
  started_at?: string;
  completed_at?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  synced: number;
}

export interface InputRecord {
  id: string;
  field_id: string;
  type: 'seed' | 'fertilizer' | 'pesticide' | 'herbicide' | 'other';
  product_name: string;
  brand?: string;
  quantity: number;
  unit: string; // kg, liters, bags, etc.
  cost_per_unit: number;
  total_cost: number;
  currency: string;
  application_date: string; // YYYY-MM-DD
  growth_stage?: string;
  notes?: string;
  created_at: string;
  synced: number;
}

export interface ExpenseRecord {
  id: string;
  field_id: string;
  category: 'inputs' | 'labor' | 'machinery' | 'irrigation' | 'transport' | 'other';
  description: string;
  amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  receipt_image_uri?: string;
  notes?: string;
  created_at: string;
  synced: number;
}

export interface YieldRecord {
  id: string;
  field_id: string;
  season: string;
  harvest_date: string; // YYYY-MM-DD
  quantity: number;
  unit: string; // kg, tons, bags
  quality_grade?: string;
  moisture_content?: number;
  price_per_unit?: number;
  total_revenue?: number;
  currency: string;
  notes?: string;
  created_at: string;
  synced: number;
}

export interface Reminder {
  id: string;
  field_id: string | null;
  type: 'treatment_followup' | 'planting' | 'harvest' | 'fertilizer' | 'pesticide' | 'irrigation' | 'weather_alert' | 'custom';
  title: string;
  description?: string;
  scheduled_at: string; // ISO datetime
  completed_at?: string;
  status: 'pending' | 'completed' | 'snoozed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  notification_id?: string; // For OS notifications
  recurrence?: string; // Cron-like or 'none'
  metadata?: string; // JSON
  created_at: string;
  synced: number;
}

export interface OfflineQueueItem {
  id: string;
  type: 'scan' | 'field' | 'treatment' | 'input' | 'expense' | 'yield' | 'reminder';
  action: 'create' | 'update' | 'delete';
  entity_id: string;
  payload: string; // JSON string
  retry_count: number;
  max_retries: number;
  last_error?: string;
  created_at: string;
  last_attempt_at?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

export interface Supplier {
  id: string;
  name: string;
  type: 'agro_dealer' | 'cooperative' | 'government' | 'online';
  phone?: string;
  email?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  products: string; // JSON string of product IDs they sell
  rating?: number;
  verified: number;
  region_id: string;
  created_at: string;
  synced: number;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  type: 'disease_report' | 'treatment_success' | 'market_price' | 'question' | 'general';
  title: string;
  content: string;
  image_uris?: string; // JSON array
  disease_id?: string;
  crop_id?: string;
  region_id: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  likes_count: number;
  comments_count: number;
  is_pinned: number;
  created_at: string;
  synced: number;
}

export interface DiseaseAlert {
  id: string;
  disease_id: string;
  disease_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region_id: string;
  affected_area_km2?: number;
  reported_by: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  description?: string;
  recommendations?: string;
  expires_at: string; // ISO datetime
  is_active: number;
  created_at: string;
  synced: number;
}

export interface CachedModel {
  id: string;
  region_id: string;
  version: string;
  model_path: string;
  metadata_path: string;
  labels_path: string;
  size_bytes: number;
  downloaded_at: string;
  last_used_at: string;
  is_active: number;
}

/**
 * Initialize database connection
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  if (Platform.OS === 'web') {
    // Web doesn't support expo-sqlite, use a mock
    throw new Error('SQLite not supported on web');
  }

  db = await SQLite.openDatabaseAsync(dbName);
  await runMigrations(db);
  return db;
}

/**
 * Run database migrations
 */
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Enable foreign keys
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.execAsync('PRAGMA journal_mode = WAL;');

  // Migration 1: Create all tables
  await database.execAsync(`
    -- Fields table
    CREATE TABLE IF NOT EXISTS fields (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      crop_id TEXT NOT NULL,
      crop_name TEXT,
      area_hectares REAL NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      boundary_points TEXT,
      soil_type TEXT,
      irrigation_type TEXT,
      planting_date TEXT,
      expected_harvest_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );

    -- Scans table
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      field_id TEXT,
      image_uri TEXT NOT NULL,
      image_thumbnail_uri TEXT,
      disease_id TEXT,
      disease_name TEXT,
      confidence REAL NOT NULL,
      severity TEXT NOT NULL DEFAULT 'unknown',
      latitude REAL,
      longitude REAL,
      location_name TEXT,
      inference_time_ms INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'cloud',
      notes TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      uploaded_at TEXT,
      FOREIGN KEY (field_id) REFERENCES fields (id) ON DELETE SET NULL
    );

    -- Treatments table
    CREATE TABLE IF NOT EXISTS treatments (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      disease_id TEXT NOT NULL,
      treatment_plan TEXT NOT NULL,
      products TEXT NOT NULL,
      estimated_cost REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      supplier_ids TEXT,
      started_at TEXT,
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (scan_id) REFERENCES scans (id) ON DELETE CASCADE
    );

    -- Input records table
    CREATE TABLE IF NOT EXISTS input_records (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL,
      type TEXT NOT NULL,
      product_name TEXT NOT NULL,
      brand TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      cost_per_unit REAL NOT NULL,
      total_cost REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      application_date TEXT NOT NULL,
      growth_stage TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (field_id) REFERENCES fields (id) ON DELETE CASCADE
    );

    -- Expense records table
    CREATE TABLE IF NOT EXISTS expense_records (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      date TEXT NOT NULL,
      receipt_image_uri TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (field_id) REFERENCES fields (id) ON DELETE CASCADE
    );

    -- Yield records table
    CREATE TABLE IF NOT EXISTS yield_records (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL,
      season TEXT NOT NULL,
      harvest_date TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      quality_grade TEXT,
      moisture_content REAL,
      price_per_unit REAL,
      total_revenue REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      notes TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (field_id) REFERENCES fields (id) ON DELETE CASCADE
    );

    -- Reminders table
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      field_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      scheduled_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      notification_id TEXT,
      recurrence TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (field_id) REFERENCES fields (id) ON DELETE SET NULL
    );

    -- Offline queue table
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      last_error TEXT,
      created_at TEXT NOT NULL,
      last_attempt_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    -- Suppliers table
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      latitude REAL,
      longitude REAL,
      products TEXT,
      rating REAL,
      verified INTEGER DEFAULT 0,
      region_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );

    -- Community posts table
    CREATE TABLE IF NOT EXISTS community_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_uris TEXT,
      disease_id TEXT,
      crop_id TEXT,
      region_id TEXT NOT NULL,
      location_name TEXT,
      latitude REAL,
      longitude REAL,
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );

    -- Disease alerts table
    CREATE TABLE IF NOT EXISTS disease_alerts (
      id TEXT PRIMARY KEY,
      disease_id TEXT NOT NULL,
      disease_name TEXT NOT NULL,
      severity TEXT NOT NULL,
      region_id TEXT NOT NULL,
      affected_area_km2 REAL,
      reported_by TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_km REAL NOT NULL,
      description TEXT,
      recommendations TEXT,
      expires_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );

    -- Cached models table
    CREATE TABLE IF NOT EXISTS cached_models (
      id TEXT PRIMARY KEY,
      region_id TEXT NOT NULL,
      version TEXT NOT NULL,
      model_path TEXT NOT NULL,
      metadata_path TEXT NOT NULL,
      labels_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      downloaded_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 0
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_scans_field_id ON scans(field_id);
    CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scans_synced ON scans(synced);
    CREATE INDEX IF NOT EXISTS idx_treatments_scan_id ON treatments(scan_id);
    CREATE INDEX IF NOT EXISTS idx_input_records_field_id ON input_records(field_id);
    CREATE INDEX IF NOT EXISTS idx_expense_records_field_id ON expense_records(field_id);
    CREATE INDEX IF NOT EXISTS idx_yield_records_field_id ON yield_records(field_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_field_id ON reminders(field_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_at ON reminders(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
    CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_queue(status);
    CREATE INDEX IF NOT EXISTS idx_community_posts_region_id ON community_posts(region_id);
    CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_disease_alerts_region_id ON disease_alerts(region_id);
    CREATE INDEX IF NOT EXISTS idx_disease_alerts_is_active ON disease_alerts(is_active);
  `);
}

/**
 * Get database instance (initializes if needed)
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// ============================================================
// Field Operations
// ============================================================

export async function createField(field: Omit<Field, 'id' | 'created_at' | 'updated_at' | 'synced'>): Promise<string> {
  const database = await getDb();
  const id = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO fields (id, name, crop_id, crop_name, area_hectares, latitude, longitude, boundary_points, soil_type, irrigation_type, planting_date, expected_harvest_date, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, field.name, field.crop_id, field.crop_name, field.area_hectares, field.latitude, field.longitude,
     field.boundary_points, field.soil_type, field.irrigation_type, field.planting_date, field.expected_harvest_date, now, now]
  );

  await addToOfflineQueue('field', 'create', id, field);
  return id;
}

export async function updateField(id: string, updates: Partial<Field>): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();

  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'synced');
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as any)[f]);
  values.push(now, id);

  await database.runAsync(
    `UPDATE fields SET ${setClause}, updated_at = ? WHERE id = ?`,
    values
  );

  await addToOfflineQueue('field', 'update', id, updates);
}

export async function deleteField(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM fields WHERE id = ?', [id]);
  await addToOfflineQueue('field', 'delete', id, { id });
}

export async function getFields(): Promise<Field[]> {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM fields ORDER BY created_at DESC');
}

export async function getField(id: string): Promise<Field | null> {
  const database = await getDb();
  return database.getFirstAsync('SELECT * FROM fields WHERE id = ?', [id]);
}

export async function getFieldsByCrop(cropId: string): Promise<Field[]> {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM fields WHERE crop_id = ? ORDER BY created_at DESC', [cropId]);
}

// ============================================================
// Scan Operations
// ============================================================

export async function createScan(scan: Omit<Scan, 'id' | 'created_at' | 'synced' | 'uploaded_at'>): Promise<string> {
  const database = await getDb();
  const id = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO scans (id, field_id, image_uri, image_thumbnail_uri, disease_id, disease_name, confidence, severity, latitude, longitude, location_name, inference_time_ms, source, notes, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, scan.field_id, scan.image_uri, scan.image_thumbnail_uri, scan.disease_id, scan.disease_name, scan.confidence,
     scan.severity, scan.latitude, scan.longitude, scan.location_name, scan.inference_time_ms, scan.source, scan.notes, now]
  );

  await addToOfflineQueue('scan', 'create', id, scan);
  return id;
}

export async function updateScan(id: string, updates: Partial<Scan>): Promise<void> {
  const database = await getDb();
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'synced');
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as any)[f]);
  values.push(id);

  await database.runAsync(`UPDATE scans SET ${setClause} WHERE id = ?`, values);
  await addToOfflineQueue('scan', 'update', id, updates);
}

export async function markScanSynced(id: string): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync('UPDATE scans SET synced = 1, uploaded_at = ? WHERE id = ?', [now, id]);
}

export async function getScans(limit = 50, offset = 0): Promise<Scan[]> {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM scans ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
}

export async function getScan(id: string): Promise<Scan | null> {
  const database = await getDb();
  return database.getFirstAsync('SELECT * FROM scans WHERE id = ?', [id]);
}

export async function getScansByField(fieldId: string): Promise<Scan[]> {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM scans WHERE field_id = ? ORDER BY created_at DESC', [fieldId]);
}

export async function getUnsyncedScans(): Promise<Scan[]> {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM scans WHERE synced = 0 ORDER BY created_at ASC');
}

// ============================================================
// Treatment Operations
// ============================================================

export async function createTreatment(treatment: Omit<Treatment, 'id' | 'created_at' | 'updated_at' | 'synced'>): Promise<string> {
  const database = await getDb();
  const id = `treatment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO treatments (id, scan_id, disease_id, treatment_plan, products, estimated_cost, currency, supplier_ids, started_at, completed_at, status, notes, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, treatment.scan_id, treatment.disease_id, treatment.treatment_plan, treatment.products, treatment.estimated_cost,
     treatment.currency, treatment.supplier_ids, treatment.started_at, treatment.completed_at, treatment.status, treatment.notes, now, now]
  );

  await addToOfflineQueue('treatment', 'create', id, treatment);
  return id;
}

export async function updateTreatment(id: string, updates: Partial<Treatment>): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'synced');
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as any)[f]);
  values.push(now, id);

  await database.runAsync(`UPDATE treatments SET ${setClause}, updated_at = ? WHERE id = ?`, values);
  await addToOfflineQueue('treatment', 'update', id, updates);
}

export async function getTreatment(scanId: string): Promise<Treatment | null> {
  const database = await getDb();
  return database.getFirstAsync('SELECT * FROM treatments WHERE scan_id = ?', [scanId]);
}

export async function getTreatmentsByField(fieldId: string): Promise<Treatment[]> {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT t.* FROM treatments t
     JOIN scans s ON t.scan_id = s.id
     WHERE s.field_id = ?
     ORDER BY t.created_at DESC`,
    [fieldId]
  );
}

// ============================================================
// Input Records Operations
// ============================================================

export async function createInputRecord(input: Omit<InputRecord, 'id' | 'created_at' | 'synced'>): Promise<string> {
  const database = await getDb();
  const id = `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO input_records (id, field_id, type, product_name, brand, quantity, unit, cost_per_unit, total_cost, currency, application_date, growth_stage, notes, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, input.field_id, input.type, input.product_name, input.brand, input.quantity, input.unit,
     input.cost_per_unit, input.total_cost, input.currency, input.application_date, input.growth_stage, input.notes, now]
  );

  await addToOfflineQueue('input', 'create', id, input);
  return id;
}

export async function getInputRecordsByField(fieldId: string): Promise<InputRecord[]> {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM input_records WHERE field_id = ? ORDER BY application_date DESC', [fieldId]);
}

export async function getInputRecordsByFieldAndDateRange(fieldId: string, startDate: string, endDate: string): Promise<InputRecord[]> {
  const database = await getDb();
  return database.getAllAsync(
    'SELECT * FROM input_records WHERE field_id = ? AND application_date BETWEEN ? AND ? ORDER BY application_date DESC',
    [fieldId, startDate, endDate]
  );
}

// ============================================================
// Expense Records Operations
// ============================================================

export async function createExpenseRecord(expense: Omit<ExpenseRecord, 'id' | 'created_at' | 'synced'>): Promise<string> {
  const database = await getDb();
  const id = `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO expense_records (id, field_id, category, description, amount, currency, date, receipt_image_uri, notes, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, expense.field_id, expense.category, expense.description, expense.amount, expense.currency,
     expense.date, expense.receipt_image_uri, expense.notes, now]
  );

  await addToOfflineQueue('expense', 'create', id, expense);
  return id;
}

export async function getExpenseRecordsByField(fieldId: string): Promise<ExpenseRecord[]> {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM expense_records WHERE field_id = ? ORDER BY date DESC', [fieldId]);
}

export async function getExpenseSummaryByField(fieldId: string): Promise<{ total: number; byCategory: Record<string, number> }> {
  const database = await getDb();
  const expenses = await database.getAllAsync('SELECT category, amount FROM expense_records WHERE field_id = ?', [fieldId]);
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const exp of expenses) {
    byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
    total += exp.amount;
  }
  return { total, byCategory };
}

// ============================================================
// Yield Records Operations
// ============================================================

export async function createYieldRecord(yieldRecord: Omit<YieldRecord, 'id' | 'created_at' | 'synced'>): Promise<string> {
  const database = await getDb();
  const id = `yield_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO yield_records (id, field_id, season, harvest_date, quantity, unit, quality_grade, moisture_content, price_per_unit, total_revenue, currency, notes, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, yieldRecord.field_id, yieldRecord.season, yieldRecord.harvest_date, yieldRecord.quantity, yieldRecord.unit,
     yieldRecord.quality_grade, yieldRecord.moisture_content, yieldRecord.price_per_unit, yieldRecord.total_revenue,
     yieldRecord.currency, yieldRecord.notes, now]
  );

  await addToOfflineQueue('yield', 'create', id, yieldRecord);
  return id;
}

export async function getYieldRecordsByField(fieldId: string): Promise<YieldRecord[]> {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM yield_records WHERE field_id = ? ORDER BY harvest_date DESC', [fieldId]);
}

// ============================================================
// Reminder Operations
// ============================================================

export async function createReminder(reminder: Omit<Reminder, 'id' | 'created_at' | 'synced'>): Promise<string> {
  const database = await getDb();
  const id = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO reminders (id, field_id, type, title, description, scheduled_at, completed_at, status, priority, notification_id, recurrence, metadata, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, reminder.field_id, reminder.type, reminder.title, reminder.description, reminder.scheduled_at,
     reminder.completed_at, reminder.status, reminder.priority, reminder.notification_id, reminder.recurrence, reminder.metadata, now]
  );

  await addToOfflineQueue('reminder', 'create', id, reminder);
  return id;
}

export async function updateReminder(id: string, updates: Partial<Reminder>): Promise<void> {
  const database = await getDb();
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'synced');
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as any)[f]);
  values.push(id);

  await database.runAsync(`UPDATE reminders SET ${setClause} WHERE id = ?`, values);
  await addToOfflineQueue('reminder', 'update', id, updates);
}

export async function getPendingReminders(): Promise<Reminder[]> {
  const database = await getDb();
  const now = new Date().toISOString();
  return database.getAllAsync(
    'SELECT * FROM reminders WHERE status = "pending" AND scheduled_at <= ? ORDER BY scheduled_at ASC',
    [now]
  );
}

export async function getRemindersByField(fieldId: string): Promise<Reminder[]> {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM reminders WHERE field_id = ? ORDER BY scheduled_at ASC', [fieldId]);
}

// ============================================================
// Offline Queue Operations
// ============================================================

export async function addToOfflineQueue(
  type: OfflineQueueItem['type'],
  action: OfflineQueueItem['action'],
  entityId: string,
  payload: any
): Promise<void> {
  const database = await getDb();
  const id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO offline_queue (id, type, action, entity_id, payload, retry_count, max_retries, created_at, status)
     VALUES (?, ?, ?, ?, ?, 0, 3, ?, 'pending')`,
    [id, type, action, entityId, JSON.stringify(payload), now]
  );
}

export async function getPendingQueueItems(): Promise<OfflineQueueItem[]> {
  const database = await getDb();
  return database.getAllAsync(
    'SELECT * FROM offline_queue WHERE status = "pending" OR status = "failed" ORDER BY created_at ASC'
  );
}

export async function markQueueItemProcessing(id: string): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync('UPDATE offline_queue SET status = "processing", last_attempt_at = ? WHERE id = ?', [now, id]);
}

export async function markQueueItemCompleted(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('UPDATE offline_queue SET status = "completed" WHERE id = ?', [id]);
}

export async function markQueueItemFailed(id: string, error: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'UPDATE offline_queue SET status = "failed", retry_count = retry_count + 1, last_error = ? WHERE id = ?',
    [error, id]
  );
}

// ============================================================
// Supplier Operations
// ============================================================

export async function getSuppliersByRegion(regionId: string): Promise<Supplier[]> {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM suppliers WHERE region_id = ? ORDER BY rating DESC', [regionId]);
}

export async function getNearbySuppliers(latitude: number, longitude: number, radiusKm: number = 50): Promise<Supplier[]> {
  const database = await getDb();
  // Simple bounding box approximation
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

  return database.getAllAsync(
    `SELECT * FROM suppliers
     WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
     ORDER BY rating DESC`,
    [latitude - latDelta, latitude + latDelta, longitude - lonDelta, longitude + lonDelta]
  );
}

// ============================================================
// Community Posts Operations
// ============================================================

export async function createCommunityPost(post: Omit<CommunityPost, 'id' | 'created_at' | 'synced' | 'likes_count' | 'comments_count'>): Promise<string> {
  const database = await getDb();
  const id = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO community_posts (id, user_id, user_name, user_avatar, type, title, content, image_uris, disease_id, crop_id, region_id, location_name, latitude, longitude, likes_count, comments_count, is_pinned, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 0)`,
    [id, post.user_id, post.user_name, post.user_avatar, post.type, post.title, post.content, post.image_uris,
     post.disease_id, post.crop_id, post.region_id, post.location_name, post.latitude, post.longitude, now]
  );

  await addToOfflineQueue('post', 'create', id, post);
  return id;
}

export async function getCommunityPosts(regionId: string, limit = 20, offset = 0): Promise<CommunityPost[]> {
  const database = await getDb();
  return database.getAllAsync(
    'SELECT * FROM community_posts WHERE region_id = ? ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?',
    [regionId, limit, offset]
  );
}

// ============================================================
// Disease Alerts Operations
// ============================================================

export async function getActiveDiseaseAlerts(regionId: string): Promise<DiseaseAlert[]> {
  const database = await getDb();
  const now = new Date().toISOString();
  return database.getAllAsync(
    'SELECT * FROM disease_alerts WHERE region_id = ? AND is_active = 1 AND expires_at > ? ORDER BY severity DESC, created_at DESC',
    [regionId, now]
  );
}

export async function getNearbyDiseaseAlerts(latitude: number, longitude: number, radiusKm: number = 50): Promise<DiseaseAlert[]> {
  const database = await getDb();
  const now = new Date().toISOString();
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

  return database.getAllAsync(
    `SELECT * FROM disease_alerts
     WHERE is_active = 1 AND expires_at > ?
     AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
     ORDER BY severity DESC, created_at DESC`,
    [now, latitude - latDelta, latitude + latDelta, longitude - lonDelta, longitude + lonDelta]
  );
}

// ============================================================
// Cached Model Operations
// ============================================================

export async function cacheModel(model: Omit<CachedModel, 'id' | 'downloaded_at' | 'last_used_at' | 'is_active'>): Promise<string> {
  const database = await getDb();
  const id = `model_${model.region_id}_${model.version}`;
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT OR REPLACE INTO cached_models (id, region_id, version, model_path, metadata_path, labels_path, size_bytes, downloaded_at, last_used_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, model.region_id, model.version, model.model_path, model.metadata_path, model.labels_path, model.size_bytes, now, now]
  );

  return id;
}

export async function getCachedModel(regionId: string, version: string): Promise<CachedModel | null> {
  const database = await getDb();
  const id = `model_${regionId}_${version}`;
  return database.getFirstAsync('SELECT * FROM cached_models WHERE id = ?', [id]);
}

export async function getActiveModel(regionId: string): Promise<CachedModel | null> {
  const database = await getDb();
  return database.getFirstAsync('SELECT * FROM cached_models WHERE region_id = ? AND is_active = 1 ORDER BY downloaded_at DESC LIMIT 1', [regionId]);
}

export async function updateModelLastUsed(regionId: string, version: string): Promise<void> {
  const database = await getDb();
  const id = `model_${regionId}_${version}`;
  const now = new Date().toISOString();
  await database.runAsync('UPDATE cached_models SET last_used_at = ? WHERE id = ?', [now, id]);
}

// ============================================================
// Sync Operations
// ============================================================

export async function getUnsyncedCount(): Promise<{
  fields: number;
  scans: number;
  treatments: number;
  inputs: number;
  expenses: number;
  yields: number;
  reminders: number;
}> {
  const database = await getDb();

  const [fields, scans, treatments, inputs, expenses, yields, reminders] = await Promise.all([
    database.getFirstAsync('SELECT COUNT(*) as count FROM fields WHERE synced = 0'),
    database.getFirstAsync('SELECT COUNT(*) as count FROM scans WHERE synced = 0'),
    database.getFirstAsync('SELECT COUNT(*) as count FROM treatments WHERE synced = 0'),
    database.getFirstAsync('SELECT COUNT(*) as count FROM input_records WHERE synced = 0'),
    database.getFirstAsync('SELECT COUNT(*) as count FROM expense_records WHERE synced = 0'),
    database.getFirstAsync('SELECT COUNT(*) as count FROM yield_records WHERE synced = 0'),
    database.getFirstAsync('SELECT COUNT(*) as count FROM reminders WHERE synced = 0'),
  ]);

  return {
    fields: fields?.count || 0,
    scans: scans?.count || 0,
    treatments: treatments?.count || 0,
    inputs: inputs?.count || 0,
    expenses: expenses?.count || 0,
    yields: yields?.count || 0,
    reminders: reminders?.count || 0,
  };
}

export async function markEntitySynced(table: string, id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(`UPDATE ${table} SET synced = 1 WHERE id = ?`, [id]);
}

// ============================================================
// Export/Import for Backup
// ============================================================

export async function exportAllData(): Promise<string> {
  const database = await getDb();

  const tables = ['fields', 'scans', 'treatments', 'input_records', 'expense_records', 'yield_records', 'reminders', 'suppliers', 'community_posts', 'disease_alerts'];
  const data: Record<string, any[]> = {};

  for (const table of tables) {
    data[table] = await database.getAllAsync(`SELECT * FROM ${table}`);
  }

  return JSON.stringify({
    version: 1,
    exported_at: new Date().toISOString(),
    data,
  }, null, 2);
}

export async function importAllData(jsonData: string): Promise<void> {
  const database = await getDb();
  const parsed = JSON.parse(jsonData);

  await database.withTransactionAsync(async () => {
    for (const [table, rows] of Object.entries(parsed.data)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const columnNames = columns.join(', ');

      const stmt = await database.prepareAsync(`INSERT OR REPLACE INTO ${table} (${columnNames}) VALUES (${placeholders})`);

      for (const row of rows) {
        await stmt.executeAsync(columns.map(c => row[c]));
      }

      await stmt.finalizeAsync();
    }
  });
}

// ============================================================
// Utility
// ============================================================

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}