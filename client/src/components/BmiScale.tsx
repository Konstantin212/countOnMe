import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@hooks/useTheme';
import { BmiCategory } from '@models/types';

interface BmiScaleProps {
  currentBmi: number;
  bmiCategory: BmiCategory;
  healthyWeightMinKg: number;
  healthyWeightMaxKg: number;
  currentWeightKg: number;
  heightCm: number;
}

const BMI_LABELS: Record<BmiCategory, string> = {
  underweight: 'Underweight',
  normal: 'Normal weight',
  overweight: 'Overweight',
  obese: 'Obese',
};

export const BmiScale = ({
  currentBmi,
  bmiCategory,
  healthyWeightMinKg,
  healthyWeightMaxKg,
  currentWeightKg,
  heightCm,
}: BmiScaleProps) => {
  const { colors } = useTheme();

  // Calculate position on scale (BMI 15-35 range for display)
  const minBmi = 15;
  const maxBmi = 35;
  const position = ((currentBmi - minBmi) / (maxBmi - minBmi)) * 100;
  const clampedPosition = Math.max(5, Math.min(95, position));

  // Color based on category
  const categoryColors: Record<BmiCategory, string> = {
    underweight: colors.warning,
    normal: colors.success,
    overweight: colors.warning,
    obese: colors.error,
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    rangeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    rangeValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    rangeLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    scaleContainer: {
      flexDirection: 'row',
      height: 12,
      borderRadius: 6,
      overflow: 'hidden',
      position: 'relative',
      marginBottom: 8,
    },
    segment: {
      height: '100%',
    },
    segmentUnderweight: {
      flex: 1,
      backgroundColor: colors.warningLight,
    },
    segmentNormal: {
      flex: 2,
      backgroundColor: colors.successLight,
    },
    segmentOverweight: {
      flex: 1.5,
      backgroundColor: colors.warningLight,
    },
    segmentObese: {
      flex: 1.5,
      backgroundColor: colors.errorLight,
    },
    markerContainer: {
      position: 'absolute',
      top: -4,
      width: 20,
      height: 20,
      marginLeft: -10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    marker: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 3,
      borderColor: colors.cardBackground,
    },
    labelsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 16,
    },
    scaleLabel: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    statsContainer: {
      alignItems: 'center',
      marginBottom: 12,
    },
    currentWeight: {
      fontSize: 15,
      color: colors.text,
      marginBottom: 4,
    },
    bmiValue: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 4,
    },
    categoryLabel: {
      fontSize: 16,
      fontWeight: '600',
    },
    disclaimer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.infoLight,
      padding: 12,
      borderRadius: 8,
      gap: 8,
    },
    disclaimerText: {
      flex: 1,
      fontSize: 12,
      color: colors.info,
      lineHeight: 18,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Healthy Weight for Your Height</Text>
      <Text style={styles.subtitle}>Based on your height of {heightCm} cm</Text>

      {/* Healthy range text */}
      <View style={styles.rangeRow}>
        <Text style={styles.rangeValue}>{healthyWeightMinKg.toFixed(1)} kg</Text>
        <Text style={styles.rangeLabel}>healthy range</Text>
        <Text style={styles.rangeValue}>{healthyWeightMaxKg.toFixed(1)} kg</Text>
      </View>

      {/* Visual scale */}
      <View style={styles.scaleContainer}>
        <View style={[styles.segment, styles.segmentUnderweight]} />
        <View style={[styles.segment, styles.segmentNormal]} />
        <View style={[styles.segment, styles.segmentOverweight]} />
        <View style={[styles.segment, styles.segmentObese]} />

        {/* Current position marker */}
        <View style={[styles.markerContainer, { left: `${clampedPosition}%` }]}>
          <View
            style={[styles.marker, { backgroundColor: categoryColors[bmiCategory] }]}
          />
        </View>
      </View>

      {/* BMI labels */}
      <View style={styles.labelsRow}>
        <Text style={styles.scaleLabel}>18.5</Text>
        <Text style={styles.scaleLabel}>25</Text>
        <Text style={styles.scaleLabel}>30</Text>
      </View>

      {/* Current stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.currentWeight}>Your weight: {currentWeightKg} kg</Text>
        <Text style={[styles.bmiValue, { color: categoryColors[bmiCategory] }]}>
          BMI: {currentBmi.toFixed(1)}
        </Text>
        <Text style={[styles.categoryLabel, { color: categoryColors[bmiCategory] }]}>
          {BMI_LABELS[bmiCategory]}
        </Text>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={16} color={colors.info} />
        <Text style={styles.disclaimerText}>
          BMI is a general guide. Athletes and muscular individuals may have a higher
          weight while being healthy.
        </Text>
      </View>
    </View>
  );
};

export default BmiScale;
