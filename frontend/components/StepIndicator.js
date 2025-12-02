import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PRIMARY_COLOR = '#6B46C1';
const LIGHT_GRAY = '#E5E5EA';
const TEXT_COLOR = '#1C1C1E';

/**
 * StepIndicator - Progress indicator for multi-step forms
 * Shows current step, completed steps, and remaining steps
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
                <View
                  style={[
                    styles.stepCircle,
                    isCompleted && styles.stepCircleCompleted,
                    isCurrent && styles.stepCircleCurrent,
                    isUpcoming && styles.stepCircleUpcoming,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepNumber,
                      isCompleted && styles.stepNumberCompleted,
                      isCurrent && styles.stepNumberCurrent,
                      isUpcoming && styles.stepNumberUpcoming,
                    ]}
                  >
                    {stepNumber}
                  </Text>
                </View>

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
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  stepCircleCompleted: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  stepCircleCurrent: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  stepCircleUpcoming: {
    backgroundColor: '#FFFFFF',
    borderColor: LIGHT_GRAY,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepNumberCompleted: {
    color: '#FFFFFF',
  },
  stepNumberCurrent: {
    color: '#FFFFFF',
  },
  stepNumberUpcoming: {
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
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  connector: {
    height: 2,
    backgroundColor: LIGHT_GRAY,
    marginTop: 15,
    flex: 0.5,
  },
  connectorCompleted: {
    backgroundColor: PRIMARY_COLOR,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 5,
  },
});

export default StepIndicator;
