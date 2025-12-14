import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ProfileStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';
import { useMeals } from '../hooks/useMeals';
import { MealItem } from '../models/types';
import { calcMealCalories } from '../utils/calories';
import { useTheme } from '../hooks/useTheme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MealBuilder'>;

type SelectedProduct = {
  productId: string;
  grams: number;
};

const MealBuilderScreen = ({ navigation, route }: Props) => {
  const isEditing = Boolean(route.params?.mealId);
  const { products, loading: productsLoading } = useProducts();
  const { meals, addMeal, updateMeal } = useMeals(products);

  const [mealName, setMealName] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

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
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No products available.</Text>
        <Text style={styles.emptySubtext}>Please add products first in the Products tab.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Meal Name Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Meal Name</Text>
          <TextInput
            style={styles.input}
            value={mealName}
            onChangeText={setMealName}
            placeholder="e.g., Breakfast, Lunch..."
            placeholderTextColor="#999"
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
            placeholderTextColor="#999"
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
                      placeholderTextColor="#999"
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
    </View>
  );
};

export default MealBuilderScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  totalSection: {
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e40af',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e40af',
  },
  productsContainer: {
    padding: 16,
  },
  productItem: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    backgroundColor: '#fafafa',
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
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  productMeta: {
    fontSize: 14,
    color: '#666',
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
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  gramsUnit: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginTop: 32,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});
