import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import type { Product, Unit } from "@models/types";
import { DiscoverStackParamList } from "@app/navigationTypes";
import { useProducts } from "@hooks/useProducts";
import { useTheme } from "@hooks/useTheme";
import { Button, Input } from "@particles";
import {
  addSharedFoodPortion,
  createSharedFood,
  publishSharedFood,
} from "@services/api/sharedFoods";

type Props = NativeStackScreenProps<DiscoverStackParamList, "PublishFood">;

/**
 * Build a default portion from the product data.
 * Uses v2 data (caloriesPerBase/portionSize/scaleUnit) when available,
 * falls back to legacy 100g data.
 */
const buildDefaultPortion = (
  product: Product,
): {
  label: string;
  baseAmount: number;
  baseUnit: Unit;
  calories: number;
  protein: number | undefined;
  carbs: number | undefined;
  fat: number | undefined;
} => {
  const hasV2 =
    product.caloriesPerBase !== undefined &&
    product.portionSize !== undefined &&
    product.scaleUnit !== undefined;

  if (hasV2) {
    return {
      label: `${product.portionSize}${product.scaleUnit}`,
      baseAmount: product.portionSize ?? 100,
      baseUnit: product.scaleUnit ?? "g",
      calories: product.caloriesPerBase ?? 0,
      protein: product.proteinPerBase,
      carbs: product.carbsPerBase,
      fat: product.fatPerBase,
    };
  }

  return {
    label: "100g",
    baseAmount: 100,
    baseUnit: "g",
    calories: product.caloriesPer100g,
    protein: product.proteinPer100g,
    carbs: product.carbsPer100g,
    fat: product.fatPer100g,
  };
};

const PublishFoodScreen = ({ navigation, route }: Props) => {
  const { productId } = route.params;
  const { colors } = useTheme();
  const { products, loading: productsLoading } = useProducts();

  const product = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [publishing, setPublishing] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Pre-fill form when product loads
  useEffect(() => {
    if (product) {
      setDisplayName(product.name);
      setCategory(product.category ?? "");
    }
  }, [product]);

  const handlePublish = useCallback(async () => {
    if (!product) return;
    if (!displayName.trim()) {
      Alert.alert("Validation Error", "Display name is required.");
      return;
    }

    setPublishing(true);

    try {
      // 1. Create shared food
      const sharedFood = await createSharedFood({
        name: product.name.toLowerCase().replace(/\s+/g, "_"),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
      });

      // 2. Add default portion from product data
      const portion = buildDefaultPortion(product);
      await addSharedFoodPortion(sharedFood.id, {
        label: portion.label,
        baseAmount: portion.baseAmount,
        baseUnit: portion.baseUnit,
        calories: portion.calories,
        protein: portion.protein,
        carbs: portion.carbs,
        fat: portion.fat,
        isDefault: true,
      });

      // 3. Publish (submit for review)
      await publishSharedFood(sharedFood.id);

      if (isMountedRef.current) {
        setPublishing(false);
        Alert.alert(
          "Food Shared",
          "Your food has been submitted for review. It will become visible to others once approved.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ],
        );
      }
    } catch {
      if (isMountedRef.current) {
        setPublishing(false);
        Alert.alert(
          "Publish Failed",
          "Could not share this food. Please try again.",
        );
      }
    }
  }, [product, displayName, description, brand, category, navigation]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 24,
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
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    infoCard: {
      padding: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
      marginBottom: 20,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    infoSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    formSection: {
      marginBottom: 16,
    },
    noteText: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
      marginTop: 12,
      marginBottom: 8,
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
      textAlign: "center",
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
    },
  });

  if (productsLoading) {
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
            <Text style={styles.heading}>Share Food</Text>
          </View>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading product...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
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
            <Text style={styles.heading}>Share Food</Text>
          </View>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Product not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const portion = buildDefaultPortion(product);

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
          <Text style={styles.heading}>Share Food</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Sharing: {product.name}</Text>
          <Text style={styles.infoSubtitle}>
            {Math.round(portion.calories)} kcal / {portion.baseAmount}
            {portion.baseUnit}
          </Text>
        </View>

        <View style={styles.formSection}>
          <Input
            label="Display Name"
            required
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How others will see this food"
            testID="publish-display-name"
          />
        </View>

        <View style={styles.formSection}>
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            testID="publish-description"
            multiline
          />
        </View>

        <View style={styles.formSection}>
          <Input
            label="Brand"
            value={brand}
            onChangeText={setBrand}
            placeholder="Optional brand name"
            testID="publish-brand"
          />
        </View>

        <View style={styles.formSection}>
          <Input
            label="Category"
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Protein, Dairy, Grains"
            testID="publish-category"
          />
        </View>

        <Text style={styles.noteText}>
          Your food will be submitted for review before becoming visible to the
          community.
        </Text>

        <Button
          onPress={handlePublish}
          disabled={publishing || !displayName.trim()}
          loading={publishing}
          testID="publish-food-button"
        >
          Share with Community
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PublishFoodScreen;
