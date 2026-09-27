import { RegionConfig, Crop, Disease, Provider, PromptTemplate, getProvidersForTask, getPromptTemplate } from './schema';
import { loadAllRegionConfigs } from './loader';

/**
 * Region Registry - Singleton for managing region configurations
 */
class RegionRegistry {
  private regions: Map<string, RegionConfig> = new Map();
  private initialized = false;
  private regionsDir: string = '';

  private constructor() {}

  private static instance: RegionRegistry;

  static getInstance(): RegionRegistry {
    if (!RegionRegistry.instance) {
      RegionRegistry.instance = new RegionRegistry();
    }
    return RegionRegistry.instance;
  }

  /**
   * Initialize the registry by loading all region configs
   */
  initialize(regionsDir: string): void {
    if (this.initialized && this.regionsDir === regionsDir) {
      return; // Already initialized with same directory
    }

    this.regionsDir = regionsDir;
    this.regions = loadAllRegionConfigs(regionsDir);
    this.initialized = true;

    console.log(`[RegionRegistry] Loaded ${this.regions.size} region(s):`, Array.from(this.regions.keys()).join(', '));
  }

  /**
   * Get a region config by ID
   */
  getRegion(regionId: string): RegionConfig | undefined {
    this.ensureInitialized();
    return this.regions.get(regionId);
  }

  /**
   * Get all loaded regions
   */
  getAllRegions(): RegionConfig[] {
    this.ensureInitialized();
    return Array.from(this.regions.values());
  }

  /**
   * Get region IDs
   */
  getRegionIds(): string[] {
    this.ensureInitialized();
    return Array.from(this.regions.keys());
  }

  /**
   * Check if a region exists
   */
  hasRegion(regionId: string): boolean {
    this.ensureInitialized();
    return this.regions.has(regionId);
  }

  /**
   * Get crops for a region
   */
  getCrops(regionId: string): Crop[] {
    const region = this.getRegion(regionId);
    if (!region) throw new Error(`Region not found: ${regionId}`);
    return region.crops;
  }

  /**
   * Get diseases for a region
   */
  getDiseases(regionId: string): Disease[] {
    const region = this.getRegion(regionId);
    if (!region) throw new Error(`Region not found: ${regionId}`);
    return region.diseases;
  }

  /**
   * Get diseases for a specific crop in a region
   */
  getDiseasesForCrop(regionId: string, cropId: string): Disease[] {
    const region = this.getRegion(regionId);
    if (!region) throw new Error(`Region not found: ${regionId}`);
    return region.diseases.filter(d => d.cropIds.includes(cropId));
  }

  /**
   * Get a disease by ID in a region
   */
  getDisease(regionId: string, diseaseId: string): Disease | undefined {
    const region = this.getRegion(regionId);
    if (!region) return undefined;
    return region.diseases.find(d => d.id === diseaseId);
  }

  /**
   * Get a crop by ID in a region
   */
  getCrop(regionId: string, cropId: string): Crop | undefined {
    const region = this.getRegion(regionId);
    if (!region) return undefined;
    return region.crops.find(c => c.id === cropId);
  }

  /**
   * Get providers for a task in a region
   */
  getProvidersForTask(regionId: string, taskType: Provider['models'][string]['taskTypes'][number]): Provider[] {
    const region = this.getRegion(regionId);
    if (!region) throw new Error(`Region not found: ${regionId}`);
    return getProvidersForTask(region, taskType);
  }

  /**
   * Get prompt template for a task and language in a region
   */
  getPromptTemplate(
    regionId: string,
    taskType: PromptTemplate['taskType'],
    language: string
  ): PromptTemplate | undefined {
    const region = this.getRegion(regionId);
    if (!region) return undefined;
    return getPromptTemplate(region, taskType, language);
  }

  /**
   * Get model configuration for a region
   */
  getModelConfig(regionId: string): RegionConfig['modelConfig'] | undefined {
    const region = this.getRegion(regionId);
    return region?.modelConfig;
  }

  /**
   * Get caching configuration for a region
   */
  getCachingConfig(regionId: string): RegionConfig['caching'] | undefined {
    const region = this.getRegion(regionId);
    return region?.caching;
  }

  /**
   * Get weather sources for a region
   */
  getWeatherSources(regionId: string) {
    const region = this.getRegion(regionId);
    if (!region) throw new Error(`Region not found: ${regionId}`);
    return region.weatherSources;
  }

  /**
   * Get satellite sources for a region
   */
  getSatelliteSources(regionId: string) {
    const region = this.getRegion(regionId);
    if (!region) throw new Error(`Region not found: ${regionId}`);
    return region.satelliteSources;
  }

  /**
   * Reload all region configs (useful for development)
   */
  reload(): void {
    if (!this.regionsDir) {
      throw new Error('Registry not initialized');
    }
    this.regions = loadAllRegionConfigs(this.regionsDir);
    console.log(`[RegionRegistry] Reloaded ${this.regions.size} region(s)`);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('RegionRegistry not initialized. Call initialize(regionsDir) first.');
    }
  }
}

export const regionRegistry = RegionRegistry.getInstance();
export { RegionRegistry };