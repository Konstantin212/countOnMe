import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SharedFoodListItem as SharedFoodListItemType } from "@models/types";
import { useTheme } from "@hooks/useTheme";

interface SharedFoodListItemProps {
  item: SharedFoodListItemType;
  onPress: () => void;
  rightElement?: React.ReactNode;
}

const SharedFoodListItem = ({
  item,
  onPress,
  rightElement,
}: SharedFoodListItemProps) => {
  const { colors } = useTheme();

  const portionLabel = item.defaultPortion
    ? `${Math.round(item.defaultPortion.calories)} kcal / ${item.defaultPortion.baseAmount}${item.defaultPortion.baseUnit}`
    : null;

  const styles = StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    pressed: {
      opacity: 0.6,
    },
    info: {
      flex: 1,
      marginRight: 12,
    },
    displayName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 2,
    },
    brand: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    calories: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    categoryBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.tertiaryBg,
    },
    categoryText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });

  return (
    <Pressable
      accessibilityRole="button"
      testID={`shared-food-item-${item.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.info}>
        <Text style={styles.displayName} numberOfLines={1}>
          {item.displayName}
        </Text>
        {item.brand ? (
          <Text style={styles.brand} numberOfLines={1}>
            {item.brand}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {portionLabel ? (
            <Text style={styles.calories}>{portionLabel}</Text>
          ) : null}
          {item.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {rightElement ?? null}
    </Pressable>
  );
};

export default SharedFoodListItem;
