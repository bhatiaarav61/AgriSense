/**
 * Crops Screen - Browse supported crops and their information
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCrops, getCropDisplayName } from '@agrisense/shared-sdk';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';

export default function CropsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { regionId } = useAuth();

  const { data: crops, loading, error, refetch } = useCrops(regionId);
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refetch} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Supported Crops</Text>
        <Text style={styles.headerSubtitle}>Tap a crop to learn more about diseases and growing info</Text>
      </View>

      {/* Crop Grid */}
      {loading && !crops ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="leaf" size={48} color="#10B981" />
          <Text style={styles.loadingText}>Loading crops...</Text>
        </View>
      ) : crops && crops.length > 0 ? (
        <View style={styles.cropGrid}>
          {crops.map((crop) => (
            <CropCard
              key={crop.id}
              crop={crop}
              selected={selectedCrop === crop.id}
              onPress={() => setSelectedCrop(selectedCrop === crop.id ? null : crop.id)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={48} color="#999" />
          <Text style={styles.emptyText}>No crops available for this region</Text>
        </View>
      )}

      {/* Crop Detail Modal/Expansion */}
      {selectedCrop && crops && (
        <CropDetail
          crop={crops.find(c => c.id === selectedCrop)!}
          onClose={() => setSelectedCrop(null)}
        />
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color="#EF4444" />
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function CropCard({
  crop,
  selected,
  onPress,
}: {
  crop: any;
  selected: boolean;
  onPress: () => void;
}) {
  const cropColor = crop.color || '#10B981';

  return (
    <TouchableOpacity style={[styles.cropCard, selected && styles.cropCardSelected]} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.cropIcon, { backgroundColor: cropColor + '20' }]}>
        <Text style={{ fontSize: 28 }}>{crop.icon || '🌱'}</Text>
      </View>
      <View style={styles.cropInfo}>
        <Text style={[styles.cropName, selected && { color: cropColor }]}>{getCropDisplayName(crop)}</Text>
        <Text style={styles.cropScientific}>{crop.scientificName}</Text>
      </View>
      {selected && <Ionicons name="chevron-up" size={24} color={cropColor} />}
      {!selected && <Ionicons name="chevron-down" size={24} color="#999" />}
    </TouchableOpacity>
  );
}

function CropDetail({ crop, onClose }: { crop: any; onClose: () => void }) {
  const cropColor = crop.color || '#10B981';

  return (
    <View style={styles.detailCard}>
      <View style={[styles.detailHeader, { borderTopColor: cropColor }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
        <View style={styles.detailIcon}>
          <Text style={{ fontSize: 40 }}>{crop.icon || '🌱'}</Text>
        </View>
        <View style={styles.detailInfo}>
          <Text style={[styles.detailName, { color: cropColor }]}>{getCropDisplayName(crop)}</Text>
          <Text style={styles.detailScientific}>{crop.scientificName}</Text>
        </View>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Growing Seasons</Text>
        <View style={styles.seasonTags}>
          {crop.growingSeasons.map((season: string) => (
            <View key={season} style={[styles.seasonTag, { backgroundColor: cropColor + '20' }]}>
              <Text style={[styles.seasonTagText, { color: cropColor }]}>{season}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Common Diseases</Text>
        <Text style={styles.detailText}>
          {crop.diseaseClasses.length > 0
            ? crop.diseaseClasses.join(', ')
            : 'No specific diseases listed'}
        </Text>
      </View>

      {crop.localNames && Object.keys(crop.localNames).length > 0 && (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Local Names</Text>
          <View style={styles.localNamesList}>
            {Object.entries(crop.localNames).map(([lang, name]) => (
              <View key={lang} style={styles.localNameItem}>
                <Text style={styles.localNameLang}>{lang.toUpperCase()}</Text>
                <Text style={styles.localNameValue}>{name as string}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 100 },

  header: { padding: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#111' },
  headerSubtitle: { fontSize: 15, color: '#666', marginTop: 4 },

  loadingContainer: { alignItems: 'center', padding: 60 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#666' },

  cropGrid: { paddingHorizontal: 16, gap: 12 },
  cropCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cropCardSelected: { borderColor: '#10B981', borderWidth: 2, backgroundColor: '#ECFDF5' },
  cropIcon: { width: 56, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cropInfo: { flex: 1, marginLeft: 12 },
  cropName: { fontSize: 17, fontWeight: '600', color: '#111' },
  cropScientific: { fontSize: 13, color: '#666', fontStyle: 'italic', marginTop: 2 },

  emptyState: { alignItems: 'center', padding: 60, backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16 },
  emptyText: { marginTop: 12, fontSize: 15, color: '#999' },

  detailCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 4,
  },
  closeButton: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  detailIcon: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  detailInfo: { flex: 1, marginLeft: 16 },
  detailName: { fontSize: 22, fontWeight: '700', color: '#111' },
  detailScientific: { fontSize: 14, color: '#666', fontStyle: 'italic', marginTop: 2 },

  detailSection: { paddingHorizontal: 20, paddingBottom: 20 },
  detailSectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 10 },
  detailText: { fontSize: 14, color: '#4B5563', lineHeight: 22 },

  seasonTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seasonTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  seasonTagText: { fontSize: 13, fontWeight: '500' },

  localNamesList: { gap: 8 },
  localNameItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  localNameLang: { fontSize: 13, color: '#666', fontWeight: '500' },
  localNameValue: { fontSize: 14, color: '#111', fontWeight: '500' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorText: { flex: 1, fontSize: 14, color: '#991B1B' },
  retryText: { fontSize: 14, color: '#EF4444', fontWeight: '600' },
});

import { RefreshControl } from 'react-native';
import { useAuth } from '../hooks/useAuth';