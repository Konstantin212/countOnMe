import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@hooks/useTheme";
import { Button } from "@particles/Button";
import type { UserGoal, GoalPace } from "@models/types";

type GoalProgressCardProps = {
  goal: UserGoal | null;
  weightDelta: {
    lost: number;
    remaining: number;
    percentComplete: number;
  } | null;
  pace: GoalPace;
  latestWeight: number | null;
  onSetupGoal?: () => void;
};

export const GoalProgressCard = ({
  goal,
  weightDelta,
  pace,
  latestWeight,
  onSetupGoal,
}: GoalProgressCardProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    card: {
      width: "100%",
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
      elevation: 3,
      gap: 12,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    emptyContainer: {
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    weightRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    weightText: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    arrow: {
      fontSize: 16,
      color: colors.textSecondary,
      marginHorizontal: 8,
    },
    deltaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    deltaLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    deltaValue: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    progressContainer: {
      marginTop: 4,
    },
    progressBar: {
      height: 10,
      backgroundColor: colors.borderLight,
      borderRadius: 8,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.success,
      borderRadius: 8,
    },
    paceBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      marginTop: 4,
    },
    paceBadgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    calorieGoalText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
  });

  const getPaceBadgeStyle = () => {
    switch (pace) {
      case "ahead":
        return { backgroundColor: colors.successLight };
      case "on_track":
        return { backgroundColor: colors.infoLight };
      case "behind":
        return { backgroundColor: colors.warningLight };
      case "no_data":
      default:
        return { backgroundColor: colors.borderLight };
    }
  };

  const getPaceTextColor = () => {
    switch (pace) {
      case "ahead":
        return colors.success;
      case "on_track":
        return colors.info;
      case "behind":
        return colors.warning;
      case "no_data":
      default:
        return colors.textSecondary;
    }
  };

  const getPaceLabel = () => {
    switch (pace) {
      case "ahead":
        return "Ahead";
      case "on_track":
        return "On Track";
      case "behind":
        return "Behind";
      case "no_data":
      default:
        return "No Data";
    }
  };

  // No goal set - show CTA
  if (!goal) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Your Progress</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Set a goal to track your path</Text>
          {onSetupGoal && (
            <Button
              variant="primary"
              onPress={onSetupGoal}
              fullWidth={false}
              testID="setup-goal-button"
            >
              Set Up Goal
            </Button>
          )}
        </View>
      </View>
    );
  }

  // Manual goal (no weight tracking)
  if (goal.goalType === "manual" || !goal.targetWeightKg) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Your Goal</Text>
        <Text style={styles.calorieGoalText}>
          Daily target: {Math.round(goal.dailyCaloriesKcal)} kcal
        </Text>
      </View>
    );
  }

  // Calculated goal with weight tracking
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Progress</Text>
        <View style={[styles.paceBadge, getPaceBadgeStyle()]}>
          <Text style={[styles.paceBadgeText, { color: getPaceTextColor() }]}>
            {getPaceLabel()}
          </Text>
        </View>
      </View>

      <View style={styles.weightRow}>
        <Text style={styles.weightText}>
          {latestWeight ? `${latestWeight.toFixed(1)} kg` : "—"}
        </Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.weightText}>
          {goal.targetWeightKg?.toFixed(1) ?? "—"} kg
        </Text>
      </View>

      {weightDelta && (
        <>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLabel}>
              {weightDelta.lost >= 0 ? "Lost" : "Gained"}
            </Text>
            <Text style={styles.deltaValue}>
              {Math.abs(weightDelta.lost).toFixed(1)} kg
            </Text>
          </View>

          <View style={styles.deltaRow}>
            <Text style={styles.deltaLabel}>Remaining</Text>
            <Text style={styles.deltaValue}>
              {weightDelta.remaining > 0
                ? `${weightDelta.remaining.toFixed(1)} kg`
                : "Goal reached!"}
            </Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(weightDelta.percentComplete, 100)}%` },
                ]}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
};
