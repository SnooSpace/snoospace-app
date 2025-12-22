import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS } from '../constants/theme';

const LIGHT_GRAY = '#E5E5EA';
const TEXT_COLOR = '#1C1C1E';

/**
 * StepIndicator - Progress indicator for multi-step forms
 * Shows current step, completed steps, and remaining steps
 * Updated with Blue/Cyan gradient aesthetic
 */
const StepIndicator = ({ currentStep, totalSteps, stepLabels = [] }) => {
  return (
    <View style={styles.container}>
      {/* Step dots */}
      <View style={styles.stepsContainer}>
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <React.Fragment key={stepNumber}>
              <View style={styles.stepWrapper}>
                {/* Step circle */}
                {(isCurrent || isCompleted) ? (
                  <View style={[styles.stepCircleOuter, isCurrent && styles.stepCircleGlow]}>
                    <LinearGradient
                      colors={COLORS.primaryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.stepCircleGradient}
                    >
                      <Text style={styles.stepNumberActive}>
                        {stepNumber}
                      </Text>
                    </LinearGradient>
                  </View>
                ) : (
                  <View style={styles.stepCircleUpcoming}>
                    <Text style={styles.stepNumberUpcoming}>
                      {stepNumber}
                    </Text>
                  </View>
                )}

                {/* Step label */}
                {stepLabels[index] && (
                  <Text
                    style={[
                      styles.stepLabel,
                      isCurrent && styles.stepLabelCurrent,
                    ]}
                    numberOfLines={2}
                  >
                    {stepLabels[index]}
                  </Text>
                )}
              </View>

              {/* Connector line (except after last step) */}
              {stepNumber < totalSteps && (
                <View
                  style={[
                    styles.connector,
                    isCompleted && styles.connectorCompleted,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Progress text */}
      <Text style={styles.progressText}>
        Step {currentStep} of {totalSteps}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircleOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  stepCircleGlow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  stepCircleGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stepCircleUpcoming: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: LIGHT_GRAY,
  },
  stepNumberActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepNumberUpcoming: {
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT_GRAY,
  },
  stepLabel: {
    marginTop: 8,
    fontSize: 10,
    color: '#8E8E93',
    textAlign: 'center',
    maxWidth: 80,
  },
  stepLabelCurrent: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  connector: {
    height: 3,
    backgroundColor: LIGHT_GRAY,
    marginTop: 14,
    flex: 0.5,
    borderRadius: 1.5,
  },
  connectorCompleted: {
    backgroundColor: COLORS.primary,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 5,
  },
});

export default StepIndicator;
