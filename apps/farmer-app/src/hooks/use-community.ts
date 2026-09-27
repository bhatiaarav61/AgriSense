/**
 * Community & Social Features Hook
 * Handles farmer groups, disease alerts, market prices, expert consultation
 */

import { useState, useCallback, useEffect } from 'react';
import {
  createCommunityPost,
  getCommunityPosts,
  CommunityPost,
  getActiveDiseaseAlerts,
  getNearbyDiseaseAlerts,
  DiseaseAlert,
  getNearbySuppliers,
  Supplier,
} from '@/services/database';
import { useAuth } from './useAuth';

export interface FarmerGroup {
  id: string;
  name: string;
  description: string;
  region_id: string;
  member_count: number;
  is_member: boolean;
  is_admin: boolean;
  created_at: string;
  avatar_uri?: string;
}

export interface ExpertConsultation {
  id: string;
  expert_id: string;
  expert_name: string;
  expert_specialty: string;
  expert_avatar?: string;
  farmer_id: string;
  status: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at?: string;
  duration_minutes: number;
  fee: number;
  currency: string;
  topic: string;
  notes?: string;
  created_at: string;
}

export interface MarketPrice {
  id: string;
  crop_id: string;
  crop_name: string;
  variety?: string;
  market_name: string;
  market_location: string;
  latitude?: number;
  longitude?: number;
  price_per_unit: number;
  unit: string; // kg, quintal, ton
  currency: string;
  quality_grade?: string;
  date: string; // YYYY-MM-DD
  trend: 'up' | 'down' | 'stable';
  change_percent: number;
  source: 'farmer' | 'market' | 'government' | 'aggregator';
  reported_by: string;
  created_at: string;
}

export interface SuccessStory {
  id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_avatar?: string;
  crop_id: string;
  crop_name: string;
  disease_id?: string;
  disease_name?: string;
  title: string;
  content: string;
  image_uris: string[];
  yield_increase_percent?: number;
  cost_savings_percent?: number;
  region_id: string;
  likes_count: number;
  created_at: string;
}

// Community Posts Hook
export function useCommunityPosts(regionId?: string) {
  const { regionId: userRegionId } = useAuth();
  const targetRegionId = regionId || userRegionId;
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const loadPosts = useCallback(async (pageNum = 0, append = false) => {
    if (!targetRegionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCommunityPosts(targetRegionId, 20, pageNum * 20);
      if (append) {
        setPosts(prev => [...prev, ...data]);
      } else {
        setPosts(data);
      }
      setHasMore(data.length === 20);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [targetRegionId]);

  const createPost = useCallback(async (
    post: Omit<CommunityPost, 'id' | 'created_at' | 'synced' | 'likes_count' | 'comments_count'>
  ): Promise<string> => {
    setError(null);
    try {
      const id = await createCommunityPost(post);
      await loadPosts(0, false); // Refresh
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
      throw err;
    }
  }, [loadPosts]);

  const likePost = useCallback(async (postId: string): Promise<void> => {
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p
    ));
    // In real app, would call API to sync
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadPosts(page + 1, true);
    }
  }, [loading, hasMore, page, loadPosts]);

  useEffect(() => {
    loadPosts(0, false);
  }, [loadPosts, targetRegionId]);

  return {
    posts,
    loading,
    error,
    hasMore,
    loadMore,
    createPost,
    likePost,
    refresh: () => loadPosts(0, false),
  };
}

// Disease Alerts Hook
export function useDiseaseAlerts(regionId?: string, userLocation?: { lat: number; lon: number }) {
  const { regionId: userRegionId } = useAuth();
  const targetRegionId = regionId || userRegionId;
  const [alerts, setAlerts] = useState<DiseaseAlert[]>([]);
  const [nearbyAlerts, setNearbyAlerts] = useState<DiseaseAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!targetRegionId) return;
    setLoading(true);
    setError(null);
    try {
      const [regionAlerts, nearby] = await Promise.all([
        getActiveDiseaseAlerts(targetRegionId),
        userLocation ? getNearbyDiseaseAlerts(userLocation.lat, userLocation.lon, 50) : Promise.resolve([]),
      ]);
      setAlerts(regionAlerts);
      setNearbyAlerts(nearby);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [targetRegionId, userLocation]);

  useEffect(() => {
    loadAlerts();
    // Refresh every 5 minutes
    const interval = setInterval(loadAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const getAlertsBySeverity = useCallback((severity: DiseaseAlert['severity']): DiseaseAlert[] => {
    return alerts.filter(a => a.severity === severity);
  }, [alerts]);

  const getCriticalAlerts = useCallback((): DiseaseAlert[] => {
    return alerts.filter(a => a.severity === 'critical' || a.severity === 'high');
  }, [alerts]);

  return {
    alerts,
    nearbyAlerts,
    loading,
    error,
    getAlertsBySeverity,
    getCriticalAlerts,
    refresh: loadAlerts,
  };
}

// Suppliers Hook
export function useSuppliers(regionId?: string, userLocation?: { lat: number; lon: number }) {
  const { regionId: userRegionId } = useAuth();
  const targetRegionId = regionId || userRegionId;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [nearbySuppliers, setNearbySuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    if (!targetRegionId) return;
    setLoading(true);
    setError(null);
    try {
      const { getSuppliersByRegion } = await import('@/services/database');
      const [regionSuppliers, nearby] = await Promise.all([
        getSuppliersByRegion(targetRegionId),
        userLocation ? getNearbySuppliers(userLocation.lat, userLocation.lon, 50) : Promise.resolve([]),
      ]);
      setSuppliers(regionSuppliers);
      setNearbySuppliers(nearby);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [targetRegionId, userLocation]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const getSuppliersByProduct = useCallback((productId: string): Supplier[] => {
    return suppliers.filter(s => {
      try {
        const products = JSON.parse(s.products || '[]');
        return products.includes(productId);
      } catch {
        return false;
      }
    });
  }, [suppliers]);

  return {
    suppliers,
    nearbySuppliers,
    loading,
    error,
    getSuppliersByProduct,
    refresh: loadSuppliers,
  };
}

// Farmer Groups Hook
export function useFarmerGroups(regionId?: string) {
  const { regionId: userRegionId } = useAuth();
  const targetRegionId = regionId || userRegionId;
  const [groups, setGroups] = useState<FarmerGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In a real app, these would come from an API
  // For now, we'll use mock data with local storage
  const loadGroups = useCallback(async () => {
    if (!targetRegionId) return;
    setLoading(true);
    try {
      // Mock data - replace with API call
      const mockGroups: FarmerGroup[] = [
        {
          id: 'group_1',
          name: 'Rice Farmers Cooperative - Punjab',
          description: 'Cooperative for rice farmers in Punjab region',
          region_id: targetRegionId,
          member_count: 245,
          is_member: false,
          is_admin: false,
          created_at: '2024-01-15T00:00:00Z',
        },
        {
          id: 'group_2',
          name: 'Wheat Growers Association',
          description: 'Association for wheat cultivation best practices',
          region_id: targetRegionId,
          member_count: 189,
          is_member: true,
          is_admin: false,
          created_at: '2024-02-20T00:00:00Z',
        },
        {
          id: 'group_3',
          name: 'Organic Farming Collective',
          description: 'Group focused on organic and sustainable farming',
          region_id: targetRegionId,
          member_count: 67,
          is_member: false,
          is_admin: false,
          created_at: '2024-03-10T00:00:00Z',
        },
      ];
      setGroups(mockGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [targetRegionId]);

  const joinGroup = useCallback(async (groupId: string): Promise<void> => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, is_member: true, member_count: g.member_count + 1 } : g
    ));
  }, []);

  const leaveGroup = useCallback(async (groupId: string): Promise<void> => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, is_member: false, member_count: g.member_count - 1 } : g
    ));
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return {
    groups,
    loading,
    error,
    joinGroup,
    leaveGroup,
    refresh: loadGroups,
  };
}

// Market Prices Hook
export function useMarketPrices(regionId?: string, cropId?: string) {
  const { regionId: userRegionId } = useAuth();
  const targetRegionId = regionId || userRegionId;
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Mock data - replace with API call
      const mockPrices: MarketPrice[] = [
        {
          id: 'price_1',
          crop_id: 'rice',
          crop_name: 'Rice',
          variety: 'Basmati',
          market_name: 'Ludhiana Mandi',
          market_location: 'Ludhiana, Punjab',
          latitude: 30.9010,
          longitude: 75.8573,
          price_per_unit: 3200,
          unit: 'quintal',
          currency: 'INR',
          quality_grade: 'A',
          date: new Date().toISOString().split('T')[0],
          trend: 'up',
          change_percent: 2.5,
          source: 'market',
          reported_by: 'Mandi Official',
          created_at: new Date().toISOString(),
        },
        {
          id: 'price_2',
          crop_id: 'wheat',
          crop_name: 'Wheat',
          variety: 'HD-2967',
          market_name: 'Karnal Mandi',
          market_location: 'Karnal, Haryana',
          latitude: 29.6857,
          longitude: 76.9905,
          price_per_unit: 2150,
          unit: 'quintal',
          currency: 'INR',
          quality_grade: 'FAQ',
          date: new Date().toISOString().split('T')[0],
          trend: 'stable',
          change_percent: 0,
          source: 'government',
          reported_by: 'FCI',
          created_at: new Date().toISOString(),
        },
      ];

      let filtered = mockPrices;
      if (cropId) {
        filtered = filtered.filter(p => p.crop_id === cropId);
      }

      setPrices(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prices');
    } finally {
      setLoading(false);
    }
  }, [targetRegionId, cropId]);

  const sharePrice = useCallback(async (price: Omit<MarketPrice, 'id' | 'created_at' | 'source' | 'reported_by'>): Promise<void> => {
    // In real app, would save to database and sync
    const newPrice: MarketPrice = {
      ...price,
      id: `price_${Date.now()}`,
      source: 'farmer',
      reported_by: 'Current User',
      created_at: new Date().toISOString(),
    };
    setPrices(prev => [newPrice, ...prev]);
  }, []);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  const getAveragePrice = useCallback((cropId: string): number | null => {
    const cropPrices = prices.filter(p => p.crop_id === cropId);
    if (cropPrices.length === 0) return null;
    return cropPrices.reduce((sum, p) => sum + p.price_per_unit, 0) / cropPrices.length;
  }, [prices]);

  return {
    prices,
    loading,
    error,
    sharePrice,
    getAveragePrice,
    refresh: loadPrices,
  };
}

// Expert Consultation Hook
export function useExpertConsultation() {
  const [consultations, setConsultations] = useState<ExpertConsultation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestConsultation = useCallback(async (
    consultation: Omit<ExpertConsultation, 'id' | 'created_at' | 'status'>
  ): Promise<string> => {
    setError(null);
    try {
      const id = `consult_${Date.now()}`;
      const newConsultation: ExpertConsultation = {
        ...consultation,
        id,
        status: 'requested',
        created_at: new Date().toISOString(),
      };
      setConsultations(prev => [newConsultation, ...prev]);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request consultation');
      throw err;
    }
  }, []);

  const getAvailableExperts = useCallback(async (): Promise<Array<{
    id: string;
    name: string;
    specialty: string;
    avatar?: string;
    rating: number;
    fee_per_hour: number;
    currency: string;
    languages: string[];
    availability: string[];
  }>> => {
    // Mock data - replace with API
    return [
      {
        id: 'expert_1',
        name: 'Dr. Rajesh Kumar',
        specialty: 'Plant Pathology',
        avatar: 'https://example.com/expert1.jpg',
        rating: 4.8,
        fee_per_hour: 1500,
        currency: 'INR',
        languages: ['Hindi', 'Punjabi', 'English'],
        availability: ['Mon 10-12', 'Wed 14-16', 'Fri 10-12'],
      },
      {
        id: 'expert_2',
        name: 'Dr. Priya Sharma',
        specialty: 'Integrated Pest Management',
        avatar: 'https://example.com/expert2.jpg',
        rating: 4.9,
        fee_per_hour: 2000,
        currency: 'INR',
        languages: ['Hindi', 'English', 'Marathi'],
        availability: ['Tue 10-12', 'Thu 14-16', 'Sat 10-12'],
      },
      {
        id: 'expert_3',
        name: 'Dr. Amit Singh',
        specialty: 'Soil Health & Nutrition',
        avatar: 'https://example.com/expert3.jpg',
        rating: 4.7,
        fee_per_hour: 1800,
        currency: 'INR',
        languages: ['Hindi', 'English', 'Gujarati'],
        availability: ['Mon 14-16', 'Wed 10-12', 'Fri 14-16'],
      },
    ];
  }, []);

  return {
    consultations,
    loading,
    error,
    requestConsultation,
    getAvailableExperts,
  };
}

// Success Stories Hook
export function useSuccessStories(regionId?: string, cropId?: string) {
  const { regionId: userRegionId } = useAuth();
  const targetRegionId = regionId || userRegionId;
  const [stories, setStories] = useState<SuccessStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Mock data - replace with API
      const mockStories: SuccessStory[] = [
        {
          id: 'story_1',
          farmer_id: 'farmer_1',
          farmer_name: 'Harpreet Singh',
          farmer_avatar: 'https://example.com/farmer1.jpg',
          crop_id: 'rice',
          crop_name: 'Rice',
          disease_id: 'rice_blast',
          disease_name: 'Rice Blast',
          title: 'Saved my rice crop from blast disease',
          content: 'Early detection using AgriSense helped me identify rice blast at early stage. Applied recommended treatment and saved 80% of my crop. The step-by-step wizard made it easy to follow.',
          image_uris: ['https://example.com/story1_1.jpg', 'https://example.com/story1_2.jpg'],
          yield_increase_percent: 25,
          cost_savings_percent: 30,
          region_id: targetRegionId,
          likes_count: 42,
          created_at: '2024-07-15T00:00:00Z',
        },
        {
          id: 'story_2',
          farmer_id: 'farmer_2',
          farmer_name: 'Meera Devi',
          farmer_avatar: 'https://example.com/farmer2.jpg',
          crop_id: 'wheat',
          crop_name: 'Wheat',
          disease_id: 'yellow_rust',
          disease_name: 'Yellow Rust',
          title: 'Community alert saved my wheat field',
          content: 'Got a disease outbreak alert from nearby farmers. Checked my field and found early signs of yellow rust. Quick action with recommended fungicide prevented major loss.',
          image_uris: ['https://example.com/story2_1.jpg'],
          yield_increase_percent: 15,
          cost_savings_percent: 40,
          region_id: targetRegionId,
          likes_count: 38,
          created_at: '2024-06-20T00:00:00Z',
        },
      ];

      let filtered = mockStories;
      if (cropId) {
        filtered = filtered.filter(s => s.crop_id === cropId);
      }

      setStories(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, [targetRegionId, cropId]);

  const shareStory = useCallback(async (
    story: Omit<SuccessStory, 'id' | 'farmer_id' | 'farmer_name' | 'farmer_avatar' | 'likes_count' | 'created_at'>
  ): Promise<void> => {
    const newStory: SuccessStory = {
      ...story,
      id: `story_${Date.now()}`,
      farmer_id: 'current_user',
      farmer_name: 'Current User',
      likes_count: 0,
      created_at: new Date().toISOString(),
    };
    setStories(prev => [newStory, ...prev]);
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  return {
    stories,
    loading,
    error,
    shareStory,
    refresh: loadStories,
  };
}