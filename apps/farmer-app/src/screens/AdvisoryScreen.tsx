/**
 * Advisory Screen - Treatment recommendations for diseases
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdvisory, useDiseases, getSeverityColor, getSeverityLabel, formatDate } from '@agrisense/shared-sdk';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';

export default function AdvisoryScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { regionId, cropId } = useAuth();

  const [selectedDisease, setSelectedDisease] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');

  const { data: diseases } = useDiseases(regionId, cropId);
  const { fetch, loading, error, data: advisory } = useAdvisory();

  const loadAdvisory = async (diseaseId: string) => {
    setSelectedDisease(diseaseId);
    try {
      await fetch({
        disease_id: diseaseId,
        crop_id: cropId,
        region_id: regionId,
        severity,
      });
    } catch (err) {
      console.error('Failed to load advisory:', err);
    }
  };

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Treatment Advisory</Text>
        <Text style={styles.headerSubtitle}>Select a disease to get treatment recommendations</Text>
      </View>

      {/* Severity Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Severity Level</Text>
        <View style={styles.severitySelector}>
          {(['low', 'medium', 'high'] as const).map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.severityButton,
                severity === level && styles.severityButtonActive,
                { borderColor: getSeverityColor(level) },
              ]}
              onPress={() => setSeverity(level)}
            >
              <View
                style={[
                  styles.severityDot,
                  { backgroundColor: getSeverityColor(level) },
                ]}
              />
              <Text
                style={[
                  styles.severityLabel,
                  severity === level && styles.severityLabelActive,
                  { color: getSeverityColor(level) },
                ]}
              >
                {getSeverityLabel(level)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Disease List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Common Diseases</Text>
        {diseases && diseases.length > 0 ? (
          <View style={styles.diseaseList}>
            {diseases.map((disease) => (
              <DiseaseCard
                key={disease.id}
                disease={disease}
                selected={selectedDisease === disease.id}
                onPress={() => loadAdvisory(disease.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>No diseases found for this crop</Text>
          </View>
        )}
      </View>

      {/* Advisory Details */}
      {advisory && (
        <AdvisoryDetailCard advisory={advisory} />
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color="#EF4444" />
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function DiseaseCard({
  disease,
  selected,
  onPress,
}: {
  disease: any;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.diseaseCard, selected && styles.diseaseCardSelected]} onPress={onPress}>
      <View style={styles.diseaseCardContent}>
        <View style={styles.diseaseIcon}>
          <Ionicons name="leaf" size={24} color={selected ? '#fff' : '#10B981'} />
        </View>
        <View style={styles.diseaseInfo}>
          <Text style={[styles.diseaseName, selected && styles.diseaseNameSelected]}>{disease.name}</Text>
          <Text style={[styles.diseaseScientific, selected && styles.diseaseScientificSelected]}>{disease.scientificName}</Text>
        </View>
        {selected && <Ionicons name="checkmark-circle" size={24} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

function AdvisoryDetailCard({ advisory }: { advisory: any }) {
  return (
    <View style={styles.advisoryCard}>
      <View style={styles.advisoryHeader}>
        <View style={styles.advisoryBadge}>
          <Ionicons name="medical" size={20} color="#fff" />
        </View>
        <View>
          <Text style={styles.advisoryTitle}>Treatment Advisory</Text>
          <Text style={styles.advisoryMeta}>Severity: {getSeverityLabel(advisory.severity)} • Updated {formatDate(new Date().toISOString())}</Text>
        </View>
      </View>

      <View style={styles.advisorySection}>
        <Text style={styles.advisorySectionTitle}>Recommended Treatment</Text>
        <Text style={styles.advisoryText}>{advisory.treatment}</Text>
      </View>

      <View style={styles.advisorySection}>
        <Text style={styles.advisorySectionTitle}>Preventive Measures</Text>
        <View style={styles.measuresList}>
          {advisory.preventive_measures.map((measure: string, i: number) => (
            <View key={i} style={styles.measureItem}>
              <Ionicons name="checkmark" size={16} color="#10B981" />
              <Text style={styles.measureText}>{measure}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.advisorySection}>
        <Text style={styles.advisorySectionTitle}>Safety Warnings</Text>
        <View style={styles.warningsList}>
          {advisory.safety_warnings.map((warning: string, i: number) => (
            <View key={i} style={styles.warningItem}>
              <Ionicons name="warning" size={16} color="#EF4444" />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.advisorySection}>
        <Text style={styles.advisorySectionTitle}>Follow-up</Text>
        <Text style={styles.advisoryText}>{advisory.follow_up}</Text>
      </View>

      {advisory.local_names && Object.keys(advisory.local_names).length > 0 && (
        <View style={styles.advisorySection}>
          <Text style={styles.advisorySectionTitle}>Local Names</Text>
          <View style={styles.localNamesList}>
            {Object.entries(advisory.local_names).map(([lang, name]) => (
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

  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#111' },

  severitySelector: { flexDirection: 'row', gap: 8 },
  severityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  severityButtonActive: { backgroundColor: '#ECFDF5' },
  severityDot: { width: 10, height: 10, borderRadius: 5 },
  severityLabel: { fontSize: 14, fontWeight: '500' },
  severityLabelActive: { fontWeight: '700' },

  diseaseList: { gap: 10 },
  diseaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  diseaseCardSelected: { borderColor: '#10B981', borderWidth: 2, backgroundColor: '#ECFDF5' },
  diseaseCardContent: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  diseaseIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' },
  diseaseInfo: { flex: 1 },
  diseaseName: { fontSize: 16, fontWeight: '600', color: '#111' },
  diseaseNameSelected: { color: '#10B981' },
  diseaseScientific: { fontSize: 13, color: '#666', fontStyle: 'italic' },
  diseaseScientificSelected: { color: '#059669' },

  emptyState: { alignItems: 'center', padding: 40, backgroundColor: '#fff', borderRadius: 12 },
  emptyText: { marginTop: 12, fontSize: 15, color: '#999' },

  advisoryCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  advisoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  advisoryBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  advisoryTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  advisoryMeta: { fontSize: 13, color: '#666', marginTop: 2 },

  advisorySection: { marginBottom: 20 },
  advisorySectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 10 },
  advisoryText: { fontSize: 14, color: '#4B5563', lineHeight: 22 },

  measuresList: { gap: 8 },
  measureItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  measureText: { fontSize: 14, color: '#4B5563', flex: 1, lineHeight: 22 },

  warningsList: { gap: 8 },
  warningItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningText: { fontSize: 14, color: '#4B5563', flex: 1, lineHeight: 22 },

  localNamesList: { gap: 8 },
  localNameItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
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
});

import { useAuth } from '../hooks/useAuth';