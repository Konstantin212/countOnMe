import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useTheme } from "@hooks/useTheme";
import type { DailyStatsPoint } from "@models/types";

type CalorieTrendBarsProps = {
  dailyStats: DailyStatsPoint[];
  calorieGoal: number;
};

export const CalorieTrendBars = ({
  dailyStats,
  calorieGoal,
}: CalorieTrendBarsProps) => {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

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
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 24,
    },
    chartContainer: {
      marginTop: 8,
    },
  });

  // Empty state
  if (dailyStats.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Calorie Trend</Text>
        <Text style={styles.emptyText}>
          Start tracking meals to see your calorie trend
        </Text>
      </View>
    );
  }

  // Format day labels (e.g., "02/10" or "Mon")
  const formatDayLabel = (day: string): string => {
    const date = new Date(day);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });
    return dayOfWeek;
  };

  // Format data for BarChart
  const data = dailyStats.map((s) => ({
    value: s.calories,
    label: formatDayLabel(s.day),
    frontColor: s.calories > calorieGoal ? colors.chartBarOver : colors.primary,
  }));

  // Calculate chart dimensions
  const chartWidth = screenWidth - 64; // Account for card padding and margins
  const chartHeight = 200;
  const barWidth = Math.max(20, (chartWidth - 40) / dailyStats.length - 8);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Calorie Trend</Text>

      <View style={styles.chartContainer}>
        <BarChart
          data={data}
          width={chartWidth}
          height={chartHeight}
          barWidth={barWidth}
          barBorderRadius={4}
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
          showReferenceLine1
          referenceLine1Position={calorieGoal}
          referenceLine1Config={{
            color: colors.chartTarget,
            dashWidth: 4,
            dashGap: 3,
            labelText: `Goal: ${Math.round(calorieGoal)}`,
            labelTextStyle: { color: colors.chartTarget, fontSize: 10 },
          }}
          noOfSections={4}
          hideRules={false}
          rulesColor={colors.borderLight}
          rulesType="solid"
          spacing={8}
        />
      </View>
    </View>
  );
};
