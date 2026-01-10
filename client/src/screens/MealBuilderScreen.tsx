import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ProfileStackParamList } from '@app/navigationTypes';
import { useProducts } from '@hooks/useProducts';
import { useMeals } from '@hooks/useMeals';
import { useTheme } from '@hooks/useTheme';
import { MealItem } from '@models/types';
import { calcMealCalories } from '@services/utils/calories';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MealBuilder'>;

const MealBuilderScreen = ({ navigation, route }: Props) => {
  const isEditing = Boolean(route.params?.mealId);
  const { products, loading: productsLoading } = useProducts();
  const { meals, addMeal, updateMeal } = useMeals(products);
  const { colors } = useTheme();

  const [mealName, setMealName] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    backButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.cardBackground,
      marginRight: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    totalSection: {
      padding: 16,
      backgroundColor: colors.infoLight,
      borderBottomWidth: 1,
      borderBottomColor: colors.info,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.info,
    },
    totalValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.info,
    },
    productsContainer: {
      padding: 16,
    },
    productItem: {
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.cardBackground,
    },
    productCheckbox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 4,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '700',
    },
    productInfo: {
      flex: 1,
    },
    productName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    productMeta: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    gramsInput: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: 12,
      paddingLeft: 48,
    },
    gramsField: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 8,
      fontSize: 16,
      backgroundColor: colors.cardBackground,
      color: colors.text,
    },
    gramsUnit: {
      marginLeft: 8,
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    saveButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      backgroundColor: colors.disabled,
    },
    saveButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '600',
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginTop: 32,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
  });

  // Load meal data if editing
  useEffect(() => {
    if (isEditing && route.params?.mealId) {
      const meal = meals.find((m) => m.id === route.params?.mealId);
      if (meal) {
        setMealName(meal.name);
        const itemsMap = new Map<string, number>();
        meal.items.forEach((item) => {
          itemsMap.set(item.productId, item.grams);
        });
        setSelectedProducts(itemsMap);
      }
    }
  }, [isEditing, route.params?.mealId, meals]);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return products;
    }
    const query = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(query));
  }, [products, searchQuery]);

  // Calculate live total
  const totalCalories = useMemo(() => {
    const items: MealItem[] = Array.from(selectedProducts.entries()).map(([productId, grams]) => ({
      productId,
      grams,
    }));
    return calcMealCalories(items, products);
  }, [selectedProducts, products]);

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const next = new Map(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.set(productId, 100); // Default 100g
      }
      return next;
    });
  };

  const handleGramsChange = (productId: string, value: string) => {
    const grams = parseFloat(value);
    setSelectedProducts((prev) => {
      const next = new Map(prev);
      if (!Number.isNaN(grams) && grams > 0) {
        next.set(productId, grams);
      } else if (value === '' || value === '0') {
        // Allow empty or 0 for editing, but treat as 0
        next.set(productId, 0);
      }
      return next;
    });
  };

  const handleSave = async () => {
    // Validation
    if (!mealName.trim()) {
      Alert.alert('Error', 'Please enter a meal name');
      return;
    }

    const items: MealItem[] = Array.from(selectedProducts.entries())
      .filter(([_, grams]) => grams > 0)
      .map(([productId, grams]) => ({
        productId,
        grams,
      }));

    if (items.length === 0) {
      Alert.alert('Error', 'Please select at least one product with grams > 0');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && route.params?.mealId) {
        await updateMeal(route.params.mealId, {
          name: mealName,
          items,
        });
      } else {
        const newMeal = await addMeal({
          name: mealName,
          items,
        });
        // Navigate to details after creating
        navigation.replace('MealDetails', { mealId: newMeal.id });
        return;
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save meal. Please try again.');
      console.error('Save meal error:', error);
    } finally {
      setSaving(false);
    }
  };

  if (productsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.loadingText}>Loading products...</Text>
      </SafeAreaView>
    );
  }

  if (products.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.emptyText}>No products available.</Text>
        <Text style={styles.emptySubtext}>Please add products first in the Products tab.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{isEditing ? 'Edit Meal' : 'New Meal'}</Text>
      </View>

      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Meal Name Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Meal Name</Text>
          <TextInput
            style={styles.input}
            value={mealName}
            onChangeText={setMealName}
            placeholder="e.g., Breakfast, Lunch..."
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Total Calories Display */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total Calories</Text>
          <Text style={styles.totalValue}>{Math.round(totalCalories)} kcal</Text>
        </View>

        {/* Search Products */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Products</Text>
          <TextInput
            style={styles.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Products List */}
        <View style={styles.productsContainer}>
          {filteredProducts.map((product) => {
            const isSelected = selectedProducts.has(product.id);
            const grams = selectedProducts.get(product.id) || 100;

            return (
              <View key={product.id} style={styles.productItem}>
                <Pressable
                  style={styles.productCheckbox}
                  onPress={() => handleToggleProduct(product.id)}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productMeta}>{product.caloriesPer100g} kcal / 100g</Text>
                  </View>
                </Pressable>

                {isSelected && (
                  <View style={styles.gramsInput}>
                    <TextInput
                      style={styles.gramsField}
                      value={String(grams)}
                      onChangeText={(value) => handleGramsChange(product.id, value)}
                      keyboardType="numeric"
                      placeholder="100"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={styles.gramsUnit}>g</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Meal'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default MealBuilderScreen;
