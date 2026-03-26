import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { SharedFoodPortion } from "@models/types";
import { useTheme } from "@hooks/useTheme";

interface PortionCardProps {
  portion: SharedFoodPortion;
  isDefault: boolean;
}

const formatMacro = (label: string, value: number | null): string | null => {
  if (value === null) return null;
  return `${label}: ${Math.round(value)}g`;
};

const PortionCard = ({ portion, isDefault }: PortionCardProps) => {
  const { colors } = useTheme();

  const macros = [
    formatMacro("P", portion.protein),
    formatMacro("C", portion.carbs),
    formatMacro("F", portion.fat),
  ].filter(Boolean);

  const styles = StyleSheet.create({
    container: {
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDefault ? colors.primary : colors.border,
      backgroundColor: isDefault ? colors.primaryBg : colors.cardBackground,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    label: {
      fontSize: 15,
      fontWeight: isDefault ? "700" : "600",
      color: colors.text,
    },
    defaultBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    defaultBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.buttonText,
    },
    caloriesRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginBottom: 2,
    },
    calories: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    baseInfo: {
      fontSize: 13,
      color: colors.textSecondary,
      marginLeft: 4,
    },
    macros: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container} testID={`portion-card-${portion.id}`}>
      <View style={styles.header}>
        <Text style={styles.label}>{portion.label}</Text>
        {isDefault ? (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.caloriesRow}>
        <Text style={styles.calories}>{Math.round(portion.calories)} kcal</Text>
        <Text style={styles.baseInfo}>
          / {portion.baseAmount}
          {portion.baseUnit}
        </Text>
      </View>
      {macros.length > 0 ? (
        <Text style={styles.macros}>{macros.join(" | ")}</Text>
      ) : null}
    </View>
  );
};

export default PortionCard;
