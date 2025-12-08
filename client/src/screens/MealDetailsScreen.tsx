import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { MealsStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';
import { useMeals } from '../hooks/useMeals';
import MealItemRow from '../components/MealItemRow';

type Props = NativeStackScreenProps<MealsStackParamList, 'MealDetails'>;

const MealDetailsScreen = ({ navigation, route }: Props) => {
  const { products } = useProducts();
  const { meals } = useMeals(products);

  const meal = useMemo(() => {
    return meals.find((m) => m.id === route.params.mealId);
  }, [meals, route.params.mealId]);

  const mealItemsWithDetails = useMemo(() => {
    if (!meal) return [];

    return meal.items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return null;

        const itemCalories = (product.caloriesPer100g * item.grams) / 100;

        return {
          productId: item.productId,
          name: product.name,
          grams: item.grams,
          calories: Math.round(itemCalories),
        };
      })
      .filter((item) => item !== null);
  }, [meal, products]);

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} at ${hours}:${minutes}`;
  };

  if (!meal) {
    return (
      <View style={styles.container}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Meal not found</Text>
          <Text style={styles.notFoundSubtext}>This meal may have been deleted.</Text>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Meal Header */}
        <View style={styles.header}>
          <Text style={styles.mealName}>{meal.name}</Text>
          <Text style={styles.mealDate}>{formatDate(meal.createdAt)}</Text>
        </View>

        {/* Total Calories Card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Calories</Text>
          <Text style={styles.totalValue}>{Math.round(meal.totalCalories)} kcal</Text>
        </View>

        {/* Items List */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {mealItemsWithDetails.length > 0 ? (
            mealItemsWithDetails.map((item, index) => (
              <MealItemRow
                key={item.productId}
                name={item.name}
                grams={item.grams}
                calories={item.calories}
              />
            ))
          ) : (
            <Text style={styles.noItemsText}>No ingredients found</Text>
          )}
        </View>
      </ScrollView>

      {/* Edit Button */}
      <View style={styles.footer}>
        <Pressable
          style={styles.editButton}
          onPress={() => navigation.navigate('MealBuilder', { mealId: meal.id })}
        >
          <Text style={styles.editButtonText}>Edit Meal</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default MealDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mealName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  mealDate: {
    fontSize: 14,
    color: '#666',
  },
  totalCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1e40af',
  },
  itemsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  noItemsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 24,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  editButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  notFoundText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  notFoundSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

