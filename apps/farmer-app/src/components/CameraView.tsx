/**
 * Advanced Camera View Component
 * Supports multi-capture, real-time detection overlay, voice guidance, GPS tagging
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { Camera, CameraType, CameraProps } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import * as Speech from 'expo-speech';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CameraViewProps {
  onCapture: (images: string[], metadata: CaptureMetadata) => void;
  onClose: () => void;
  cropId: string;
  regionId: string;
  fieldId?: string;
  multiCapture?: boolean;
  maxCaptures?: number;
  autoDetect?: boolean;
  voiceGuidance?: boolean;
}

interface CaptureMetadata {
  latitude: number | null;
  longitude: number | null;
  locationName?: string;
  timestamp: string;
  cropId: string;
  regionId: string;
  fieldId?: string;
  captureAngles: string[];
  deviceOrientation?: string;
}

interface DetectionOverlay {
  diseaseId: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

const CAPTURE_ANGLES = [
  { id: 'top', label: 'Top View', icon: 'arrow-down', description: 'Capture from above the plant' },
  { id: 'side', label: 'Side View', icon: 'arrow-forward', description: 'Capture from the side' },
  { id: 'close', label: 'Close-up', icon: 'zoom-in', description: 'Close-up of affected area' },
  { id: 'context', label: 'Context', icon: 'crop', description: 'Wider context of the field' },
];

export const CameraView: React.FC<CameraViewProps> = ({
  onCapture,
  onClose,
  cropId,
  regionId,
  fieldId,
  multiCapture = true,
  maxCaptures = 4,
  autoDetect = true,
  voiceGuidance = true,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  // Camera state
  const [cameraRef, setCameraRef] = useRef<Camera | null>(null);
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [flashMode, setFlashMode] = useState<'on' | 'off' | 'auto'>('auto');

  // Capture state
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Detection overlay
  const [detectionOverlay, setDetectionOverlay] = useState<DetectionOverlay | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Location
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('');

  // UI state
  const [showAngleGuide, setShowAngleGuide] = useState(multiCapture);
  const [countdown, setCountdown] = useState<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Voice guidance
  const speak = useCallback((text: string) => {
    if (voiceGuidance) {
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
      });
    }
  }, [voiceGuidance]);

  // Initialize
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      // Get location
      try {
        const locStatus = await Location.requestForegroundPermissionsAsync();
        if (locStatus.granted) {
          const loc = await Location.getCurrentPositionAsync({});
          setLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });

          // Reverse geocode for location name
          const reverseGeo = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (reverseGeo.length > 0) {
            const addr = reverseGeo[0];
            setLocationName(`${addr.subregion || addr.city || ''}, ${addr.region || addr.country || ''}`.trim());
          }
        }
      } catch (err) {
        console.warn('Location not available:', err);
      }

      // Speak initial guidance
      if (voiceGuidance) {
        setTimeout(() => {
          speak(multiCapture
            ? `Welcome to disease detection. We'll capture ${maxCaptures} angles. Starting with top view.`
            : 'Tap the capture button to take a photo for disease detection.'
          );
        }, 1000);
      }
    })();
  }, [multiCapture, maxCaptures, voiceGuidance, speak]);

  // Pulse animation for capture button
  useEffect(() => {
    pulseAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Auto-detection loop (when enabled)
  const detectionInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autoDetect && hasPermission && cameraRef.current && !isCapturing) {
      detectionInterval.current = setInterval(async () => {
        if (isDetecting || capturedImages.length >= maxCaptures) return;

        setIsDetecting(true);
        try {
          // Take a temporary photo for detection
          const photo = await cameraRef.current!.takePictureAsync({
            quality: 0.3,
            base64: false,
            exif: false,
          });

          if (photo) {
            // In a real app, this would call the edge model
            // For now, we'll simulate detection occasionally
            if (Math.random() < 0.1) { // 10% chance to show overlay
              setDetectionOverlay({
                diseaseId: 'rice_blast',
                confidence: 0.75 + Math.random() * 0.2,
              });

              // Clear overlay after 3 seconds
              setTimeout(() => setDetectionOverlay(null), 3000);
            }
          }
        } catch (err) {
          console.warn('Auto-detection failed:', err);
        } finally {
          setIsDetecting(false);
        }
      }, 5000); // Every 5 seconds
    }

    return () => {
      if (detectionInterval.current) {
        clearInterval(detectionInterval.current);
      }
    };
  }, [autoDetect, hasPermission, isCapturing, capturedImages.length, maxCaptures]);

  // Handle capture
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    setCountdown(3);

    // Countdown with voice
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      if (voiceGuidance) speak(i.toString());
      await new Promise(r => setTimeout(r, 1000));
    }
    setCountdown(null);

    if (voiceGuidance) speak('Capture');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        exif: true,
        flashMode,
      });

      if (photo) {
        // Auto-enhance and crop
        const enhanced = await manipulateAsync(photo.uri, [
          { resize: { width: 1024 } }, // Resize for faster processing
        ], { compress: 0.9, format: SaveFormat.JPEG });

        setCapturedImages(prev => [...prev, enhanced.uri]);

        // Voice feedback
        if (voiceGuidance) {
          if (multiCapture) {
            const nextIndex = capturedImages.length + 1;
            if (nextIndex < maxCaptures) {
              const nextAngle = CAPTURE_ANGLES[nextIndex];
              speak(`Good. Now capture ${nextAngle.label.toLowerCase()}. ${nextAngle.description}`);
            } else {
              speak('All captures complete. Review your images.');
            }
          } else {
            speak('Image captured. Review and confirm.');
          }
        }

        // Check if done with multi-capture
        if (!multiCapture || capturedImages.length + 1 >= maxCaptures) {
          setShowReview(true);
        } else {
          setCurrentAngleIndex(prev => prev + 1);
        }
      }
    } catch (err) {
      console.error('Capture failed:', err);
      Alert.alert('Error', 'Failed to capture image');
    } finally {
      setIsCapturing(false);
    }
  }, [capturedImages.length, maxCaptures, multiCapture, flashMode, voiceGuidance, speak]);

  // Retake last image
  const handleRetake = useCallback(() => {
    if (capturedImages.length > 0) {
      setCapturedImages(prev => prev.slice(0, -1));
      if (multiCapture) {
        setCurrentAngleIndex(prev => Math.max(0, prev - 1));
      }
      setShowReview(false);
    }
  }, [capturedImages.length, multiCapture]);

  // Confirm and submit
  const handleConfirm = useCallback(() => {
    const metadata: CaptureMetadata = {
      latitude: location?.lat ?? null,
      longitude: location?.lon ?? null,
      locationName,
      timestamp: new Date().toISOString(),
      cropId,
      regionId,
      fieldId,
      captureAngles: multiCapture ? CAPTURE_ANGLES.slice(0, capturedImages.length).map(a => a.id) : ['single'],
    };

    onCapture(capturedImages, metadata);
    onClose();
  }, [capturedImages, location, locationName, cropId, regionId, fieldId, multiCapture, onCapture, onClose]);

  // Switch camera
  const handleFlipCamera = useCallback(() => {
    setCameraType(prev => prev === 'back' ? 'front' : 'back');
  }, []);

  // Toggle flash
  const handleToggleFlash = useCallback(() => {
    setFlashMode(prev => {
      if (prev === 'auto') return 'on';
      if (prev === 'on') return 'off';
      return 'auto';
    });
  }, []);

  // Render detection overlay
  const renderDetectionOverlay = () => {
    if (!detectionOverlay) return null;

    return (
      <View style={styles.detectionOverlay}>
        <View style={styles.detectionBox}>
          <View style={styles.detectionPulse} />
          <Text style={styles.detectionLabel}>
            {detectionOverlay.diseaseId.replace(/_/g, ' ').toUpperCase()}
          </Text>
          <Text style={styles.detectionConfidence}>
            {(detectionOverlay.confidence * 100).toFixed(0)}% confidence
          </Text>
        </View>
      </View>
    );
  };

  // Render angle guide
  const renderAngleGuide = () => {
    if (!multiCapture || !showAngleGuide || capturedImages.length >= maxCaptures) return null;

    const currentAngle = CAPTURE_ANGLES[currentAngleIndex];

    return (
      <View style={styles.angleGuide}>
        <View style={styles.angleGuideContent}>
          <Ionicons name={currentAngle.icon} size={32} color={theme.primary} />
          <Text style={[styles.angleGuideTitle, { color: theme.textPrimary }]}>
            {currentAngle.label}
          </Text>
          <Text style={[styles.angleGuideDesc, { color: theme.textSecondary }]}>
            {currentAngle.description}
          </Text>
          <View style={styles.angleProgress}>
            {CAPTURE_ANGLES.slice(0, maxCaptures).map((angle, i) => (
              <View
                key={angle.id}
                style={[
                  styles.angleDot,
                  i < capturedImages.length && styles.angleDotCompleted,
                  i === currentAngleIndex && styles.angleDotCurrent,
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Render captured thumbnails
  const renderThumbnails = () => {
    if (capturedImages.length === 0) return null;

    return (
      <View style={styles.thumbnailsContainer}>
        {capturedImages.map((uri, i) => (
          <View key={i} style={styles.thumbnailWrapper}>
            <Image source={{ uri }} style={styles.thumbnail} />
            {multiCapture && (
              <Text style={styles.thumbnailLabel}>
                {CAPTURE_ANGLES[i]?.label || `Image ${i + 1}`}
              </Text>
            )}
            {showReview && (
              <TouchableOpacity
                style={styles.removeThumbnail}
                onPress={() => {
                  setCapturedImages(prev => prev.filter((_, idx) => idx !== i));
                  if (multiCapture) setCurrentAngleIndex(Math.max(0, i));
                }}
              >
                <Ionicons name="close-circle" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Render review screen
  const renderReviewScreen = () => {
    if (!showReview) return null;

    return (
      <View style={styles.reviewOverlay}>
        <View style={styles.reviewContent}>
          <Text style={[styles.reviewTitle, { color: theme.textPrimary }]}>
            Review Captures
          </Text>
          <Text style={[styles.reviewSubtitle, { color: theme.textSecondary }]}>
            {capturedImages.length} image{capturedImages.length !== 1 ? 's' : ''} ready for analysis
          </Text>

          <ScrollView horizontal style={styles.reviewThumbnails} showsHorizontalScrollIndicator={false}>
            {capturedImages.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.reviewThumbnail} />
            ))}
          </ScrollView>

          <View style={styles.reviewActions}>
            <TouchableOpacity style={[styles.reviewButton, styles.reviewButtonSecondary]} onPress={handleRetake}>
              <Ionicons name="redo" size={20} color={theme.primary} />
              <Text style={{ color: theme.primary, fontWeight: '600' }}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.reviewButton, styles.reviewButtonPrimary]} onPress={handleConfirm}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600' }}>Analyze</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-off" size={64} color={theme.textTertiary} />
        <Text style={[styles.permissionText, { color: theme.textSecondary }]}>
          Camera permission required
        </Text>
        <Text style={[styles.permissionSubtext, { color: theme.textTertiary }]}>
          Please enable camera access in settings to scan for diseases
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={onClose}>
          <Text style={styles.permissionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <Camera
        ref={setCameraRef}
        style={styles.camera}
        type={cameraType}
        flashMode={flashMode}
        zoom={0}
        ratio="4:3"
        autoFocus={Camera.Constants.AutoFocus.on}
        whiteBalance={Camera.Constants.WhiteBalance.auto}
      >
        {/* Detection Overlay */}
        {renderDetectionOverlay()}

        {/* Countdown Overlay */}
        {countdown && (
          <View style={styles.countdownOverlay}>
            <Animated.Text
              style={[
                styles.countdownText,
                { color: theme.textInverse },
              ]}
            >
              {countdown}
            </Animated.Text>
          </View>
        )}

        {/* Angle Guide */}
        {renderAngleGuide()}

        {/* Thumbnails */}
        {renderThumbnails()}

        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topButton} onPress={onClose}>
            <Ionicons name="close" size={28} color={theme.textInverse} />
          </TouchableOpacity>

          {multiCapture && (
            <View style={styles.captureProgress}>
              {CAPTURE_ANGLES.slice(0, maxCaptures).map((angle, i) => (
                <View
                  key={angle.id}
                  style={[
                    styles.progressDot,
                    i < capturedImages.length && styles.progressDotDone,
                    i === currentAngleIndex && !showReview && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
          )}

          <View style={styles.topRightButtons}>
            <TouchableOpacity style={styles.topButton} onPress={handleToggleFlash}>
              <Ionicons
                name={flashMode === 'on' ? 'flash' : flashMode === 'off' ? 'flash-off' : 'flash-auto'}
                size={28}
                color={theme.textInverse}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topButton} onPress={handleFlipCamera}>
              <Ionicons name="camera-reverse" size={28} color={theme.textInverse} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomBar}>
          {showReview ? (
            <TouchableOpacity style={styles.bottomButtonSecondary} onPress={() => setShowReview(false)}>
              <Ionicons name="arrow-back" size={24} color={theme.textInverse} />
              <Text style={{ color: theme.textInverse }}>Back</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Gallery Button */}
              <TouchableOpacity style={styles.bottomButton}>
                <Ionicons name="images" size={28} color={theme.textInverse} />
              </TouchableOpacity>

              {/* Capture Button */}
              <Animated.View
                style={[
                  styles.captureButton,
                  {
                    transform: [
                      { scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.captureButtonInner}
                  onPress={handleCapture}
                  disabled={isCapturing}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.captureRing,
                    isCapturing && styles.captureRingCapturing,
                  ]} />
                </TouchableOpacity>
              </Animated.View>

              {/* Voice Toggle */}
              <TouchableOpacity style={styles.bottomButton} onPress={() => speak('Voice guidance ' + (voiceGuidance ? 'enabled' : 'disabled'))}>
                <Ionicons name={voiceGuidance ? 'volume-high' : 'volume-off'} size={28} color={theme.textInverse} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Camera>

      {/* Review Screen */}
      {renderReviewScreen()}
    </View>
  );
};

import { ScrollView } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 24,
  },
  permissionText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#10B981',
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Top Bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  captureProgress: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  progressDotActive: {
    backgroundColor: '#fff',
    transform: [{ scale: 1.2 }],
  },
  progressDotDone: {
    backgroundColor: '#10B981',
  },
  topRightButtons: {
    flexDirection: 'row',
    gap: 12,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  bottomButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
  },
  captureButton: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
  },
  captureRingCapturing: {
    backgroundColor: '#EF4444',
  },

  // Thumbnails
  thumbnailsContainer: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  thumbnailLabel: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  removeThumbnail: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Angle Guide
  angleGuide: {
    position: 'absolute',
    top: 140,
    left: 16,
    right: 16,
    zIndex: 5,
  },
  angleGuideContent: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  angleGuideTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  angleGuideDesc: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  angleProgress: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  angleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  angleDotCurrent: {
    backgroundColor: '#fff',
    transform: [{ scale: 1.3 }],
  },
  angleDotCompleted: {
    backgroundColor: '#10B981',
  },

  // Detection Overlay
  detectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 8,
    pointerEvents: 'none',
  },
  detectionBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 180,
  },
  detectionPulse: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 8,
  },
  detectionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  detectionConfidence: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 2,
  },

  // Countdown
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  countdownText: {
    fontSize: 120,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },

  // Review Screen
  reviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 20,
  },
  reviewContent: {
    alignItems: 'center',
  },
  reviewTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  reviewSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  reviewThumbnails: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
    paddingVertical: 8,
  },
  reviewThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  reviewButtonPrimary: {
    backgroundColor: '#10B981',
  },
  reviewButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

export default CameraView;