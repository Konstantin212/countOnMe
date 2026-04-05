import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@hooks/useTheme";

type HydrationWidgetProps = {
  todayTotal: number;
  waterGoal: number;
};

const formatLiters = (ml: number): string => {
  const liters = ml / 1000;
  return `${liters.toFixed(1)}L`;
};

export const HydrationWidget = ({
  todayTotal,
  waterGoal,
}: HydrationWidgetProps) => {
  const { colors } = useTheme();
  const progress = waterGoal > 0 ? Math.min(todayTotal / waterGoal, 1) : 0;

  const styles = StyleSheet.create({
    card: {
      flex: 1,
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
      alignItems: "center",
      gap: 6,
    },
    icon: {
      marginBottom: 4,
    },
    value: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.text,
    },
    label: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    progressBarBg: {
      width: "100%",
      height: 4,
      backgroundColor: colors.borderLight,
      borderRadius: 2,
      overflow: "hidden",
      marginTop: 4,
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: colors.waterFill,
      borderRadius: 2,
    },
  });

  return (
    <View style={styles.card} testID="hydration-widget">
      <Ionicons
        name="water"
        size={24}
        color={colors.waterFill}
        style={styles.icon}
      />
      <Text style={styles.value}>{formatLiters(todayTotal)}</Text>
      <Text style={styles.label}>Hydration</Text>
      <View style={styles.progressBarBg}>
        <View
          style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
        />
      </View>
    </View>
  );
};
