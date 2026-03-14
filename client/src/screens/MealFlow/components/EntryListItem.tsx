import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@hooks/useTheme";
import { EnrichedFoodEntry } from "@models/types";

interface EntryListItemProps {
  entry: EnrichedFoodEntry;
  onEdit: () => void;
  onDelete: () => void;
}

export const EntryListItem = ({
  entry,
  onEdit,
  onDelete,
}: EntryListItemProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    content: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    details: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    macros: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: "row",
      gap: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.cardBackgroundLight,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.name}>{entry.productName}</Text>
        <Text style={styles.details}>
          {entry.amount} {entry.unit} • {entry.calories} kcal
        </Text>
        <Text style={styles.macros}>
          P: {entry.protein}g C: {entry.carbs}g F: {entry.fat}g
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={onEdit}
          accessibilityLabel="Edit entry"
        >
          <Ionicons name="pencil" size={20} color={colors.primary} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={onDelete}
          accessibilityLabel="Delete entry"
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>
    </View>
  );
};
