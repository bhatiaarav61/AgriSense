/**
 * Scan Screen - Camera capture and disease detection
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useFarmerFlow, useCrops, useDiseases } from '@agrisense/shared-sdk';
import { validateImageFile, resizeImage, formatConfidence, getConfidenceColor, truncate } from '@agrisense/shared-sdk';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';

const CAMERA_TYPE = Platform.OS === 'web' ? 'front' : 'back';

export default function ScanScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [flashMode, setFlashMode] = useState<'on' | 'off' | 'auto'>('auto');
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [showCropPicker, setShowCropPicker] = useState(false);

  const { regionId, cropId } = useAuth(); // Will create this hook
  const { detect, loading: detecting, error: detectError, data: detection } = useFarmerFlow(regionId, cropId);
  const { fetch: fetchAdvisory, loading: advisoryLoading, data: advisory } = useAdvisory();
  const { data: crops } = useCrops(regionId);
  const { data: diseases } = useDiseases(regionId, cropId);

  const cameraRef = useRef<any>(null);

  const handleCapture = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission required', 'Camera permission is needed to scan crops');
        return;
      }
      return;
    }

    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: false,
      });
      if (photo?.uri) {
        await processImage(photo.uri);
      }
    }
  }, [hasPermission, requestPermission]);

  const processImage = useCallback(async (uri: string) => {
    try {
      // Resize image for API
      const resized = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      setPreviewUri(resized.uri);

      // Convert to base64 for API
      const response = await fetch(resized.uri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      setCapturedImage(base64);
    } catch (err) {
      console.error('Image processing failed:', err);
      Alert.alert('Error', 'Failed to process image');
    }
  }, []);

  const handleDetect = useCallback(async () => {
    if (!capturedImage) return;

    try {
      await detect({
        image: capturedImage,
        crop_id: cropId,
        region_id: regionId,
      });
    } catch (err) {
      console.error('Detection failed:', err);
    }
  }, [capturedImage, cropId, regionId, detect]);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera" size={64} color={theme.tint} />
        <Text style={styles.title}>Camera Permission Required</Text>
        <Text style={styles.subtitle}>Allow camera access to scan crops for diseases</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      {/* Camera Preview or Captured Image */}
      <View style={styles.cameraContainer}>
        {capturedImage ? (
          <>
            <ImagePreview
              uri={previewUri!}
              onRetake={() => {
                setCapturedImage(null);
                setPreviewUri(null);
              }}
              onAnalyze={handleDetect}
              analyzing={detecting}
            />
          </>
        ) : (
          <CameraPreview
            ref={cameraRef}
            onCapture={handleCapture}
            flashMode={flashMode}
            onFlashToggle={() => setFlashMode(flashMode === 'on' ? 'off' : flashMode === 'off' ? 'auto' : 'on')}
            cameraType={cameraType}
            onCameraFlip={() => setCameraType(cameraType === 'back' ? 'front' : 'back')}
          />
        )}
      </View>

      {/* Crop Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Selected Crop</Text>
        <CropSelector
          crops={crops || []}
          selectedCropId={cropId}
          onSelect={(id) => { /* update crop selection */ }}
        />
      </View>

      {/* Detection Results */}
      {detection && (
        <DetectionResultCard
          detection={detection}
          advisory={advisory}
          advisoryLoading={advisoryLoading}
          onViewAdvisory={() => { /* navigate to advisory tab */ }}
        />
      )}

      {detectError && (
        <ErrorBanner message={detectError.message} onDismiss={() => { /* clear error */ }} />
      )}

      {/* Quick Tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scanning Tips</Text>
        <View style={styles.tipsGrid}>
          <TipItem icon="leaf" text="Focus on affected leaves" />
          <TipItem icon="sunny" text="Good lighting improves accuracy" />
          <TipItem icon="close" text="Get close to the symptom" />
          <TipItem icon="flash-on" text="Use flash in low light" />
        </View>
      </View>
    </ScrollView>
  );
}

// Camera Preview Component
function CameraPreview({
  onCapture,
  flashMode,
  onFlashToggle,
  cameraType,
  onCameraFlip,
}: {
  onCapture: () => void;
  flashMode: 'on' | 'off' | 'auto';
  onFlashToggle: () => void;
  cameraType: 'front' | 'back';
  onCameraFlip: () => void;
}) {
  const cameraRef = useRef<any>(null);

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: false,
      });
      if (photo?.uri) {
        onCapture();
      }
    }
  };

  return (
    <View style={styles.cameraView}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        type={cameraType}
        flashMode={flashMode}
      >
        <View style={styles.cameraOverlay}>
          <View style={styles.focusFrame} />
        </View>
      </CameraView>

      <View style={styles.cameraControls}>
        <TouchableOpacity style={styles.controlButton} onPress={onFlashToggle}>
          <Ionicons name={flashMode === 'on' ? 'flash' : flashMode === 'auto' ? 'flash-outline' : 'flash-off'} size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.captureButton} onPress={takePicture} activeOpacity={0.8}>
          <View style={styles.captureInner} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={onCameraFlip}>
          <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Image Preview Component
function ImagePreview({
  uri,
  onRetake,
  onAnalyze,
  analyzing,
}: {
  uri: string;
  onRetake: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  return (
    <View style={styles.previewContainer}>
      <Image source={{ uri }} style={styles.previewImage} />
      <View style={styles.previewActions}>
        <TouchableOpacity style={[styles.actionButton, styles.retakeButton]} onPress={onRetake}>
          <Ionicons name="refresh" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.analyzeButton]} onPress={onAnalyze} disabled={analyzing}>
          {analyzing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="search" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Analyze</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Crop Selector Component
function CropSelector({
  crops,
  selectedCropId,
  onSelect,
}: {
  crops: Array<{ id: string; name: string; icon?: string; color?: string }>;
  selectedCropId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropScroll}>
      {crops.map((crop) => (
        <TouchableOpacity
          key={crop.id}
          style={[
            styles.cropChip,
            selectedCropId === crop.id && styles.cropChipSelected,
            { borderColor: crop.color || '#10B981' },
          ]}
          onPress={() => onSelect(crop.id)}
        >
          <Text style={[{ color: crop.color || '#10B981' }, selectedCropId === crop.id && styles.cropChipTextSelected]}>
            {crop.icon ? <Text>{crop.icon} </Text> : null}
            {crop.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// Detection Result Card
function DetectionResultCard({
  detection,
  advisory,
  advisoryLoading,
  onViewAdvisory,
}: {
  detection: any;
  advisory: any;
  advisoryLoading: boolean;
  onViewAdvisory: () => void;
}) {
  const confidenceColor = getConfidenceColor(detection.confidence);
  const confidenceLabel = formatConfidence(detection.confidence);

  return (
    <View style={styles.resultCard}>
      <View style={[styles.resultHeader, { borderLeftColor: confidenceColor }]}>
        <View style={styles.resultIconContainer}>
          <Ionicons name={detection.confidence > 0.7 ? 'checkmark-circle' : 'warning'} size={32} color={confidenceColor} />
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultDisease}>{detection.name}</Text>
          <View style={styles.confidenceRow}>
            <Text style={[styles.confidenceLabel, { color: confidenceColor }]}>{confidenceLabel} confidence</Text>
            <Text style={styles.confidenceSource}>({detection.source})</Text>
          </View>
        </View>
      </View>

      <View style={styles.resultSection}>
        <Text style={styles.resultSectionTitle}>Symptoms</Text>
        <Text style={styles.resultText}>{detection.symptoms.join(', ')}</Text>
      </View>

      <View style={styles.resultSection}>
        <Text style={styles.resultSectionTitle}>Recommended Treatment</Text>
        <Text style={styles.resultText}>{truncate(detection.treatment, 200)}</Text>
      </View>

      {advisory && (
        <TouchableOpacity style={styles.advisoryButton} onPress={onViewAdvisory}>
          <Ionicons name="medical" size={20} color="#fff" />
          <Text style={styles.advisoryButtonText}>View Full Advisory</Text>
        </TouchableOpacity>
      )}

      {advisoryLoading && (
        <View style={styles.loadingAdvisory}>
          <ActivityIndicator size="small" color="#666" />
          <Text style={styles.loadingText}>Loading detailed advisory...</Text>
        </View>
      )}
    </View>
  );
}

// Error Banner
function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle" size={20} color="#EF4444" />
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity onPress={onDismiss}>
        <Ionicons name="close" size={20} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );
}

// Tip Item
function TipItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.tipItem}>
      <Ionicons name={icon} size={20} color="#10B981" />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: '#fff' },
  content: { paddingBottom: 100 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, color: '#111' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#10B981', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  section: { padding: 16, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#111' },

  cameraContainer: { margin: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  cameraView: { width: '100%', height: 350, position: 'relative' },
  cameraOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  focusFrame: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  controlButton: { padding: 8 },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
  },

  previewContainer: { position: 'relative', borderRadius: 16, overflow: 'hidden' },
  previewImage: { width: '100%', height: 350 },
  previewActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retakeButton: { backgroundColor: 'rgba(0,0,0,0.6)' },
  analyzeButton: { backgroundColor: '#10B981' },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  cropScroll: { gap: 8, paddingHorizontal: 16 },
  cropChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  cropChipSelected: { backgroundColor: '#ECFDF5' },
  cropChipTextSelected: { fontWeight: '600', color: '#10B981' },

  resultCard: {
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
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderLeftWidth: 4,
    paddingLeft: 12,
    marginBottom: 16,
  },
  resultIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' },
  resultInfo: { flex: 1 },
  resultDisease: { fontSize: 20, fontWeight: '700', color: '#111' },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  confidenceLabel: { fontSize: 14, fontWeight: '500' },
  confidenceSource: { fontSize: 13, color: '#999' },

  resultSection: { marginBottom: 16 },
  resultSectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  resultText: { fontSize: 14, color: '#4B5563', lineHeight: 22 },

  advisoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#10B981',
    borderRadius: 12,
  },
  advisoryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  loadingAdvisory: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: 12 },
  loadingText: { fontSize: 14, color: '#666' },

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

  tipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '48%',
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
  },
  tipText: { fontSize: 13, color: '#166534' },
});

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useAdvisory } from '@agrisense/shared-sdk';
import { useAuth } from '../hooks/useAuth';