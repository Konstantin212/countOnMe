import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ProfileStackParamList } from '@app/navigationTypes';
import ActivityLevelCard from '@components/ActivityLevelCard';
import { useGoal } from '@hooks/useGoal';
import { useTheme } from '@hooks/useTheme';
import {
  ActivityLevel,
  Gender,
  GoalCalculateRequest,
  WeightChangePace,
  WeightGoalType,
} from '@models/types';
import { Button, FormField, NumericInput } from '@particles/index';
import {
  ACTIVITY_LEVEL_TIP,
  ACTIVITY_LEVELS,
} from '@services/constants/activityLevels';

type Props = NativeStackScreenProps<ProfileStackParamList, 'GoalCalculated'>;

const WEIGHT_GOAL_OPTIONS: { value: WeightGoalType; label: string; emoji: string }[] = [
  { value: 'lose', label: 'Lose weight', emoji: '📉' },
  { value: 'maintain', label: 'Maintain weight', emoji: '⚖️' },
  { value: 'gain', label: 'Gain weight', emoji: '📈' },
];

const PACE_OPTIONS: { value: WeightChangePace; label: string; description: string }[] = [
  { value: 'slow', label: 'Slow', description: '~0.25 kg/week' },
  { value: 'moderate', label: 'Moderate', description: '~0.5 kg/week' },
  { value: 'aggressive', label: 'Aggressive', description: '~0.75 kg/week' },
];

const GoalCalculatedScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { calculateGoal, goal } = useGoal();

  // Form state
  const [gender, setGender] = useState<Gender>(goal?.gender || 'male');
  const [birthDate, setBirthDate] = useState<Date>(
    goal?.birthDate ? new Date(goal.birthDate) : new Date(1990, 0, 1),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [heightCm, setHeightCm] = useState<number | undefined>(goal?.heightCm || undefined);
  const [currentWeightKg, setCurrentWeightKg] = useState<number | undefined>(
    goal?.currentWeightKg || undefined,
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    goal?.activityLevel || 'moderate',
  );
  const [weightGoalType, setWeightGoalType] = useState<WeightGoalType>(
    goal?.weightGoalType || 'maintain',
  );
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(
    goal?.targetWeightKg || undefined,
  );
  const [weightChangePace, setWeightChangePace] = useState<WeightChangePace>(
    goal?.weightChangePace || 'moderate',
  );

  const [calculating, setCalculating] = useState(false);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleCalculate = async () => {
    // Validation
    if (!heightCm || heightCm <= 0) {
      Alert.alert('Error', 'Please enter your height');
      return;
    }
    if (!currentWeightKg || currentWeightKg <= 0) {
      Alert.alert('Error', 'Please enter your current weight');
      return;
    }
    if (weightGoalType !== 'maintain' && (!targetWeightKg || targetWeightKg <= 0)) {
      Alert.alert('Error', 'Please enter your target weight');
      return;
    }

    const age = calculateAge(birthDate);
    if (age < 13) {
      Alert.alert('Error', 'You must be at least 13 years old');
      return;
    }
    if (age > 120) {
      Alert.alert('Error', 'Please enter a valid birth date');
      return;
    }

    setCalculating(true);

    try {
      const request: GoalCalculateRequest = {
        gender,
        birthDate: formatDate(birthDate),
        heightCm,
        currentWeightKg,
        activityLevel,
        weightGoalType,
        targetWeightKg: weightGoalType !== 'maintain' ? targetWeightKg : undefined,
        weightChangePace: weightGoalType !== 'maintain' ? weightChangePace : undefined,
      };

      const calculation = await calculateGoal(request);

      navigation.navigate('GoalCalculatedResult', {
        calculation,
        inputs: request,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Goal calculation failed:', error);
      Alert.alert('Error', `Failed to calculate goal: ${message}`);
    } finally {
      setCalculating(false);
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
    genderRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    genderButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.cardBackground,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
    },
    genderButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    genderEmoji: {
      fontSize: 28,
      marginBottom: 4,
    },
    genderLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    dateButton: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    dateLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    dateValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    inputHalf: {
      flex: 1,
    },
    tipCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.infoLight,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      gap: 8,
    },
    tipText: {
      flex: 1,
      fontSize: 13,
      color: colors.info,
      lineHeight: 18,
    },
    weightGoalRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    weightGoalButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 10,
      backgroundColor: colors.cardBackground,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
    },
    weightGoalButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    weightGoalEmoji: {
      fontSize: 20,
      marginBottom: 4,
    },
    weightGoalLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    paceRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    paceButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 10,
      backgroundColor: colors.cardBackground,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
    },
    paceButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    paceLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    paceDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
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
        <Text style={styles.headerTitle}>Calculate Goal</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Body Metrics Section */}
          <Text style={styles.sectionTitle}>Body Metrics</Text>

          {/* Gender */}
          <View style={styles.genderRow}>
            <Pressable
              style={[styles.genderButton, gender === 'male' && styles.genderButtonSelected]}
              onPress={() => setGender('male')}
            >
              <Text style={styles.genderEmoji}>👨</Text>
              <Text style={styles.genderLabel}>Male</Text>
            </Pressable>
            <Pressable
              style={[styles.genderButton, gender === 'female' && styles.genderButtonSelected]}
              onPress={() => setGender('female')}
            >
              <Text style={styles.genderEmoji}>👩</Text>
              <Text style={styles.genderLabel}>Female</Text>
            </Pressable>
          </View>

          {/* Birth Date */}
          <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateLabel}>Birth Date *</Text>
            <Text style={styles.dateValue}>
              {birthDate.toLocaleDateString()} (Age: {calculateAge(birthDate)})
            </Text>
          </Pressable>

          {showDatePicker && (
            <DateTimePicker
              value={birthDate}
              mode="date"
              display="spinner"
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setBirthDate(date);
              }}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
            />
          )}

          {/* Height and Weight */}
          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <FormField>
                <NumericInput
                  label="Height (cm)"
                  required
                  value={heightCm}
                  onChangeValue={setHeightCm}
                  placeholder="e.g., 175"
                  keyboardType="numeric"
                />
              </FormField>
            </View>
            <View style={styles.inputHalf}>
              <FormField>
                <NumericInput
                  label="Current Weight (kg)"
                  required
                  value={currentWeightKg}
                  onChangeValue={setCurrentWeightKg}
                  placeholder="e.g., 75"
                  keyboardType="numeric"
                />
              </FormField>
            </View>
          </View>

          {/* Activity Level Section */}
          <Text style={styles.sectionTitle}>Activity Level</Text>

          <View style={styles.tipCard}>
            <Ionicons name="information-circle" size={16} color={colors.info} />
            <Text style={styles.tipText}>{ACTIVITY_LEVEL_TIP}</Text>
          </View>

          {ACTIVITY_LEVELS.map((level) => (
            <ActivityLevelCard
              key={level.value}
              level={level}
              selected={activityLevel === level.value}
              onSelect={() => setActivityLevel(level.value)}
            />
          ))}

          {/* Your Goal Section */}
          <Text style={styles.sectionTitle}>Your Goal</Text>

          <View style={styles.weightGoalRow}>
            {WEIGHT_GOAL_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.weightGoalButton,
                  weightGoalType === option.value && styles.weightGoalButtonSelected,
                ]}
                onPress={() => setWeightGoalType(option.value)}
              >
                <Text style={styles.weightGoalEmoji}>{option.emoji}</Text>
                <Text style={styles.weightGoalLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Target Weight (if lose or gain) */}
          {weightGoalType !== 'maintain' && (
            <>
              <FormField>
                <NumericInput
                  label="Target Weight (kg)"
                  required
                  value={targetWeightKg}
                  onChangeValue={setTargetWeightKg}
                  placeholder="e.g., 70"
                  keyboardType="numeric"
                />
              </FormField>

              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
                Pace of Change
              </Text>

              <View style={styles.paceRow}>
                {PACE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.paceButton,
                      weightChangePace === option.value && styles.paceButtonSelected,
                    ]}
                    onPress={() => setWeightChangePace(option.value)}
                  >
                    <Text style={styles.paceLabel}>{option.label}</Text>
                    <Text style={styles.paceDesc}>{option.description}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={handleCalculate} loading={calculating} disabled={calculating}>
          Calculate
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default GoalCalculatedScreen;
