import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@hooks/useTheme";

export const ActiveCalWidget = () => {
  const { colors } = useTheme();

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
      opacity: 0.5,
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
  });

  return (
    <View style={styles.card} testID="active-cal-widget">
      <Ionicons
        name="flame"
        size={24}
        color={colors.warning}
        style={styles.icon}
      />
      <Text style={styles.value}>420</Text>
      <Text style={styles.label}>Active Cal</Text>
    </View>
  );
};
