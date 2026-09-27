/**
 * Treatment Wizard Component
 * Step-by-step treatment guidance with progress tracking, cost calculator, and follow-up reminders
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { TreatmentPlan, TreatmentStep, TreatmentProduct } from '@/hooks/use-treatments';
import * as Speech from 'expo-speech';

interface TreatmentWizardProps {
  treatmentPlan: TreatmentPlan;
  onComplete: () => void;
  onClose: () => void;
  voiceGuidance?: boolean;
  showCostBreakdown?: boolean;
}

interface StepProgress {
  stepId: string;
  completed: boolean;
  completedAt?: string;
}

export const TreatmentWizard: React.FC<TreatmentWizardProps> = ({
  treatmentPlan,
  onComplete,
  onClose,
  voiceGuidance = true,
  showCostBreakdown = true,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState<Record<string, StepProgress>>({});
  const [showCostModal, setShowCostModal] = useState(false);
  const [showProductDetail, setShowProductDetail] = useState<TreatmentProduct | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const currentStep = treatmentPlan.steps[currentStepIndex];
  const completedSteps = treatmentPlan.steps.filter(s => stepProgress[s.id]?.completed).length;
  const progress = treatmentPlan.steps.length > 0 ? completedSteps / treatmentPlan.steps.length : 0;

  // Speak current step
  const speakStep = useCallback((step: TreatmentStep) => {
    if (!voiceGuidance) return;

    setSpeaking(true);
    Speech.speak(
      `Step ${step.order}: ${step.title}. ${step.description}. ${step.safety_notes || ''}`,
      {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.85,
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      }
    );
  }, [voiceGuidance]);

  // Auto-speak when step changes
  useEffect(() => {
    if (currentStep) {
      speakStep(currentStep);
    }
  }, [currentStepIndex, speakStep]);

  // Toggle step completion
  const toggleStepComplete = useCallback((stepId: string) => {
    setStepProgress(prev => ({
      ...prev,
      [stepId]: {
        stepId,
        completed: !prev[stepId]?.completed,
        completedAt: !prev[stepId]?.completed ? new Date().toISOString() : undefined,
      },
    }));

    // Check if all steps completed
    const newCompleted = treatmentPlan.steps.filter(s =>
      stepId === s.id ? !stepProgress[s.id]?.completed : stepProgress[s.id]?.completed
    ).length;

    if (newCompleted === treatmentPlan.steps.length) {
      // All done!
      setTimeout(() => {
        Alert.alert(
          'Treatment Complete! 🎉',
          'You have completed all treatment steps. Remember to follow up as scheduled.',
          [{ text: 'Done', onPress: onComplete }]
        );
      }, 500);
    }
  }, [stepProgress, treatmentPlan.steps, onComplete]);

  // Go to next/prev step
  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < treatmentPlan.steps.length) {
      setCurrentStepIndex(index);
    }
  }, [treatmentPlan.steps.length]);

  // Format dosage
  const formatDosage = (step: TreatmentStep) => {
    if (step.dosage) {
      return `${step.dosage} ${step.product_id ? '' : 'per hectare'}`;
    }
    return 'As recommended';
  };

  // Get step status color
  const getStepStatusColor = (step: TreatmentStep) => {
    if (stepProgress[step.id]?.completed) return theme.success;
    if (step.id === currentStep?.id) return theme.primary;
    return theme.border;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            {treatmentPlan.disease_name} Treatment
          </Text>
          <View style={styles.severityBadge}>
            <View
              style={[
                styles.severityDot,
                {
                  backgroundColor:
                    treatmentPlan.severity === 'high' ? theme.error :
                    treatmentPlan.severity === 'medium' ? theme.warning :
                    theme.success,
                },
              ]}
            />
            <Text style={styles.severityText}>
              {treatmentPlan.severity.charAt(0).toUpperCase() + treatmentPlan.severity.slice(1)} Severity
            </Text>
          </View>
        </View>

        {showCostBreakdown && (
          <TouchableOpacity style={styles.costButton} onPress={() => setShowCostModal(true)}>
            <Ionicons name="calculator" size={22} color={theme.primary} />
            <Text style={[styles.costButtonText, { color: theme.primary }]}>
              ₹{treatmentPlan.total_estimated_cost.toLocaleString()}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: theme.primary },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: theme.textSecondary }]}>
          Step {currentStepIndex + 1} of {treatmentPlan.steps.length} • {completedSteps} completed
        </Text>
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        {treatmentPlan.steps.map((step, index) => (
          <TouchableOpacity
            key={step.id}
            style={styles.stepIndicatorItem}
            onPress={() => goToStep(index)}
          >
            <View
              style={[
                styles.stepCircle,
                {
                  backgroundColor: getStepStatusColor(step),
                  borderColor: getStepStatusColor(step),
                },
              ]}
            >
              {stepProgress[step.id]?.completed ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Text style={styles.stepNumber}>{index + 1}</Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                index === currentStepIndex && styles.stepLabelActive,
                stepProgress[step.id]?.completed && styles.stepLabelDone,
              ]}
            >
              {step.title.split(':')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Current Step Content */}
      <ScrollView style={styles.stepContent} contentContainerStyle={styles.stepContentInner}>
        {currentStep && (
          <View style={styles.stepCard}>
            {/* Step Header */}
            <View style={styles.stepHeader}>
              <View
                style={[
                  styles.stepBadge,
                  { backgroundColor: getStepStatusColor(currentStep) },
                ]}
              >
                <Text style={styles.stepBadgeNumber}>{currentStep.order}</Text>
              </View>
              <View style={styles.stepHeaderText}>
                <Text style={[styles.stepTitle, { color: theme.textPrimary }]}>
                  {currentStep.title}
                </Text>
                {currentStep.timing && (
                  <Text style={[styles.stepTiming, { color: theme.textSecondary }]}>
                    {currentStep.timing} • {currentStep.duration_days || 1} day{currentStep.duration_days !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            </View>

            {/* Description */}
            <View style={styles.stepDescription}>
              <Text style={[styles.descText, { color: theme.textPrimary }]}>
                {currentStep.description}
              </Text>
            </View>

            {/* Product Info */}
            {currentStep.product_id && (
              <View style={styles.productCard}>
                <TouchableOpacity
                  style={styles.productCardMain}
                  onPress={() => {
                    const product = treatmentPlan.products.find(p => p.id === currentStep.product_id);
                    if (product) setShowProductDetail(product);
                  }}
                >
                  <View style={styles.productIcon}>
                    <Ionicons name="flask" size={24} color={theme.primary} />
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, { color: theme.textPrimary }]}>
                      {currentStep.product_name}
                    </Text>
                    <Text style={[styles.productDosage, { color: theme.textSecondary }]}>
                      Dosage: {formatDosage(currentStep)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
                </TouchableOpacity>

                {currentStep.safety_notes && (
                  <View style={styles.safetyNotes}>
                    <Ionicons name="warning" size={16} color={theme.warning} />
                    <Text style={[styles.safetyText, { color: theme.warning }]}>
                      {currentStep.safety_notes}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Completion Toggle */}
            <TouchableOpacity
              style={[
                styles.completeButton,
                stepProgress[currentStep.id]?.completed && styles.completeButtonDone,
              ]}
              onPress={() => toggleStepComplete(currentStep.id)}
            >
              <View style={styles.completeButtonContent}>
                {stepProgress[currentStep.id]?.completed ? (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                    <Text style={styles.completeButtonText}>Step Completed</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={24} color={theme.textSecondary} />
                    <Text style={[styles.completeButtonText, { color: theme.textSecondary }]}>
                      Mark as Complete
                    </Text>
                  </>
                )}
              </View>
            </TouchableOpacity>

            {/* Voice Controls */}
            <View style={styles.voiceControls}>
              <TouchableOpacity
                style={[
                  styles.voiceButton,
                  speaking && styles.voiceButtonSpeaking,
                ]}
                onPress={() => speakStep(currentStep)}
              >
                <Ionicons
                  name={speaking ? 'volume-high' : 'volume-medium'}
                  size={22}
                  color={speaking ? theme.primary : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.voiceButtonText,
                    { color: speaking ? theme.primary : theme.textSecondary },
                  ]}
                >
                  {speaking ? 'Speaking...' : 'Repeat Instructions'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Follow-up Schedule */}
        <View style={styles.followUpSection}>
          <TouchableOpacity style={styles.followUpHeader} onPress={() => setShowFollowUp(true)}>
            <View style={styles.followUpIcon}>
              <Ionicons name="calendar" size={20} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.followUpTitle, { color: theme.textPrimary }]}>
                Follow-up Schedule
              </Text>
              <Text style={[styles.followUpSubtitle, { color: theme.textSecondary }]}>
                {treatmentPlan.follow_up_schedule.length} reminders scheduled
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[
            styles.navButton,
            currentStepIndex === 0 && styles.navButtonDisabled,
          ]}
          onPress={() => goToStep(currentStepIndex - 1)}
          disabled={currentStepIndex === 0}
        >
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
          <Text style={[styles.navButtonText, { color: theme.textPrimary }]}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButtonPrimary,
            currentStepIndex === treatmentPlan.steps.length - 1 && styles.navButtonLast,
          ]}
          onPress={() =>
            currentStepIndex === treatmentPlan.steps.length - 1
              ? onComplete
              : goToStep(currentStepIndex + 1)
          }
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>
            {currentStepIndex === treatmentPlan.steps.length - 1 ? 'Finish' : 'Next'}
          </Text>
          <Ionicons
            name={currentStepIndex === treatmentPlan.steps.length - 1 ? 'checkmark' : 'chevron-forward'}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {/* Cost Breakdown Modal */}
      <Modal visible={showCostModal} animationType="slide" transparent onRequestClose={() => setShowCostModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Cost Breakdown
              </Text>
              <TouchableOpacity onPress={() => setShowCostModal(false)}>
                <Ionicons name="close" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {treatmentPlan.products.map((product, index) => (
                <View key={product.id} style={styles.costItem}>
                  <View style={styles.costItemHeader}>
                    <Text style={[styles.costItemName, { color: theme.textPrimary }]}>
                      {index + 1}. {product.name}
                    </Text>
                    <Text style={[styles.costItemPrice, { color: theme.textPrimary }]}>
                      ₹{(product.price_per_unit * treatmentPlan.steps.filter(s => s.product_id === product.id).length).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.costItemDetails}>
                    <Text style={[styles.costDetail, { color: theme.textSecondary }]}>
                      {product.active_ingredient} ({product.concentration})
                    </Text>
                    <Text style={[styles.costDetail, { color: theme.textSecondary }]}>
                      {product.application_method} • {product.unit} per hectare
                    </Text>
                    <Text style={[styles.costDetail, { color: theme.textSecondary }]}>
                      Pre-harvest interval: {product.pre_harvest_interval_days} days
                    </Text>
                  </View>
                </View>
              ))}

              <View style={styles.costTotal}>
                <Text style={[styles.costTotalLabel, { color: theme.textPrimary }]}>
                  Total Estimated Cost
                </Text>
                <Text style={[styles.costTotalValue, { color: theme.primary }]}>
                  ₹{treatmentPlan.total_estimated_cost.toLocaleString()} {treatmentPlan.currency}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Product Detail Modal */}
      <Modal visible={!!showProductDetail} animationType="slide" transparent onRequestClose={() => setShowProductDetail(null)}>
        {showProductDetail && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                  {showProductDetail.name}
                </Text>
                <TouchableOpacity onPress={() => setShowProductDetail(null)}>
                  <Ionicons name="close" size={28} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.productDetailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.textPrimary }]}>
                    Active Ingredient
                  </Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    {showProductDetail.active_ingredient} ({showProductDetail.concentration})
                  </Text>
                </View>

                <View style={styles.productDetailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.textPrimary }]}>
                    Application
                  </Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    Method: {showProductDetail.application_method}
                  </Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    Dosage: {showProductDetail.unit} per hectare
                  </Text>
                </View>

                <View style={styles.productDetailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.textPrimary }]}>
                    Safety Intervals
                  </Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    Pre-harvest: {showProductDetail.pre_harvest_interval_days} days
                  </Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    Re-entry: {showProductDetail.re_entry_interval_hours} hours
                  </Text>
                </View>

                <View style={styles.productDetailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.textPrimary }]}>
                    Price
                  </Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    ₹{showProductDetail.price_per_unit.toLocaleString()} per {showProductDetail.unit} ({showProductDetail.currency})
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      {/* Follow-up Modal */}
      <Modal visible={showFollowUp} animationType="slide" transparent onRequestClose={() => setShowFollowUp(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Follow-up Reminders
              </Text>
              <TouchableOpacity onPress={() => setShowFollowUp(false)}>
                <Ionicons name="close" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {treatmentPlan.follow_up_schedule.map((followUp, index) => (
                <View key={index} style={styles.followUpItem}>
                  <View style={styles.followUpDay}>
                    <Text style={[styles.followUpDayNumber, { color: theme.primary }]}>
                      Day {followUp.day}
                    </Text>
                  </View>
                  <Text style={[styles.followUpDescription, { color: theme.textPrimary }]}>
                    {followUp.description}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  costButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
  },
  costButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Progress
  progressContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },

  // Step Indicator
  stepIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stepIndicatorItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  stepLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#10B981',
    fontWeight: '600',
  },
  stepLabelDone: {
    color: '#10B981',
  },

  // Step Content
  stepContent: {
    flex: 1,
  },
  stepContentInner: {
    padding: 16,
    paddingBottom: 100,
  },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepBadgeNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  stepHeaderText: { flex: 1 },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  stepTiming: {
    fontSize: 13,
    marginTop: 2,
  },
  stepDescription: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  descText: {
    fontSize: 15,
    lineHeight: 24,
  },

  // Product Card
  productCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  productCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: { flex: 1 },
  productName: {
    fontSize: 15,
    fontWeight: '600',
  },
  productDosage: {
    fontSize: 13,
    marginTop: 2,
  },
  safetyNotes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  safetyText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },

  // Complete Button
  completeButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
  },
  completeButtonDone: {
    backgroundColor: '#ECFDF5',
  },
  completeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Voice Controls
  voiceControls: {
    marginTop: 16,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#ECFEFF',
    borderRadius: 10,
  },
  voiceButtonSpeaking: {
    backgroundColor: '#D1FAE5',
  },
  voiceButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Follow-up Section
  followUpSection: {
    marginTop: 8,
  },
  followUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  followUpIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  followUpTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  followUpSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  // Navigation
  navigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  navButtonPrimary: {
    flexDirection: 'row-reverse',
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
  },
  navButtonLast: {
    backgroundColor: '#059669',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalScroll: {
    padding: 20,
  },

  // Cost Items
  costItem: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  costItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  costItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  costItemPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  costItemDetails: {
    gap: 4,
  },
  costDetail: {
    fontSize: 13,
  },
  costTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  costTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  costTotalValue: {
    fontSize: 20,
    fontWeight: '700',
  },

  // Product Detail
  productDetailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Follow-up
  followUpItem: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  followUpDay: {
    width: 56,
    alignItems: 'center',
  },
  followUpDayNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  followUpDescription: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});

export default TreatmentWizard;