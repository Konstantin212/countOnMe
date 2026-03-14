import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "@hooks/useTheme";
import type { BodyWeightEntry } from "@models/types";

type WeightChartProps = {
  weights: BodyWeightEntry[];
  targetWeight?: number;
  healthyMin?: number;
  healthyMax?: number;
};

export const WeightChart = ({
  weights,
  targetWeight,
  healthyMin,
  healthyMax,
}: WeightChartProps) => {
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
  if (weights.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Weight Trend</Text>
        <Text style={styles.emptyText}>
          Log your first weight to see your trend
        </Text>
      </View>
    );
  }

  // Sort weights by day
  const sortedWeights = [...weights].sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
  );

  // Format data for LineChart
  const data = sortedWeights.map((w) => ({
    value: w.weightKg,
    label: w.day.slice(5), // "MM-DD"
  }));

  // Calculate chart dimensions
  const chartWidth = screenWidth - 64; // Account for card padding and margins
  const chartHeight = 200;

  // Calculate Y-axis range
  const minWeight = Math.min(...sortedWeights.map((w) => w.weightKg));
  const maxWeight = Math.max(...sortedWeights.map((w) => w.weightKg));
  const yAxisMin = Math.floor(minWeight - 2);
  const yAxisMax = Math.ceil(maxWeight + 2);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Weight Trend</Text>

      <View style={styles.chartContainer}>
        <LineChart
          data={data}
          width={chartWidth}
          height={chartHeight}
          color={colors.chartLine}
          thickness={2}
          hideDataPoints={false}
          dataPointsColor={colors.chartLine}
          dataPointsRadius={4}
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
          noOfSections={4}
          yAxisOffset={yAxisMin}
          maxValue={yAxisMax - yAxisMin}
          adjustToWidth
          hideRules={false}
          rulesColor={colors.borderLight}
          rulesType="solid"
          // Target weight reference line
          showReferenceLine1={!!targetWeight}
          referenceLine1Position={targetWeight ? targetWeight - yAxisMin : 0}
          referenceLine1Config={{
            color: colors.chartTarget,
            dashWidth: 4,
            dashGap: 3,
            labelText: targetWeight
              ? `Target: ${targetWeight.toFixed(1)} kg`
              : "",
            labelTextStyle: { color: colors.chartTarget, fontSize: 10 },
          }}
          // Healthy range bands (if provided)
          showReferenceLine2={!!healthyMin}
          referenceLine2Position={healthyMin ? healthyMin - yAxisMin : 0}
          referenceLine2Config={{
            color: colors.chartBand,
            dashWidth: 2,
            dashGap: 4,
            labelText: healthyMin ? `Min: ${healthyMin.toFixed(1)} kg` : "",
            labelTextStyle: { color: colors.chartBand, fontSize: 10 },
          }}
          showReferenceLine3={!!healthyMax}
          referenceLine3Position={healthyMax ? healthyMax - yAxisMin : 0}
          referenceLine3Config={{
            color: colors.chartBand,
            dashWidth: 2,
            dashGap: 4,
            labelText: healthyMax ? `Max: ${healthyMax.toFixed(1)} kg` : "",
            labelTextStyle: { color: colors.chartBand, fontSize: 10 },
          }}
        />
      </View>
    </View>
  );
};
