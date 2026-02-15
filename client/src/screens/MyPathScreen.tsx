import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useTheme } from "@hooks/useTheme";
import { useGoal } from "@hooks/useGoal";
import { useBodyWeight } from "@hooks/useBodyWeight";
import { useStatsRange } from "@hooks/useStatsRange";
import {
  calculateStreak,
  calculateMacroAdherence,
  deriveGoalPace,
  calculateWeightDelta,
} from "@services/utils/insights";
import { GoalProgressCard } from "@components/GoalProgressCard";
import { WeightChart } from "@components/WeightChart";
import { CalorieTrendBars } from "@components/CalorieTrendBars";
import { MacroAdherenceCard } from "@components/MacroAdherenceCard";
import { StreaksCard } from "@components/StreaksCard";
import { LogWeightModal } from "@components/LogWeightModal";
import type { RootTabParamList } from "@app/navigationTypes";
import type { StatsPeriod } from "@models/types";

const MyPathScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  // Hooks
  const { goal, loading: goalLoading, refresh: refreshGoal } = useGoal();
  const {
    weights,
    loading: weightsLoading,
    logWeight,
    refresh: refreshWeights,
  } = useBodyWeight();
  const {
    dailyStats,
    period,
    setPeriod,
    loading: statsLoading,
    refresh: refreshStats,
  } = useStatsRange();

  // Modal state
  const [isWeightModalVisible, setIsWeightModalVisible] = useState(false);

  // Derived data
  const weightDelta = goal ? calculateWeightDelta(weights, goal) : null;
  const pace = goal ? deriveGoalPace(weights, goal) : "no_data";
  const trackedDays = dailyStats.map((s) => s.day);
  const streak = calculateStreak(trackedDays);
  const adherence = goal
    ? calculateMacroAdherence(dailyStats, goal)
    : { protein: 0, carbs: 0, fat: 0 };
  const latestWeight =
    weights.length > 0 ? weights[weights.length - 1].weightKg : null;
  const calorieGoal = goal?.dailyCaloriesKcal ?? 2000;

  // Loading state
  const isLoading = goalLoading || weightsLoading || statsLoading;

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshGoal(), refreshWeights(), refreshStats()]);
  }, [refreshGoal, refreshWeights, refreshStats]);

  // Handle period selection
  const handlePeriodChange = (newPeriod: StatsPeriod) => {
    setPeriod(newPeriod);
  };

  // Handle goal setup navigation
  const handleSetupGoal = () => {
    navigation.navigate("ProfileTab", { screen: "GoalSetup" });
  };

  // Handle weight logging
  const handleLogWeight = async (day: string, weightKg: number) => {
    await logWeight(day, weightKg);
    await refreshWeights();
  };

  // Handle FAB press
  const handleFabPress = () => {
    setIsWeightModalVisible(true);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      gap: 16,
      paddingBottom: 100,
    },
    header: {
      marginBottom: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.text,
    },
    periodSelector: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 8,
    },
    periodButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: "center",
      borderWidth: 1,
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodButtonInactive: {
      backgroundColor: colors.background,
      borderColor: colors.border,
    },
    periodTextActive: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.buttonText,
    },
    periodTextInactive: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    fab: {
      position: "absolute",
      bottom: 32,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: colors.shadow,
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>My Path</Text>
          </View>

          <GoalProgressCard
            goal={goal}
            weightDelta={weightDelta}
            pace={pace}
            latestWeight={latestWeight}
            onSetupGoal={handleSetupGoal}
          />

          <View style={styles.periodSelector}>
            <Pressable
              style={[
                styles.periodButton,
                period === "7d"
                  ? styles.periodButtonActive
                  : styles.periodButtonInactive,
              ]}
              onPress={() => handlePeriodChange("7d")}
              testID="period-7d"
            >
              <Text
                style={
                  period === "7d"
                    ? styles.periodTextActive
                    : styles.periodTextInactive
                }
              >
                7 Days
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.periodButton,
                period === "30d"
                  ? styles.periodButtonActive
                  : styles.periodButtonInactive,
              ]}
              onPress={() => handlePeriodChange("30d")}
              testID="period-30d"
            >
              <Text
                style={
                  period === "30d"
                    ? styles.periodTextActive
                    : styles.periodTextInactive
                }
              >
                30 Days
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.periodButton,
                period === "90d"
                  ? styles.periodButtonActive
                  : styles.periodButtonInactive,
              ]}
              onPress={() => handlePeriodChange("90d")}
              testID="period-90d"
            >
              <Text
                style={
                  period === "90d"
                    ? styles.periodTextActive
                    : styles.periodTextInactive
                }
              >
                90 Days
              </Text>
            </Pressable>
          </View>

          <WeightChart
            weights={weights}
            targetWeight={goal?.targetWeightKg}
            healthyMin={goal?.healthyWeightMinKg}
            healthyMax={goal?.healthyWeightMaxKg}
          />

          <CalorieTrendBars dailyStats={dailyStats} calorieGoal={calorieGoal} />

          {goal && <MacroAdherenceCard adherence={adherence} goal={goal} />}

          <StreaksCard streak={streak} />
        </ScrollView>
      )}

      <Pressable
        style={styles.fab}
        onPress={handleFabPress}
        testID="fab-log-weight"
      >
        <Ionicons name="add" size={28} color={colors.buttonText} />
      </Pressable>

      <LogWeightModal
        visible={isWeightModalVisible}
        onClose={() => setIsWeightModalVisible(false)}
        onSave={handleLogWeight}
        initialWeight={latestWeight ?? undefined}
      />
    </SafeAreaView>
  );
};

export default MyPathScreen;
