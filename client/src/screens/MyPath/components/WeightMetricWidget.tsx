import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@hooks/useTheme";
import type { BodyWeightEntry, StatsPeriod, WeightTrend } from "@models/types";

type WeightMetricWidgetProps = {
  weights: BodyWeightEntry[];
  trend: WeightTrend;
  period: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
};

const PERIOD_OPTIONS: Array<{ label: string; value: StatsPeriod }> = [
  { label: "1W", value: "7d" },
  { label: "1M", value: "30d" },
  { label: "3M", value: "90d" },
];

const getTrendIcon = (
  direction: WeightTrend["direction"],
): "arrow-down" | "arrow-up" | "remove" => {
  switch (direction) {
    case "down":
      return "arrow-down";
    case "up":
      return "arrow-up";
    case "stable":
      return "remove";
  }
};

export const WeightMetricWidget = ({
  weights,
  trend,
  period,
  onPeriodChange,
}: WeightMetricWidgetProps) => {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const trendColor =
    trend.direction === "down"
      ? colors.success
      : trend.direction === "up"
        ? colors.error
        : colors.textSecondary;

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
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    weightRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 12,
    },
    currentWeight: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.text,
    },
    trendBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    trendText: {
      fontSize: 13,
      fontWeight: "600",
    },
    periodRow: {
      flexDirection: "row",
      gap: 8,
    },
    periodTab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
    },
    periodTabText: {
      fontSize: 13,
      fontWeight: "600",
    },
    chartContainer: {
      marginTop: 4,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 24,
    },
  });

  const latestWeight =
    weights.length > 0
      ? [...weights].sort(
          (a, b) => new Date(b.day).getTime() - new Date(a.day).getTime(),
        )[0]?.weightKg
      : null;

  // Empty state
  if (weights.length === 0 || trend.dataPoints.length === 0) {
    return (
      <View style={styles.card} testID="weight-metric-widget">
        <Text style={styles.title}>Weight Metric Analysis</Text>
        <Text style={styles.emptyText}>
          Log your first weight to see trends
        </Text>
      </View>
    );
  }

  // Chart data from trend data points
  const chartData = trend.dataPoints.map((dp) => ({
    value: dp.weightKg,
    label: dp.day.slice(5),
  }));

  const chartWidth = screenWidth - 64;
  const chartHeight = 160;

  const allWeights = trend.dataPoints.map((dp) => dp.weightKg);
  const minWeight = Math.min(...allWeights);
  const maxWeight = Math.max(...allWeights);
  const yAxisMin = Math.floor(minWeight - 1);
  const yAxisMax = Math.ceil(maxWeight + 1);

  return (
    <View style={styles.card} testID="weight-metric-widget">
      <Text style={styles.title}>Weight Metric Analysis</Text>

      <View style={styles.headerRow}>
        <View style={styles.weightRow}>
          <Text style={styles.currentWeight}>
            {latestWeight?.toFixed(2) ?? "--"} kg
          </Text>
          <View
            style={[styles.trendBadge, { backgroundColor: `${trendColor}20` }]}
          >
            <Ionicons
              name={getTrendIcon(trend.direction)}
              size={14}
              color={trendColor}
            />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {Math.abs(trend.changePercent).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => {
          const isActive = opt.value === period;
          return (
            <Pressable
              key={opt.value}
              style={[
                styles.periodTab,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : colors.borderLight,
                },
              ]}
              onPress={() => onPeriodChange(opt.value)}
              testID={`period-tab-${opt.value}`}
            >
              <Text
                style={[
                  styles.periodTabText,
                  {
                    color: isActive ? colors.buttonText : colors.textSecondary,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={chartHeight}
          color={colors.chartLine}
          thickness={2}
          hideDataPoints={false}
          dataPointsColor={colors.chartLine}
          dataPointsRadius={3}
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
          noOfSections={4}
          yAxisOffset={yAxisMin}
          maxValue={yAxisMax - yAxisMin}
          adjustToWidth
          hideRules={false}
          rulesColor={colors.borderLight}
          rulesType="solid"
        />
      </View>
    </View>
  );
};
