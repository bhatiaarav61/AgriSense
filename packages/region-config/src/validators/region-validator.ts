/**
 * Region Configuration Validator
 * Advanced validation for region configs with cross-references
 */

import { RegionConfig, RegionConfigSchema, Crop, Disease, Provider } from '../schemas/region-schema';
import { safeValidateRegionConfig } from '../schemas/region-schema';

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
}

export class RegionValidator {
  private region: RegionConfig;

  constructor(region: RegionConfig) {
    this.region = region;
  }

  /**
   * Validate a region config with all checks
   */
  validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const info: ValidationError[] = [];

    // 1. Schema validation
    const schemaResult = safeValidateRegionConfig(this.region);
    if (!schemaResult.success) {
      for (const err of schemaResult.error.errors) {
        errors.push({
          path: err.path.join('.'),
          message: err.message,
          severity: 'error',
          code: 'SCHEMA_VALIDATION',
        });
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings, info };
    }

    // 2. Cross-reference validation
    this.validateCrossReferences(errors, warnings);

    // 3. Provider validation
    this.validateProviders(errors, warnings);

    // 4. Prompt template validation
    this.validatePromptTemplates(errors, warnings);

    // 5. Model config validation
    this.validateModelConfig(errors, warnings);

    // 6. Localization completeness
    this.validateLocalization(errors, warnings, info);

    // 7. Disease severity consistency
    this.validateDiseaseSeverity(errors, warnings);

    // 8. Crop growing seasons
    this.validateGrowingSeasons(errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
    };
  }

  /**
   * Validate cross-references between crops and diseases
   */
  private validateCrossReferences(errors: ValidationError[], warnings: ValidationError[]): void {
    const cropIds = new Set(this.region.crops.map(c => c.id));
    const diseaseIds = new Set(this.region.diseases.map(d => d.id));

    // Check crop references in diseases
    for (const disease of this.region.diseases) {
      for (const cropId of disease.cropIds) {
        if (!cropIds.has(cropId)) {
          errors.push({
            path: `diseases.${disease.id}.cropIds`,
            message: `Disease references unknown crop: ${cropId}`,
            severity: 'error',
            code: 'UNKNOWN_CROP_REFERENCE',
          });
        }
      }
    }

    // Check disease references in crops
    for (const crop of this.region.crops) {
      for (const diseaseId of crop.diseaseClasses) {
        if (!diseaseIds.has(diseaseId)) {
          warnings.push({
            path: `crops.${crop.id}.diseaseClasses`,
            message: `Crop references unknown disease: ${diseaseId}`,
            severity: 'warning',
            code: 'UNKNOWN_DISEASE_REFERENCE',
          });
        }
      }
    }

    // Check for diseases with no crops
    for (const disease of this.region.diseases) {
      if (disease.cropIds.length === 0) {
        warnings.push({
          path: `diseases.${disease.id}.cropIds`,
          message: 'Disease has no associated crops',
          severity: 'warning',
          code: 'DISEASE_NO_CROPS',
        });
      }
    }

    // Check for crops with no diseases
    for (const crop of this.region.crops) {
      if (crop.diseaseClasses.length === 0) {
        info.push({
          path: `crops.${crop.id}.diseaseClasses`,
          message: 'Crop has no associated diseases',
          severity: 'info',
          code: 'CROP_NO_DISEASES',
        });
      }
    }
  }

  /**
   * Validate providers configuration
   */
  private validateProviders(errors: ValidationError[], warnings: ValidationError[]): void {
    const enabledProviders = this.region.providers.filter(p => p.enabled);

    if (enabledProviders.length === 0) {
      errors.push({
        path: 'providers',
        message: 'No enabled providers configured',
        severity: 'error',
        code: 'NO_ENABLED_PROVIDERS',
      });
      return;
    }

    // Check provider coverage for each task type
    const taskTypes = ['disease-detection', 'yield-prediction', 'advisory', 'chat'] as const;

    for (const taskType of taskTypes) {
      const providersForTask = enabledProviders.filter(p =>
        Object.values(p.models).some(m => m.taskTypes.includes(taskType))
      );

      if (providersForTask.length === 0) {
        errors.push({
          path: 'providers',
          message: `No providers available for task: ${taskType}`,
          severity: 'error',
          code: 'NO_PROVIDER_FOR_TASK',
        });
      } else if (providersForTask.length === 1) {
        warnings.push({
          path: 'providers',
          message: `Only one provider for task ${taskType}: ${providersForTask[0].id}`,
          severity: 'warning',
          code: 'SINGLE_PROVIDER_FOR_TASK',
        });
      }
    }

    // Check for duplicate provider IDs
    const providerIds = new Set<string>();
    for (const provider of this.region.providers) {
      if (providerIds.has(provider.id)) {
        errors.push({
          path: `providers.${provider.id}`,
          message: `Duplicate provider ID: ${provider.id}`,
          severity: 'error',
          code: 'DUPLICATE_PROVIDER_ID',
        });
      }
      providerIds.add(provider.id);
    }

    // Check API key env vars
    for (const provider of enabledProviders) {
      const envVar = provider.apiKeyEnvVar;
      if (!process.env[envVar]) {
        warnings.push({
          path: `providers.${provider.id}.apiKeyEnvVar`,
          message: `API key environment variable not set: ${envVar}`,
          severity: 'warning',
          code: 'MISSING_API_KEY',
        });
      }
    }
  }

  /**
   * Validate prompt templates
   */
  private validatePromptTemplates(errors: ValidationError[], warnings: ValidationError[]): void {
    const taskTypes = ['disease-detection', 'yield-prediction', 'advisory', 'chat'] as const;
    const languages = this.region.languages.map(l => l.code);

    for (const taskType of taskTypes) {
      for (const language of languages) {
        const template = this.region.promptTemplates.find(
          t => t.taskType === taskType && t.language === language
        );

        if (!template) {
          warnings.push({
            path: `promptTemplates`,
            message: `Missing prompt template for task ${taskType} in language ${language}`,
            severity: 'warning',
            code: 'MISSING_PROMPT_TEMPLATE',
          });
        } else {
          // Check for required placeholders
          const requiredPlaceholders = this.getRequiredPlaceholders(taskType);
          for (const placeholder of requiredPlaceholders) {
            if (!template.userPromptTemplate.includes(`{${placeholder}}`)) {
              warnings.push({
                path: `promptTemplates.${template.id}`,
                message: `Missing placeholder {${placeholder}} in template`,
                severity: 'warning',
                code: 'MISSING_PLACEHOLDER',
              });
            }
          }
        }
      }
    }
  }

  private getRequiredPlaceholders(taskType: string): string[] {
    switch (taskType) {
      case 'disease-detection':
        return ['crop', 'region', 'disease_list'];
      case 'yield-prediction':
        return ['crop', 'region', 'season', 'weather'];
      case 'advisory':
        return ['disease', 'crop', 'region', 'severity'];
      case 'chat':
        return [];
      default:
        return [];
    }
  }

  /**
   * Validate model configuration
   */
  private validateModelConfig(errors: ValidationError[], warnings: ValidationError[]): void {
    const { edgeModelUrl, edgeModelHash, edgeModelVersion, inputSize, confidenceThreshold, topK } = this.region.modelConfig;

    // Validate URL
    try {
      new URL(edgeModelUrl);
      if (!edgeModelUrl.startsWith('https://')) {
        warnings.push({
          path: 'modelConfig.edgeModelUrl',
          message: 'Model URL should use HTTPS',
          severity: 'warning',
          code: 'MODEL_URL_NOT_HTTPS',
        });
      }
    } catch {
      errors.push({
        path: 'modelConfig.edgeModelUrl',
        message: 'Invalid model URL',
        severity: 'error',
        code: 'INVALID_MODEL_URL',
      });
    }

    // Validate hash format
    if (edgeModelHash && !edgeModelHash.match(/^sha256:[a-f0-9]{64}$/)) {
      warnings.push({
        path: 'modelConfig.edgeModelHash',
        message: 'Model hash should be in format "sha256:<64 hex chars>"',
        severity: 'warning',
        code: 'INVALID_MODEL_HASH_FORMAT',
      });
    }

    // Validate version format
    if (edgeModelVersion && !edgeModelVersion.match(/^v\d+\.\d+\.\d+$/)) {
      warnings.push({
        path: 'modelConfig.edgeModelVersion',
        message: 'Model version should follow semantic versioning (vX.Y.Z)',
        severity: 'warning',
        code: 'INVALID_VERSION_FORMAT',
      });
    }

    // Validate input size
    if (inputSize !== 224 && inputSize !== 299 && inputSize !== 384 && inputSize !== 512) {
      warnings.push({
        path: 'modelConfig.inputSize',
        message: `Unusual input size: ${inputSize}. Common sizes: 224, 299, 384, 512`,
        severity: 'warning',
        code: 'UNUSUAL_INPUT_SIZE',
      });
    }

    // Validate confidence threshold
    if (confidenceThreshold < 0.5 || confidenceThreshold > 0.95) {
      warnings.push({
        path: 'modelConfig.confidenceThreshold',
        message: `Confidence threshold ${confidenceThreshold} outside recommended range [0.5, 0.95]`,
        severity: 'warning',
        code: 'CONFIDENCE_THRESHOLD_RANGE',
      });
    }

    // Validate topK
    if (topK < 1 || topK > 20) {
      warnings.push({
        path: 'modelConfig.topK',
        message: `topK value ${topK} outside recommended range [1, 20]`,
        severity: 'warning',
        code: 'TOPK_RANGE',
      });
    }
  }

  /**
   * Validate localization completeness
   */
  private validateLocalization(
    errors: ValidationError[],
    warnings: ValidationError[],
    info: ValidationError[]
  ): void {
    const languageCodes = this.region.languages.map(l => l.code);
    const defaultLang = this.region.defaultLanguage;

    // Check default language is in supported languages
    if (!languageCodes.includes(defaultLang)) {
      errors.push({
        path: 'defaultLanguage',
        message: `Default language ${defaultLang} not in supported languages`,
        severity: 'error',
        code: 'DEFAULT_LANGUAGE_MISSING',
      });
    }

    // Check crop local names
    for (const crop of this.region.crops) {
      for (const lang of languageCodes) {
        if (!crop.localNames[lang]) {
          warnings.push({
            path: `crops.${crop.id}.localNames.${lang}`,
            message: `Missing local name for language: ${lang}`,
            severity: 'warning',
            code: 'MISSING_CROP_LOCAL_NAME',
          });
        }
      }
    }

    // Check disease local names
    for (const disease of this.region.diseases) {
      for (const lang of languageCodes) {
        if (!disease.localNames[lang]) {
          warnings.push({
            path: `diseases.${disease.id}.localNames.${lang}`,
            message: `Missing local name for language: ${lang}`,
            severity: 'warning',
            code: 'MISSING_DISEASE_LOCAL_NAME',
          });
        }
      }
    }

    // Check prompt template languages
    for (const lang of languageCodes) {
      const hasTemplates = this.region.promptTemplates.some(t => t.language === lang);
      if (!hasTemplates && lang !== defaultLang) {
        info.push({
          path: 'promptTemplates',
          message: `No prompt templates for language: ${lang}`,
          severity: 'info',
          code: 'NO_TEMPLATES_FOR_LANGUAGE',
        });
      }
    }
  }

  /**
   * Validate disease severity consistency
   */
  private validateDiseaseSeverity(errors: ValidationError[], warnings: ValidationError[]): void {
    for (const disease of this.region.diseases) {
      // Check severity levels are valid
      const validSeverities = ['low', 'medium', 'high'];
      for (const severity of disease.severityLevels) {
        if (!validSeverities.includes(severity)) {
          errors.push({
            path: `diseases.${disease.id}.severityLevels`,
            message: `Invalid severity level: ${severity}`,
            severity: 'error',
            code: 'INVALID_SEVERITY_LEVEL',
          });
        }
      }

      // Check confidence threshold matches severity
      if (disease.confidenceThreshold && disease.severityLevels.includes('high')) {
        if (disease.confidenceThreshold < 0.8) {
          warnings.push({
            path: `diseases.${disease.id}.confidenceThreshold`,
            message: 'High severity disease should have confidence threshold >= 0.8',
            severity: 'warning',
            code: 'HIGH_SEVERITY_LOW_THRESHOLD',
          });
        }
      }
    }
  }

  /**
   * Validate growing seasons
   */
  private validateGrowingSeasons(errors: ValidationError[], warnings: ValidationError[]): void {
    const knownSeasons = [
      'kharif', 'rabi', 'zaid', 'spring', 'summer', 'autumn', 'winter',
      'early', 'late', 'dry-season', 'wet-season', 'annual'
    ];

    for (const crop of this.region.crops) {
      for (const season of crop.growingSeasons) {
        if (!knownSeasons.includes(season)) {
          warnings.push({
            path: `crops.${crop.id}.growingSeasons`,
            message: `Unknown growing season: ${season}`,
            severity: 'warning',
            code: 'UNKNOWN_GROWING_SEASON',
          });
        }
      }

      if (crop.growingSeasons.length === 0) {
        warnings.push({
          path: `crops.${crop.id}.growingSeasons`,
          message: 'Crop has no growing seasons defined',
          severity: 'warning',
          code: 'NO_GROWING_SEASONS',
        });
      }
    }
  }
}

/**
 * Validate all regions in a directory
 */
export async function validateAllRegions(regionsDir: string): Promise<{
  valid: number;
  invalid: number;
  results: Map<string, ValidationResult>;
}> {
  const { loadAllRegionConfigs } = await import('../loaders/yaml-loader');
  const regions = loadAllRegionConfigs(regionsDir);

  const results = new Map<string, ValidationResult>();
  let valid = 0;
  let invalid = 0;

  for (const [regionId, region] of regions) {
    const validator = new RegionValidator(region);
    const result = validator.validate();
    results.set(regionId, result);

    if (result.valid) {
      valid++;
    } else {
      invalid++;
    }
  }

  return { valid, invalid, results };
}

/**
 * Generate validation report
 */
export function generateValidationReport(results: Map<string, ValidationResult>): string {
  let report = '# Region Validation Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  let totalValid = 0;
  let totalInvalid = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const [regionId, result] of results) {
    if (result.valid) totalValid++;
    else totalInvalid++;

    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    report += `## ${regionId}\n`;
    report += `- Valid: ${result.valid ? '✅' : '❌'}\n`;
    report += `- Errors: ${result.errors.length}\n`;
    report += `- Warnings: ${result.warnings.length}\n`;
    report += `- Info: ${result.info.length}\n\n`;

    if (result.errors.length > 0) {
      report += '### Errors\n';
      for (const err of result.errors) {
        report += `- [${err.code}] ${err.path}: ${err.message}\n`;
      }
      report += '\n';
    }

    if (result.warnings.length > 0) {
      report += '### Warnings\n';
      for (const warn of result.warnings) {
        report += `- [${warn.code}] ${warn.path}: ${warn.message}\n`;
      }
      report += '\n';
    }
  }

  report += `## Summary\n`;
  report += `- Total Regions: ${totalValid + totalInvalid}\n`;
  report += `- Valid: ${totalValid}\n`;
  report += `- Invalid: ${totalInvalid}\n`;
  report += `- Total Errors: ${totalErrors}\n`;
  report += `- Total Warnings: ${totalWarnings}\n`;

  return report;
}