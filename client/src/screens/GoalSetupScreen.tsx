import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { ProfileStackParamList } from '@app/navigationTypes';
import { useGoal } from '@hooks/useGoal';
import { useTheme } from '@hooks/useTheme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'GoalSetup'>;

const GoalSetupScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { goal, deleteGoal, loading } = useGoal();

  const handleDeleteGoal = async () => {
    try {
      await deleteGoal();
    } catch {
      // Error is logged in hook
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
    },
    questionText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    optionCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionCardPressed: {
      backgroundColor: colors.pressed,
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    optionIcon: {
      fontSize: 28,
      marginRight: 12,
    },
    optionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    optionDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    currentGoalCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 20,
      marginTop: 24,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    currentGoalTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    goalStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 16,
    },
    goalStat: {
      alignItems: 'center',
    },
    goalStatValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    goalStatLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    macroRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 16,
    },
    macroItem: {
      alignItems: 'center',
    },
    macroValue: {
      fontSize: 16,
      fontWeight: '600',
    },
    macroLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    goalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    editButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    editButtonText: {
      color: colors.buttonText,
      fontWeight: '600',
      fontSize: 14,
    },
    deleteButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.errorLight,
      alignItems: 'center',
    },
    deleteButtonText: {
      color: colors.error,
      fontWeight: '600',
      fontSize: 14,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 40,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>My Goal</Text>
        </View>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Goal</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.questionText}>How do you want to set your goal?</Text>

          {/* Calculate Goal Option */}
          <Pressable
            style={({ pressed }) => [styles.optionCard, pressed && styles.optionCardPressed]}
            onPress={() => navigation.navigate('GoalCalculated')}
          >
            <View style={styles.optionHeader}>
              <Text style={styles.optionIcon}>🎯</Text>
              <Text style={styles.optionTitle}>Calculate my goal</Text>
            </View>
            <Text style={styles.optionDescription}>
              Based on your body metrics and activity level. We'll calculate your BMR,
              TDEE, and recommend daily calories and macros.
            </Text>
          </Pressable>

          {/* Manual Goal Option */}
          <Pressable
            style={({ pressed }) => [styles.optionCard, pressed && styles.optionCardPressed]}
            onPress={() => navigation.navigate('GoalManual')}
          >
            <View style={styles.optionHeader}>
              <Text style={styles.optionIcon}>📊</Text>
              <Text style={styles.optionTitle}>I know my calories</Text>
            </View>
            <Text style={styles.optionDescription}>
              Enter your daily calorie target and macro percentages directly. Best for
              experienced users who already know their numbers.
            </Text>
          </Pressable>

          {/* Current Goal Display */}
          {goal && (
            <View style={styles.currentGoalCard}>
              <Text style={styles.currentGoalTitle}>Current Goal</Text>

              <View style={styles.goalStats}>
                <View style={styles.goalStat}>
                  <Text style={styles.goalStatValue}>{goal.dailyCaloriesKcal}</Text>
                  <Text style={styles.goalStatLabel}>kcal/day</Text>
                </View>
                <View style={styles.goalStat}>
                  <Text style={styles.goalStatValue}>{goal.waterMl}</Text>
                  <Text style={styles.goalStatLabel}>ml water</Text>
                </View>
              </View>

              <View style={styles.macroRow}>
                <View style={styles.macroItem}>
                  <Text style={[styles.macroValue, { color: colors.macroProtein }]}>
                    {goal.proteinGrams}g
                  </Text>
                  <Text style={styles.macroLabel}>Protein ({goal.proteinPercent}%)</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={[styles.macroValue, { color: colors.macroCarb }]}>
                    {goal.carbsGrams}g
                  </Text>
                  <Text style={styles.macroLabel}>Carbs ({goal.carbsPercent}%)</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={[styles.macroValue, { color: colors.macroFat }]}>
                    {goal.fatGrams}g
                  </Text>
                  <Text style={styles.macroLabel}>Fat ({goal.fatPercent}%)</Text>
                </View>
              </View>

              <View style={styles.goalActions}>
                <Pressable
                  style={styles.editButton}
                  onPress={() =>
                    goal.goalType === 'calculated'
                      ? navigation.navigate('GoalCalculated')
                      : navigation.navigate('GoalManual')
                  }
                >
                  <Text style={styles.editButtonText}>Edit Goal</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={handleDeleteGoal}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default GoalSetupScreen;
