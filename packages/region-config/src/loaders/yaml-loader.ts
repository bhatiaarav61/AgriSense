import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { RegionConfig, validateRegionConfig, safeValidateRegionConfig } from './schema';

/**
 * Load a region configuration from a YAML file
 */
export function loadRegionConfig(filePath: string): RegionConfig {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Region config file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const config = yaml.load(content);

  return validateRegionConfig(config);
}

/**
 * Load a region configuration safely (returns result object)
 */
export function safeLoadRegionConfig(filePath: string): { success: boolean; data?: RegionConfig; error?: Error } {
  try {
    const data = loadRegionConfig(filePath);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

/**
 * Load all region configurations from a directory
 */
export function loadAllRegionConfigs(dirPath: string): Map<string, RegionConfig> {
  const absolutePath = path.resolve(dirPath);
  const regions = new Map<string, RegionConfig>();

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Regions directory not found: ${absolutePath}`);
  }

  const files = fs.readdirSync(absolutePath)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of files) {
    const filePath = path.join(absolutePath, file);
    const result = safeLoadRegionConfig(filePath);

    if (result.success && result.data) {
      regions.set(result.data.id, result.data);
    } else {
      console.warn(`Failed to load region config ${file}:`, result.error?.message);
    }
  }

  return regions;
}

/**
 * Validate all region configs in a directory and return errors
 */
export function validateAllRegionConfigs(dirPath: string): { valid: Map<string, RegionConfig>; invalid: Map<string, Error> } {
  const absolutePath = path.resolve(dirPath);
  const valid = new Map<string, RegionConfig>();
  const invalid = new Map<string, Error>();

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Regions directory not found: ${absolutePath}`);
  }

  const files = fs.readdirSync(absolutePath)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of files) {
    const filePath = path.join(absolutePath, file);
    const result = safeLoadRegionConfig(filePath);

    if (result.success && result.data) {
      valid.set(result.data.id, result.data);
    } else {
      invalid.set(file, result.error!);
    }
  }

  return { valid, invalid };
}