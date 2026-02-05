import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { ProfileStackParamList } from '@app/navigationTypes';
import { useGoal } from '@hooks/useGoal';
import { useTheme } from '@hooks/useTheme';
import { GoalCreateManualRequest } from '@models/types';
import { Button, FormField, NumericInput } from '@particles/index';

type Props = NativeStackScreenProps<ProfileStackParamList, 'GoalManual'>;

const GoalManualScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { saveManualGoal, goal } = useGoal();

  // Form state - pre-fill from existing goal if manual type
  const existingManualGoal = goal?.goalType === 'manual' ? goal : null;

  const [dailyCaloriesKcal, setDailyCaloriesKcal] = useState<number | undefined>(
    existingManualGoal?.dailyCaloriesKcal || undefined,
  );
  const [proteinPercent, setProteinPercent] = useState<number>(
    existingManualGoal?.proteinPercent || 30,
  );
  const [carbsPercent, setCarbsPercent] = useState<number>(
    existingManualGoal?.carbsPercent || 40,
  );
  const [fatPercent, setFatPercent] = useState<number>(
    existingManualGoal?.fatPercent || 30,
  );
  const [waterMl, setWaterMl] = useState<number>(
    existingManualGoal?.waterMl || 2500,
  );

  const [saving, setSaving] = useState(false);

  const macroTotal = proteinPercent + carbsPercent + fatPercent;
  const isMacroValid = macroTotal === 100;

  // Calculate grams based on calories and percentages
  const calculateGrams = (calories: number, percent: number, caloriesPerGram: number) => {
    return Math.round((calories * percent) / 100 / caloriesPerGram);
  };

  const proteinGrams = dailyCaloriesKcal
    ? calculateGrams(dailyCaloriesKcal, proteinPercent, 4)
    : 0;
  const carbsGrams = dailyCaloriesKcal
    ? calculateGrams(dailyCaloriesKcal, carbsPercent, 4)
    : 0;
  const fatGrams = dailyCaloriesKcal
    ? calculateGrams(dailyCaloriesKcal, fatPercent, 9)
    : 0;

  const handleSave = async () => {
    // Validation
    if (!dailyCaloriesKcal || dailyCaloriesKcal <= 0) {
      Alert.alert('Error', 'Please enter your daily calorie target');
      return;
    }
    if (!isMacroValid) {
      Alert.alert('Error', 'Macro percentages must sum to 100%');
      return;
    }

    setSaving(true);

    try {
      const request: GoalCreateManualRequest = {
        dailyCaloriesKcal,
        proteinPercent,
        carbsPercent,
        fatPercent,
        waterMl,
      };

      await saveManualGoal(request);

      // Navigate back to profile
      navigation.popToTop();
    } catch (error) {
      Alert.alert('Error', 'Failed to save goal. Please try again.');
    } finally {
      setSaving(false);
    }
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
      marginTop: 16,
    },
    card: {
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
    macroGramsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    macroGramsItem: {
      alignItems: 'center',
    },
    macroGramsValue: {
      fontSize: 18,
      fontWeight: '700',
    },
    macroGramsLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    macroTotalRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 12,
      paddingTop: 12,
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
    previewCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 20,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      marginTop: 16,
    },
    previewTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
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
    macrosPreviewRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 20,
      width: '100%',
    },
    macroPreviewItem: {
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
    },
    macroPreviewValue: {
      fontSize: 18,
      fontWeight: '700',
    },
    macroPreviewPercent: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    macroPreviewLabel: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
    },
    waterPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      gap: 8,
    },
    waterPreviewText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
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
        <Text style={styles.headerTitle}>Set Goal Manually</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Daily Calorie Target */}
          <Text style={styles.sectionTitle}>Daily Calorie Target</Text>
          <View style={styles.card}>
            <FormField>
              <NumericInput
                label="Calories (kcal)"
                required
                value={dailyCaloriesKcal}
                onChangeValue={setDailyCaloriesKcal}
                placeholder="e.g., 2000"
                keyboardType="numeric"
              />
            </FormField>
          </View>

          {/* Macronutrient Split */}
          <Text style={styles.sectionTitle}>Macronutrient Split</Text>
          <View style={styles.card}>
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

            {dailyCaloriesKcal && dailyCaloriesKcal > 0 && (
              <View style={styles.macroGramsRow}>
                <View style={styles.macroGramsItem}>
                  <Text style={[styles.macroGramsValue, { color: colors.macroProtein }]}>
                    {proteinGrams}g
                  </Text>
                  <Text style={styles.macroGramsLabel}>Protein</Text>
                </View>
                <View style={styles.macroGramsItem}>
                  <Text style={[styles.macroGramsValue, { color: colors.macroCarb }]}>
                    {carbsGrams}g
                  </Text>
                  <Text style={styles.macroGramsLabel}>Carbs</Text>
                </View>
                <View style={styles.macroGramsItem}>
                  <Text style={[styles.macroGramsValue, { color: colors.macroFat }]}>
                    {fatGrams}g
                  </Text>
                  <Text style={styles.macroGramsLabel}>Fat</Text>
                </View>
              </View>
            )}

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
          </View>

          {/* Hydration */}
          <Text style={styles.sectionTitle}>Hydration</Text>
          <View style={styles.card}>
            <FormField>
              <NumericInput
                label="Water (ml)"
                value={waterMl}
                onChangeValue={(v) => setWaterMl(v || 0)}
                placeholder="e.g., 2500"
                keyboardType="numeric"
              />
            </FormField>
          </View>

          {/* Preview */}
          {dailyCaloriesKcal && dailyCaloriesKcal > 0 && isMacroValid && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Your Daily Goal</Text>
              <Text style={styles.caloriesValue}>🔥 {dailyCaloriesKcal}</Text>
              <Text style={styles.caloriesLabel}>kcal/day</Text>

              <View style={styles.macrosPreviewRow}>
                <View style={styles.macroPreviewItem}>
                  <Text style={[styles.macroPreviewValue, { color: colors.macroProtein }]}>
                    {proteinGrams}g
                  </Text>
                  <Text style={styles.macroPreviewPercent}>{proteinPercent}%</Text>
                  <Text style={[styles.macroPreviewLabel, { color: colors.macroProtein }]}>
                    Protein
                  </Text>
                </View>
                <View style={styles.macroPreviewItem}>
                  <Text style={[styles.macroPreviewValue, { color: colors.macroCarb }]}>
                    {carbsGrams}g
                  </Text>
                  <Text style={styles.macroPreviewPercent}>{carbsPercent}%</Text>
                  <Text style={[styles.macroPreviewLabel, { color: colors.macroCarb }]}>
                    Carbs
                  </Text>
                </View>
                <View style={styles.macroPreviewItem}>
                  <Text style={[styles.macroPreviewValue, { color: colors.macroFat }]}>
                    {fatGrams}g
                  </Text>
                  <Text style={styles.macroPreviewPercent}>{fatPercent}%</Text>
                  <Text style={[styles.macroPreviewLabel, { color: colors.macroFat }]}>
                    Fat
                  </Text>
                </View>
              </View>

              <View style={styles.waterPreviewRow}>
                <Text>💧</Text>
                <Text style={styles.waterPreviewText}>{waterMl} ml water/day</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          onPress={handleSave}
          loading={saving}
          disabled={saving || !dailyCaloriesKcal || !isMacroValid}
        >
          Save Goal
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default GoalManualScreen;
