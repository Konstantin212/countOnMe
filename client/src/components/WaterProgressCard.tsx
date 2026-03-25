import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@hooks/useTheme";

interface WaterProgressCardProps {
  currentMl: number;
  goalMl: number;
  onPress: () => void;
}

export const WaterProgressCard = ({
  currentMl,
  goalMl,
  onPress,
}: WaterProgressCardProps) => {
  const { colors } = useTheme();
  const progress = goalMl > 0 ? Math.min(currentMl / goalMl, 1) : 0;
  const percentage = Math.round(progress * 100);

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    content: {
      flex: 1,
      gap: 6,
    },
    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    percentage: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.waterFill,
    },
    mlText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });

  return (
    <Pressable
      testID="water-progress-card"
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.row}>
        <Ionicons name="water" size={28} color={colors.waterFill} />
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Water</Text>
            <Text style={styles.percentage}>{percentage}%</Text>
          </View>
          <ProgressBar
            testID="water-progress-bar"
            progress={progress}
            color={colors.waterFill}
            style={{ height: 8, borderRadius: 6 }}
            theme={{ colors: { elevation: { level2: colors.waterFillBg } } }}
          />
          <Text style={styles.mlText}>
            {currentMl} / {goalMl} ml
          </Text>
        </View>
      </View>
    </Pressable>
  );
};
