import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@hooks/useTheme";
import type { ConsistencyResult, ConsistencyDay } from "@models/types";

type ConsistencyWidgetProps = {
  consistency: ConsistencyResult | null;
};

const getCellColor = (
  day: ConsistencyDay,
  heatmapColors: {
    hit: string;
    partial: string;
    miss: string;
    empty: string;
  },
): string => {
  const { proteinHit, calorieHit } = day;
  if (proteinHit && calorieHit) return heatmapColors.hit;
  if (proteinHit || calorieHit) return heatmapColors.partial;
  return heatmapColors.miss;
};

const getCellOpacity = (day: ConsistencyDay): number => {
  if (day.proteinHit && day.calorieHit) return 1;
  if (day.proteinHit || day.calorieHit) return 0.8;
  return 0.5;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

export const ConsistencyWidget = ({ consistency }: ConsistencyWidgetProps) => {
  const { colors } = useTheme();

  const heatmapColors = {
    hit: colors.heatmapHit,
    partial: colors.heatmapPartial,
    miss: colors.heatmapMiss,
    empty: colors.heatmapEmpty,
  };

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
    title: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    legend: {
      flexDirection: "row",
      gap: 16,
      alignItems: "center",
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    weekContainer: {
      gap: 8,
    },
    weekRow: {
      gap: 4,
    },
    weekLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      marginBottom: 2,
    },
    gridRow: {
      flexDirection: "row",
      gap: 4,
    },
    cell: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 4,
      maxWidth: 36,
      maxHeight: 36,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    statItem: {
      gap: 2,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    statValue: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 12,
    },
  });

  if (!consistency) {
    return (
      <View style={styles.card} testID="consistency-widget">
        <Text style={styles.title}>Comparative Consistency</Text>
        <Text style={styles.emptyText}>
          Track meals to see consistency patterns
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="consistency-widget">
      <Text style={styles.title}>Comparative Consistency</Text>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.secondary }]}
          />
          <Text style={styles.legendText}>Protein</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.warning }]}
          />
          <Text style={styles.legendText}>Energy</Text>
        </View>
      </View>

      <View style={styles.weekContainer}>
        {consistency.weeks.map((week, weekIndex) => (
          <View key={week.weekStart} style={styles.weekRow}>
            <Text style={styles.weekLabel}>Week {weekIndex + 1}</Text>
            <View style={styles.gridRow}>
              {week.days.map((day) => (
                <View
                  key={day.day}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: getCellColor(day, heatmapColors),
                      opacity: getCellOpacity(day),
                    },
                  ]}
                  testID={`consistency-cell-${day.day}`}
                />
              ))}
              {/* Fill remaining cells if week has fewer than 7 days */}
              {Array.from({ length: Math.max(0, 7 - week.days.length) }).map(
                (_, i) => (
                  <View
                    key={`empty-${weekIndex}-${i}`}
                    style={[
                      styles.cell,
                      { backgroundColor: heatmapColors.empty },
                    ]}
                  />
                ),
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Avg Intake (7D)</Text>
          <Text style={styles.statValue}>
            {formatNumber(consistency.avgIntake7d)} kcal
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Compliance Score</Text>
          <Text style={styles.statValue}>{consistency.score.toFixed(1)}%</Text>
        </View>
      </View>
    </View>
  );
};
