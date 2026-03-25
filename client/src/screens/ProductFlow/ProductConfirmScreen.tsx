import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Select } from "@particles/index";

import { MyDayStackParamList } from "@app/navigationTypes";
import { useProducts } from "@hooks/useProducts";
import { useFoodEntries } from "@hooks/useFoodEntries";
import { useTheme } from "@hooks/useTheme";
import { CatalogPortionData } from "@hooks/useBarcodeLookup";
import { MealTypeKey, Unit } from "@models/types";
import { Scale, SCALE_OPTIONS, toGrams } from "@services/utils/scales";
import {
  calculateNutrition,
  classifyPortionMode,
} from "@services/utils/nutrition";
import {
  FOOD_MEAL_TYPE_KEYS,
  MEAL_TYPE_LABEL,
} from "@services/constants/mealTypes";
import { logEvent } from "@services/analytics";
import {
  loadProductFavourites,
  saveProductFavourites,
  pushProductRecent,
} from "@storage/storage";
import { makeConfirmStyles } from "./components/confirmStyles";

type Props = NativeStackScreenProps<MyDayStackParamList, "ProductConfirm">;

const findDefaultPortionId = (portions: CatalogPortionData[]): string => {
  const defaultPortion = portions.find((p) => p.isDefault);
  return defaultPortion?.id ?? portions[0]?.id ?? "";
};

const findDefaultWeightUnit = (
  portions: CatalogPortionData[],
  portionId: string,
): Scale => {
  const portion = portions.find((p) => p.id === portionId);
  if (
    portion?.baseUnit === "g" ||
    portion?.baseUnit === "mg" ||
    portion?.baseUnit === "kg"
  ) {
    return portion.baseUnit;
  }
  return "g";
};

// ---------------------------------------------------------------------------
// Catalog Track Food UI
// ---------------------------------------------------------------------------

interface CatalogTrackProps {
  externalProduct: Props["route"]["params"]["externalProduct"];
  catalogPortions: CatalogPortionData[];
  navigation: Props["navigation"];
}

const CatalogTrackScreen = ({
  externalProduct,
  catalogPortions,
  navigation,
}: CatalogTrackProps) => {
  const { colors } = useTheme();
  const { products, addProduct } = useProducts();
  const { saveMealToBackend } = useFoodEntries();

  const [mealType, setMealType] = useState<MealTypeKey>("breakfast");
  const [selectedPortionId, setSelectedPortionId] = useState(
    findDefaultPortionId(catalogPortions),
  );
  const [quantity, setQuantity] = useState("1");
  const [weightAmount, setWeightAmount] = useState("100");
  const [weightUnit, setWeightUnit] = useState<Scale>(
    findDefaultWeightUnit(
      catalogPortions,
      findDefaultPortionId(catalogPortions),
    ),
  );
  const [isFavourite, setIsFavourite] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedPortion = useMemo(() => {
    const found =
      catalogPortions.find((p) => p.id === selectedPortionId) ??
      catalogPortions[0];
    if (!found) {
      throw new Error("CatalogTrackScreen requires at least one portion");
    }
    return found;
  }, [catalogPortions, selectedPortionId]);

  const portionMode = useMemo(
    () => classifyPortionMode(selectedPortion),
    [selectedPortion],
  );

  const nutrition = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const wt = parseFloat(weightAmount) || 0;
    return calculateNutrition(
      selectedPortion,
      portionMode,
      qty,
      wt,
      weightUnit,
    );
  }, [selectedPortion, portionMode, quantity, weightAmount, weightUnit]);

  const handlePortionSelect = (portionId: string) => {
    setSelectedPortionId(portionId);
    const portion = catalogPortions.find((p) => p.id === portionId);
    if (portion) {
      const mode = classifyPortionMode(portion);
      if (mode === "weight") {
        setWeightUnit(findDefaultWeightUnit(catalogPortions, portionId));
      }
    }
  };

  const handleTrackFood = async () => {
    const qty = parseFloat(quantity) || 0;
    const wt = parseFloat(weightAmount) || 0;

    if (portionMode === "serving" && qty <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a quantity greater than 0");
      return;
    }
    if (portionMode === "weight" && wt <= 0) {
      Alert.alert("Invalid Amount", "Please enter an amount greater than 0");
      return;
    }

    setSaving(true);
    try {
      const productName = externalProduct.brands
        ? `${externalProduct.name} (${externalProduct.brands})`
        : externalProduct.name;

      const newProduct = await addProduct({
        name: productName,
        barcode: externalProduct.code,
        caloriesPer100g: externalProduct.caloriesPer100g,
        proteinPer100g: externalProduct.proteinPer100g,
        carbsPer100g: externalProduct.carbsPer100g,
        fatPer100g: externalProduct.fatPer100g,
        source: "catalog",
      });

      // Always save in grams so backend stats calculation can convert units
      const entryAmount =
        portionMode === "serving"
          ? qty * (selectedPortion.gramWeight ?? selectedPortion.baseAmount)
          : toGrams(wt, weightUnit);

      const entryUnit: Unit = "g";

      await saveMealToBackend(
        mealType,
        [
          {
            productId: newProduct.id,
            amount: entryAmount,
            unit: entryUnit,
          },
        ],
        [newProduct],
      );

      if (isFavourite) {
        const favourites = await loadProductFavourites();
        await saveProductFavourites([
          newProduct.id,
          ...favourites.filter((id) => id !== newProduct.id),
        ]);
      }

      await pushProductRecent(newProduct.id);

      logEvent("food_tracked_via_barcode", {
        mealType,
        portionMode,
        catalogProductId: externalProduct.catalogProductId,
        isExisting: products.some((p) => p.id === newProduct.id),
      });

      navigation.replace("MyDay");
    } catch {
      Alert.alert("Error", "Failed to track food. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const styles = makeConfirmStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          testID="back-button"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Track Food</Text>
      </View>

      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Product Info Card */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.productName}>{externalProduct.name}</Text>
            {externalProduct.brands ? (
              <Text style={styles.productBrand}>{externalProduct.brands}</Text>
            ) : null}
          </View>
        </View>

        {/* Meal Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meal Type</Text>
          <Select
            testID="meal-type-select"
            value={mealType}
            onValueChange={setMealType}
            options={FOOD_MEAL_TYPE_KEYS.map((k) => ({
              value: k,
              label: MEAL_TYPE_LABEL[k],
            }))}
          />
        </View>

        {/* Portion Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portion</Text>
          <View style={styles.portionGrid}>
            {catalogPortions.map((portion) => {
              const isSelected = portion.id === selectedPortionId;
              return (
                <Pressable
                  key={portion.id}
                  style={[
                    styles.portionCard,
                    isSelected && {
                      borderColor: colors.primary,
                      backgroundColor: colors.primaryBg,
                    },
                  ]}
                  onPress={() => handlePortionSelect(portion.id)}
                  testID={`portion-card-${portion.id}`}
                >
                  <Text
                    style={[
                      styles.portionLabel,
                      isSelected && { color: colors.primary },
                    ]}
                  >
                    {portion.label}
                  </Text>
                  <Text style={styles.portionCalories}>
                    {Math.round(portion.calories)} kcal
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {portionMode === "serving" ? "How many?" : "Amount"}
          </Text>

          {portionMode === "serving" ? (
            <View style={styles.amountContainer}>
              <TextInput
                style={styles.amountInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={colors.textTertiary}
                testID="quantity-input"
              />
              {parseFloat(quantity) > 0 && (
                <Text style={styles.amountHint}>
                  {quantity} x {selectedPortion.label} ={" "}
                  {Math.round(
                    parseFloat(quantity) * selectedPortion.baseAmount,
                  )}
                  {selectedPortion.baseUnit}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.amountContainer}>
              <TextInput
                style={styles.amountInput}
                value={weightAmount}
                onChangeText={setWeightAmount}
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor={colors.textTertiary}
                testID="weight-amount-input"
              />
              <View style={styles.scaleButtons}>
                {SCALE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.scaleButton,
                      weightUnit === option.value && styles.scaleButtonActive,
                    ]}
                    onPress={() => setWeightUnit(option.value)}
                    testID={`scale-${option.value}`}
                  >
                    <Text
                      style={[
                        styles.scaleButtonText,
                        weightUnit === option.value &&
                          styles.scaleButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Nutritional Preview */}
        {nutrition.calories > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition</Text>
            <View style={styles.nutritionCard}>
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Calories</Text>
                <Text style={styles.nutrientValueLarge}>
                  {Math.round(nutrition.calories)} kcal
                </Text>
              </View>
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Protein</Text>
                <Text style={styles.nutrientValue}>
                  {nutrition.protein.toFixed(1)} g
                </Text>
              </View>
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Carbohydrates</Text>
                <Text style={styles.nutrientValue}>
                  {nutrition.carbs.toFixed(1)} g
                </Text>
              </View>
              <View style={[styles.nutrientRow, styles.nutrientRowLast]}>
                <Text style={styles.nutrientLabel}>Fat</Text>
                <Text style={styles.nutrientValue}>
                  {nutrition.fat.toFixed(1)} g
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Favourite Toggle */}
        <Pressable
          style={styles.favouriteRow}
          onPress={() => setIsFavourite((prev) => !prev)}
          testID="favourite-toggle"
        >
          <Ionicons
            name={isFavourite ? "star" : "star-outline"}
            size={22}
            color={isFavourite ? colors.warning : colors.textSecondary}
          />
          <Text style={styles.favouriteText}>Add to favourites</Text>
        </Pressable>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.trackButton, saving && styles.trackButtonDisabled]}
          onPress={() => void handleTrackFood()}
          disabled={saving}
          testID="track-food-button"
        >
          <Text style={styles.trackButtonText}>
            {saving ? "Saving..." : "Track Food"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Main Screen -- branches on catalogPortions
// ---------------------------------------------------------------------------

const synthesizePortionFromOff = (
  product: Props["route"]["params"]["externalProduct"],
): CatalogPortionData[] => [
  {
    id: "off-100g",
    label: "100g",
    baseAmount: 100,
    baseUnit: "g",
    gramWeight: 100,
    calories: product.caloriesPer100g,
    protein: product.proteinPer100g ?? null,
    carbs: product.carbsPer100g ?? null,
    fat: product.fatPer100g ?? null,
    isDefault: true,
  },
];

const ProductConfirmScreen = ({ navigation, route }: Props) => {
  const { externalProduct } = route.params;
  const catalogPortions =
    Array.isArray(externalProduct.catalogPortions) &&
    externalProduct.catalogPortions.length > 0
      ? externalProduct.catalogPortions
      : synthesizePortionFromOff(externalProduct);

  return (
    <CatalogTrackScreen
      externalProduct={externalProduct}
      catalogPortions={catalogPortions}
      navigation={navigation}
    />
  );
};

export default ProductConfirmScreen;
