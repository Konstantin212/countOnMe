import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@hooks/useTheme";
import { Button } from "@particles/Button";
import type { EtaProjection, UserGoal } from "@models/types";

type EtaTrajectoryWidgetProps = {
  eta: EtaProjection | null;
  goal: UserGoal | null;
  onSetupGoal?: () => void;
};

const formatTargetDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
};

export const EtaTrajectoryWidget = ({
  eta,
  goal,
  onSetupGoal,
}: EtaTrajectoryWidgetProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    card: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
      elevation: 3,
      gap: 10,
    },
    title: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    targetDate: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.text,
    },
    goalText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    progressSection: {
      gap: 6,
      marginTop: 4,
    },
    progressLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    progressPercent: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    progressRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressBarBg: {
      height: 4,
      backgroundColor: colors.borderLight,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 8,
    },
  });

  // No goal set
  if (!goal) {
    return (
      <View style={styles.card} testID="eta-trajectory-widget">
        <Text style={styles.title}>ETA Trajectory</Text>
        <Text style={styles.emptyText}>Set a goal to see your ETA</Text>
        {onSetupGoal && (
          <Button
            variant="primary"
            onPress={onSetupGoal}
            fullWidth
            testID="eta-setup-goal-button"
          >
            Set a Goal
          </Button>
        )}
      </View>
    );
  }

  // Goal but no projection data
  if (!eta) {
    return (
      <View style={styles.card} testID="eta-trajectory-widget">
        <Text style={styles.title}>ETA Trajectory</Text>
        <Text style={styles.emptyText}>Need more weight data</Text>
      </View>
    );
  }

  const progressPercent = Math.min(Math.round(eta.progressPercent), 100);
  const targetWeightText = goal.targetWeightKg
    ? `Hitting ${goal.targetWeightKg.toFixed(0)}kg goal`
    : "Reaching your goal";

  return (
    <View style={styles.card} testID="eta-trajectory-widget">
      <Text style={styles.title}>ETA Trajectory</Text>
      <Text style={styles.targetDate}>
        {eta.targetDate ? formatTargetDate(eta.targetDate) : "--"}
      </Text>
      <Text style={styles.goalText}>{targetWeightText}</Text>

      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
          />
        </View>
      </View>
    </View>
  );
};
