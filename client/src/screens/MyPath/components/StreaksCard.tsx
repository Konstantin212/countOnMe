import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@hooks/useTheme";
import type { StreakInfo } from "@models/types";

type StreaksCardProps = {
  streak: StreakInfo;
};

export const StreaksCard = ({ streak }: StreaksCardProps) => {
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
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 16,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
    },
    statItem: {
      alignItems: "center",
      gap: 4,
    },
    statValue: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.primary,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
    },
  });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Consistency</Text>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak.currentStreak}</Text>
          <Text style={styles.statLabel}>Current{"\n"}Streak</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak.longestStreak}</Text>
          <Text style={styles.statLabel}>Longest{"\n"}Streak</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak.totalTrackedDays}</Text>
          <Text style={styles.statLabel}>Total{"\n"}Tracked</Text>
        </View>
      </View>
    </View>
  );
};
