import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import type { SharedFood, SharedFoodPortion } from "@models/types";
import { DiscoverStackParamList } from "@app/navigationTypes";
import { useTheme } from "@hooks/useTheme";
import { Button } from "@particles";
import { getSharedFood, importSharedFood } from "@services/api/sharedFoods";
import PortionCard from "./components/PortionCard";

type Props = NativeStackScreenProps<DiscoverStackParamList, "SharedFoodDetail">;

const SharedFoodDetailScreen = ({ navigation, route }: Props) => {
  const { sharedFoodId } = route.params;
  const { colors } = useTheme();

  const [food, setFood] = useState<SharedFood | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchFood = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSharedFood(sharedFoodId);
      if (isMountedRef.current) {
        setFood(data);
      }
    } catch {
      if (isMountedRef.current) {
        setError("Failed to load food details");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [sharedFoodId]);

  useEffect(() => {
    fetchFood();
  }, [fetchFood]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importSharedFood(sharedFoodId);
      if (isMountedRef.current) {
        setImporting(false);
        Alert.alert(
          "Food Imported",
          `Successfully imported with ${result.portionCount} portion(s). You can find it in your products list.`,
          [
            { text: "Stay Here", style: "cancel" },
            {
              text: "Go to Products",
              onPress: () => {
                navigation.goBack();
              },
            },
          ],
        );
      }
    } catch {
      if (isMountedRef.current) {
        setImporting(false);
        Alert.alert(
          "Import Failed",
          "Could not import this food. Please try again.",
        );
      }
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    backButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.cardBackground,
    },
    headerTitle: {
      flex: 1,
      marginLeft: 12,
    },
    heading: {
      fontSize: 22,
      fontWeight: "600",
      color: colors.text,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textTertiary,
      width: 80,
    },
    infoValue: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    portionsList: {
      gap: 10,
      paddingBottom: 16,
    },
    importNote: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
      marginBottom: 8,
    },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
    },
    errorText: {
      fontSize: 16,
      color: colors.error,
      marginBottom: 12,
      textAlign: "center",
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 12,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading food details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !food) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error ?? "Food not found"}</Text>
          <Button onPress={fetchFood} testID="retry-detail-button">
            Retry
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const renderPortion = ({ item }: { item: SharedFoodPortion }) => (
    <PortionCard portion={item} isDefault={item.isDefault} />
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.heading} numberOfLines={1}>
            {food.displayName}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {food.description ? (
          <View style={styles.section}>
            <Text style={styles.description}>{food.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          {food.brand ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Brand</Text>
              <Text style={styles.infoValue}>{food.brand}</Text>
            </View>
          ) : null}
          {food.category ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{food.category}</Text>
            </View>
          ) : null}
          {food.barcode ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Barcode</Text>
              <Text style={styles.infoValue}>{food.barcode}</Text>
            </View>
          ) : null}
        </View>

        {food.portions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portions</Text>
            <FlatList
              data={food.portions}
              keyExtractor={(portion) => portion.id}
              renderItem={renderPortion}
              contentContainerStyle={styles.portionsList}
              scrollEnabled={false}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={styles.importNote}>
          This will copy this food and its portions to your private collection.
        </Text>
        <Button
          onPress={handleImport}
          disabled={importing}
          loading={importing}
          testID="import-food-button"
        >
          Import to My Foods
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default SharedFoodDetailScreen;
