import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { MyDayStackParamList } from "@app/navigationTypes";
import { useMealTypeEntries } from "@hooks/useMealTypeEntries";
import { useTheme } from "@hooks/useTheme";
import { EnrichedFoodEntry, Unit } from "@models/types";
import { MEAL_TYPE_LABEL } from "@services/constants/mealTypes";
import { EntryListItem } from "./components/EntryListItem";
import { EditEntryModal } from "./components/EditEntryModal";

type Props = NativeStackScreenProps<MyDayStackParamList, "MealTypeEntries">;

const MealTypeEntriesScreen = ({ navigation, route }: Props) => {
  const { mealType } = route.params;
  const { colors } = useTheme();
  const { entries, loading, error, updateEntry, deleteEntry, refresh } =
    useMealTypeEntries(mealType);

  const [editingEntry, setEditingEntry] = useState<EnrichedFoodEntry | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const mealTypeLabel = MEAL_TYPE_LABEL[mealType];

  // Calculate totals
  const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
  const totalProtein = entries.reduce((sum, e) => sum + e.protein, 0);
  const totalCarbs = entries.reduce((sum, e) => sum + e.carbs, 0);
  const totalFat = entries.reduce((sum, e) => sum + e.fat, 0);

  const handleEdit = useCallback((entry: EnrichedFoodEntry) => {
    setEditingEntry(entry);
  }, []);

  const handleDelete = useCallback(
    (entry: EnrichedFoodEntry) => {
      Alert.alert(
        "Delete Entry?",
        `Are you sure you want to delete "${entry.productName}" (${entry.amount}${entry.unit})?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              const success = await deleteEntry(entry.id);
              if (!success) {
                Alert.alert(
                  "Error",
                  "Failed to delete entry. Please try again.",
                );
              }
            },
          },
        ],
      );
    },
    [deleteEntry],
  );

  const handleSaveEdit = useCallback(
    async (amount: number, unit: Unit) => {
      if (!editingEntry) return;

      setSaving(true);
      const success = await updateEntry(editingEntry.id, amount, unit);
      setSaving(false);

      if (success) {
        setEditingEntry(null);
      } else {
        Alert.alert("Error", "Failed to update entry. Please try again.");
      }
    },
    [editingEntry, updateEntry],
  );

  const handleCloseModal = useCallback(() => {
    if (!saving) {
      setEditingEntry(null);
    }
  }, [saving]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.cardBackground,
    },
    topBarTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    summaryCard: {
      backgroundColor: colors.infoLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.info,
    },
    summaryTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.info,
      marginBottom: 8,
    },
    summaryCalories: {
      fontSize: 32,
      fontWeight: "700",
      color: colors.info,
      marginBottom: 8,
    },
    summaryMacros: {
      fontSize: 14,
      color: colors.info,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12,
    },
    listContent: {
      paddingBottom: 24,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    errorText: {
      fontSize: 16,
      color: colors.error,
      textAlign: "center",
      marginBottom: 16,
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: "600",
    },
  });

  const renderItem = useCallback(
    ({ item }: { item: EnrichedFoodEntry }) => (
      <EntryListItem
        entry={item}
        onEdit={() => handleEdit(item)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [handleEdit, handleDelete],
  );

  const keyExtractor = useCallback((item: EnrichedFoodEntry) => item.id, []);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="restaurant-outline"
        size={64}
        color={colors.textSecondary}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>
        No {mealTypeLabel.toLowerCase()} entries yet
      </Text>
      <Text style={styles.emptySubtitle}>
        Add food to your {mealTypeLabel.toLowerCase()} from the My Day screen
      </Text>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error && entries.length === 0) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    if (entries.length === 0) {
      return renderEmpty();
    }

    return (
      <>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Total for {mealTypeLabel}</Text>
          <Text style={styles.summaryCalories}>{totalCalories} kcal</Text>
          <Text style={styles.summaryMacros}>
            Protein: {totalProtein.toFixed(1)}g • Carbs: {totalCarbs.toFixed(1)}
            g • Fat: {totalFat.toFixed(1)}g
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          {entries.length} {entries.length === 1 ? "item" : "items"}
        </Text>

        <FlatList
          data={entries}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>{mealTypeLabel}</Text>
      </View>

      <View style={styles.content}>{renderContent()}</View>

      <EditEntryModal
        visible={!!editingEntry}
        entry={editingEntry}
        onSave={handleSaveEdit}
        onClose={handleCloseModal}
        saving={saving}
      />
    </SafeAreaView>
  );
};

export default MealTypeEntriesScreen;
