import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@hooks/useTheme";
import type { MacroAdherence, UserGoal } from "@models/types";

type MacroAdherenceCardProps = {
  adherence: MacroAdherence;
  goal: UserGoal;
};

export const MacroAdherenceCard = ({
  adherence,
  goal,
}: MacroAdherenceCardProps) => {
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
      gap: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 24,
    },
    macroRow: {
      gap: 8,
    },
    macroHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    macroLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    macroValue: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    barContainer: {
      height: 12,
      backgroundColor: colors.borderLight,
      borderRadius: 6,
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      borderRadius: 6,
    },
  });

  // If no goal set, show empty state
  if (!goal) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Macro Adherence</Text>
        <Text style={styles.emptyText}>Set a goal to track macros</Text>
      </View>
    );
  }

  const macros = [
    {
      label: "Protein",
      color: colors.macroProtein,
      adherence: adherence.protein,
      goal: goal.proteinGrams,
      consumed: Math.round(adherence.protein * goal.proteinGrams),
    },
    {
      label: "Carbs",
      color: colors.macroCarb,
      adherence: adherence.carbs,
      goal: goal.carbsGrams,
      consumed: Math.round(adherence.carbs * goal.carbsGrams),
    },
    {
      label: "Fat",
      color: colors.macroFat,
      adherence: adherence.fat,
      goal: goal.fatGrams,
      consumed: Math.round(adherence.fat * goal.fatGrams),
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Macro Adherence</Text>

      {macros.map((macro) => (
        <View key={macro.label} style={styles.macroRow}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroLabel}>{macro.label}</Text>
            <Text style={styles.macroValue}>
              {macro.consumed} / {macro.goal} g (
              {Math.round(macro.adherence * 100)}%)
            </Text>
          </View>
          <View style={styles.barContainer}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: macro.color,
                  width: `${Math.min(macro.adherence * 100, 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
};
