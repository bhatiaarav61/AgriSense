#!/usr/bin/env tsx
/**
 * Region Configuration Validator
 * Validates all YAML region configs against the schema
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { RegionConfigSchema } from '../packages/region-config/src/schema';

const REGIONS_DIR = path.resolve(__dirname, '../regions');

interface ValidationResult {
  file: string;
  valid: boolean;
  errors?: string[];
  regionId?: string;
}

function validateRegionFile(filePath: string): ValidationResult {
  const fileName = path.basename(filePath);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = yaml.load(content);

    const result = RegionConfigSchema.safeParse(config);

    if (result.success) {
      return {
        file: fileName,
        valid: true,
        regionId: result.data.id,
      };
    } else {
      return {
        file: fileName,
        valid: false,
        errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
  } catch (error) {
    return {
      file: fileName,
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

function main() {
  console.log('🔍 Validating region configurations...\n');

  if (!fs.existsSync(REGIONS_DIR)) {
    console.error(`❌ Regions directory not found: ${REGIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(REGIONS_DIR)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  if (files.length === 0) {
    console.log('⚠️  No region config files found');
    process.exit(0);
  }

  const results: ValidationResult[] = [];

  for (const file of files) {
    const filePath = path.join(REGIONS_DIR, file);
    const result = validateRegionFile(filePath);
    results.push(result);

    if (result.valid) {
      console.log(`✅ ${file} (region: ${result.regionId})`);
    } else {
      console.log(`❌ ${file}`);
      result.errors?.forEach(err => console.log(`   - ${err}`));
    }
  }

  const validCount = results.filter(r => r.valid).length;
  const invalidCount = results.filter(r => !r.valid).length;

  console.log(`\n📊 Summary: ${validCount} valid, ${invalidCount} invalid`);

  if (invalidCount > 0) {
    process.exit(1);
  }
}

main();