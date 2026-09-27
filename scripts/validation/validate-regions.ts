#!/usr/bin/env tsx
/**
 * Region Configuration Validator CLI
 * Validates all YAML region configs against the schema with advanced checks
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadAllRegionConfigs } from '../../packages/region-config/src/loaders/yaml-loader';
import { validateAllRegions, generateValidationReport } from '../../packages/region-config/src/validators/region-validator';

interface CLIOptions {
  regionsDir: string;
  output?: string;
  format: 'console' | 'json' | 'markdown';
  strict: boolean;
  fix: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    regionsDir: path.resolve(__dirname, '../../regions'),
    format: 'console',
    strict: false,
    fix: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dir':
      case '-d':
        options.regionsDir = path.resolve(args[++i]);
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--format':
      case '-f':
        options.format = args[++i] as any;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--fix':
        options.fix = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
AgriSense Region Configuration Validator

Usage: tsx validate-regions.ts [options]

Options:
  -d, --dir <path>       Regions directory (default: ./regions)
  -o, --output <path>    Output file path
  -f, --format <type>    Output format: console, json, markdown (default: console)
  --strict               Exit with error code on warnings
  --fix                  Attempt to auto-fix issues (experimental)
  -h, --help             Show this help

Examples:
  tsx validate-regions.ts
  tsx validate-regions.ts --dir ./regions --format json --output report.json
  tsx validate-regions.ts --strict --format markdown --output report.md
`);
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('🔍 AgriSense Region Configuration Validator');
  console.log('============================================\n');

  console.log(`📁 Regions directory: ${options.regionsDir}`);
  console.log(`📋 Format: ${options.format}`);
  if (options.strict) console.log('⚠️  Strict mode enabled');
  if (options.fix) console.log('🔧 Auto-fix enabled (experimental)');
  console.log('');

  try {
    // Validate all regions
    const { valid, invalid, results } = await validateAllRegions(options.regionsDir);

    // Generate report based on format
    let output: string;

    switch (options.format) {
      case 'json': {
        const jsonOutput = {
          timestamp: new Date().toISOString(),
          summary: {
            total: results.size,
            valid,
            invalid,
          },
          regions: Object.fromEntries(
            Array.from(results.entries()).map(([id, result]) => [
              id,
              {
                valid: result.valid,
                errors: result.errors,
                warnings: result.warnings,
                info: result.info,
              },
            ])
          ),
        };
        output = JSON.stringify(jsonOutput, null, 2);
        break;
      }

      case 'markdown':
        output = generateValidationReport(results);
        break;

      case 'console':
      default:
        // Print console summary
        console.log('📊 Validation Results:');
        console.log('======================\n');

        let totalErrors = 0;
        let totalWarnings = 0;

        for (const [regionId, result] of results) {
          const status = result.valid ? '✅' : '❌';
          console.log(`${status} ${regionId}: ${result.errors.length} errors, ${result.warnings.length} warnings`);

          if (result.errors.length > 0) {
            for (const err of result.errors) {
              console.log(`  ❌ [${err.code}] ${err.path}: ${err.message}`);
            }
          }

          if (result.warnings.length > 0) {
            for (const warn of result.warnings) {
              console.log(`  ⚠️  [${warn.code}] ${warn.path}: ${warn.message}`);
            }
          }
        }

        const totalErrors = Array.from(results.values()).reduce((sum, r) => sum + r.errors.length, 0);
        const totalWarnings = Array.from(results.values()).reduce((sum, r) => sum + r.warnings.length, 0);

        console.log('\n📊 Summary:');
        console.log(`  Total regions: ${results.size}`);
        console.log(`  Valid: ${Array.from(results.values()).filter(r => r.valid).length}`);
        console.log(`  Invalid: ${Array.from(results.values()).filter(r => !r.valid).length}`);
        console.log(`  Total errors: ${totalErrors}`);
        console.log(`  Total warnings: ${totalWarnings}`);

        if (options.output) {
          output = generateValidationReport(results);
        }
        break;
    }

    // Write output file if specified
    if (options.output) {
      fs.writeFileSync(options.output, output);
      console.log(`\n💾 Report saved to: ${options.output}`);
    }

    // Exit with appropriate code
    const hasErrors = Array.from(results.values()).some(r => r.errors.length > 0);
    const hasWarnings = Array.from(results.values()).some(r => r.warnings.length > 0);

    if (hasErrors) {
      console.log('\n❌ Validation failed with errors');
      process.exit(1);
    } else if (hasWarnings && options.strict) {
      console.log('\n⚠️  Validation passed with warnings (strict mode)');
      process.exit(1);
    } else {
      console.log('\n✅ Validation passed');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  }
}

main();