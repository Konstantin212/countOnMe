import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { ProfileStackParamList } from '@app/navigationTypes';
import BmiScale from '@components/BmiScale';
import { useGoal } from '@hooks/useGoal';
import { useTheme } from '@hooks/useTheme';
import { BmiCategory, GoalCreateCalculatedRequest } from '@models/types';
import { Button, FormField, NumericInput } from '@particles/index';

type Props = NativeStackScreenProps<ProfileStackParamList, 'GoalCalculatedResult'>;

const GoalCalculatedResultScreen = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { saveCalculatedGoal } = useGoal();
  const { calculation, inputs } = route.params;

  // Customizable values
  const [proteinPercent, setProteinPercent] = useState(calculation.proteinPercent);
  const [carbsPercent, setCarbsPercent] = useState(calculation.carbsPercent);
  const [fatPercent, setFatPercent] = useState(calculation.fatPercent);
  const [waterMl, setWaterMl] = useState(calculation.waterMl);

  const [saving, setSaving] = useState(false);

  const macroTotal = proteinPercent + carbsPercent + fatPercent;
  const isMacroValid = macroTotal === 100;

  // Recalculate grams based on custom percentages
  const calculateGrams = (calories: number, percent: number, caloriesPerGram: number) => {
    return Math.round((calories * percent) / 100 / caloriesPerGram);
  };

  const proteinGrams = calculateGrams(calculation.dailyCaloriesKcal, proteinPercent, 4);
  const carbsGrams = calculateGrams(calculation.dailyCaloriesKcal, carbsPercent, 4);
  const fatGrams = calculateGrams(calculation.dailyCaloriesKcal, fatPercent, 9);

  const handleSave = async () => {
    if (!isMacroValid) {
      Alert.alert('Error', 'Macro percentages must sum to 100%');
      return;
    }

    setSaving(true);

    try {
      const request: GoalCreateCalculatedRequest = {
        ...inputs,
        proteinPercent,
        carbsPercent,
        fatPercent,
        waterMl,
      };

      await saveCalculatedGoal(request);

      // Navigate back to profile
      navigation.popToTop();
    } catch (error) {
      Alert.alert('Error', 'Failed to save goal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getDeficitSurplus = () => {
    const diff = calculation.dailyCaloriesKcal - calculation.tdeeKcal;
    if (diff === 0) return 'maintenance';
    if (diff < 0) return `${Math.abs(diff)} kcal deficit/day`;
    return `${diff} kcal surplus/day`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.cardBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 100,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
      marginTop: 24,
    },
    metabolismCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metabolismRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    metabolismLabel: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    metabolismValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    targetsCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 20,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
    },
    caloriesValue: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.primary,
    },
    caloriesLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    deficitText: {
      fontSize: 14,
      color: colors.success,
      marginTop: 8,
      fontWeight: '500',
    },
    macrosRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 20,
      width: '100%',
    },
    macroItem: {
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
    },
    macroValue: {
      fontSize: 20,
      fontWeight: '700',
    },
    macroPercent: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    macroLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
    waterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      gap: 8,
    },
    waterText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    customizeCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    macroInputRow: {
      flexDirection: 'row',
      gap: 12,
    },
    macroInputItem: {
      flex: 1,
    },
    macroTotalRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    macroTotalText: {
      fontSize: 14,
      fontWeight: '600',
    },
    macroTotalValid: {
      color: colors.success,
    },
    macroTotalInvalid: {
      color: colors.error,
    },
    waterInput: {
      marginTop: 12,
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Your Goal</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* BMI Scale */}
          <BmiScale
            currentBmi={calculation.currentBmi}
            bmiCategory={calculation.bmiCategory as BmiCategory}
            healthyWeightMinKg={calculation.healthyWeightMinKg}
            healthyWeightMaxKg={calculation.healthyWeightMaxKg}
            currentWeightKg={inputs.currentWeightKg}
            heightCm={inputs.heightCm}
          />

          {/* Metabolism Section */}
          <Text style={styles.sectionTitle}>Your Metabolism</Text>
          <View style={styles.metabolismCard}>
            <View style={styles.metabolismRow}>
              <Text style={styles.metabolismLabel}>BMR (at rest)</Text>
              <Text style={styles.metabolismValue}>{calculation.bmrKcal} kcal</Text>
            </View>
            <View style={[styles.metabolismRow, { marginBottom: 0 }]}>
              <Text style={styles.metabolismLabel}>TDEE (with activity)</Text>
              <Text style={styles.metabolismValue}>{calculation.tdeeKcal} kcal</Text>
            </View>
          </View>

          {/* Daily Targets Section */}
          <Text style={styles.sectionTitle}>Daily Targets</Text>
          <View style={styles.targetsCard}>
            <Text style={styles.caloriesValue}>
              🔥 {calculation.dailyCaloriesKcal}
            </Text>
            <Text style={styles.caloriesLabel}>kcal/day</Text>
            <Text style={styles.deficitText}>{getDeficitSurplus()}</Text>

            <View style={styles.macrosRow}>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: colors.macroProtein }]}>
                  {proteinGrams}g
                </Text>
                <Text style={styles.macroPercent}>{proteinPercent}%</Text>
                <Text style={[styles.macroLabel, { color: colors.macroProtein }]}>
                  Protein
                </Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: colors.macroCarb }]}>
                  {carbsGrams}g
                </Text>
                <Text style={styles.macroPercent}>{carbsPercent}%</Text>
                <Text style={[styles.macroLabel, { color: colors.macroCarb }]}>
                  Carbs
                </Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: colors.macroFat }]}>
                  {fatGrams}g
                </Text>
                <Text style={styles.macroPercent}>{fatPercent}%</Text>
                <Text style={[styles.macroLabel, { color: colors.macroFat }]}>Fat</Text>
              </View>
            </View>

            <View style={styles.waterRow}>
              <Text>💧</Text>
              <Text style={styles.waterText}>{waterMl} ml water/day</Text>
            </View>
          </View>

          {/* Customize Section */}
          <Text style={styles.sectionTitle}>Customize (Optional)</Text>
          <View style={styles.customizeCard}>
            <View style={styles.macroInputRow}>
              <View style={styles.macroInputItem}>
                <FormField>
                  <NumericInput
                    label="Protein %"
                    value={proteinPercent}
                    onChangeValue={(v) => setProteinPercent(v || 0)}
                    keyboardType="numeric"
                  />
                </FormField>
              </View>
              <View style={styles.macroInputItem}>
                <FormField>
                  <NumericInput
                    label="Carbs %"
                    value={carbsPercent}
                    onChangeValue={(v) => setCarbsPercent(v || 0)}
                    keyboardType="numeric"
                  />
                </FormField>
              </View>
              <View style={styles.macroInputItem}>
                <FormField>
                  <NumericInput
                    label="Fat %"
                    value={fatPercent}
                    onChangeValue={(v) => setFatPercent(v || 0)}
                    keyboardType="numeric"
                  />
                </FormField>
              </View>
            </View>

            <View style={styles.macroTotalRow}>
              <Text
                style={[
                  styles.macroTotalText,
                  isMacroValid ? styles.macroTotalValid : styles.macroTotalInvalid,
                ]}
              >
                Total: {macroTotal}% {isMacroValid ? '✓' : '(must be 100%)'}
              </Text>
            </View>

            <View style={styles.waterInput}>
              <FormField>
                <NumericInput
                  label="Water (ml)"
                  value={waterMl}
                  onChangeValue={(v) => setWaterMl(v || 0)}
                  keyboardType="numeric"
                />
              </FormField>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          onPress={handleSave}
          loading={saving}
          disabled={saving || !isMacroValid}
        >
          Save Goal
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default GoalCalculatedResultScreen;
