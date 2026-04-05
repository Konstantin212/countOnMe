import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@hooks/useTheme";
import type { EfficiencyResult } from "@models/types";

type EfficiencyWidgetProps = {
  efficiency: EfficiencyResult | null;
};

const formatDeviation = (percent: number, direction: string): string => {
  const sign = direction === "under" ? "-" : "+";
  if (direction === "on_target") return "0%";
  return `${sign}${Math.abs(percent).toFixed(0)}%`;
};

export const EfficiencyWidget = ({ efficiency }: EfficiencyWidgetProps) => {
  const { colors } = useTheme();

  const deviationColor =
    efficiency?.direction === "over"
      ? colors.efficiencyNegative
      : colors.efficiencyPositive;

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
      gap: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    title: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    deviationValue: {
      fontSize: 32,
      fontWeight: "800",
      color: deviationColor,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 8,
    },
  });

  if (!efficiency) {
    return (
      <View style={styles.card} testID="efficiency-widget">
        <View style={styles.header}>
          <Ionicons name="flash" size={18} color={colors.primary} />
          <Text style={styles.title}>Efficiency</Text>
        </View>
        <Text style={styles.emptyText}>
          Track meals for 2 weeks to see efficiency
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="efficiency-widget">
      <View style={styles.header}>
        <Ionicons name="flash" size={18} color={colors.primary} />
        <Text style={styles.title}>Efficiency</Text>
      </View>
      <Text style={styles.deviationValue}>
        {formatDeviation(efficiency.deviationPercent, efficiency.direction)}
      </Text>
      <Text style={styles.subtitle}>
        Metabolic rate deviation vs last week average.
      </Text>
    </View>
  );
};
