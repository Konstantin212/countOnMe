import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { MealsStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';
import { useMeals } from '../hooks/useMeals';
import { Meal } from '../models/types';

type Props = NativeStackScreenProps<MealsStackParamList, 'MealsList'>;

const MealsListScreen = ({ navigation }: Props) => {
  const { products } = useProducts();
  const { meals, loading } = useMeals(products);

  // Sort meals newest first
  const sortedMeals = React.useMemo(() => {
    return [...meals].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [meals]);

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month} ${hours}:${minutes}`;
  };

  const renderMealItem = ({ item }: { item: Meal }) => (
    <Pressable
      style={({ pressed }) => [styles.mealItem, pressed && styles.mealItemPressed]}
      onPress={() => navigation.navigate('MealDetails', { mealId: item.id })}
    >
      <View style={styles.mealInfo}>
        <Text style={styles.mealName}>{item.name}</Text>
        <Text style={styles.mealDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.mealCalories}>{Math.round(item.totalCalories)} kcal</Text>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No meals yet</Text>
      <Text style={styles.emptySubtext}>Tap "New Meal" to create your first meal</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.loadingText}>Loading meals...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Meals</Text>
        <Pressable style={styles.newButton} onPress={() => navigation.navigate('MealBuilder')}>
          <Text style={styles.newButtonText}>+ New Meal</Text>
        </Pressable>
      </View>

      <FlatList
        data={sortedMeals}
        keyExtractor={(meal) => meal.id}
        renderItem={renderMealItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
};

export default MealsListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
  },
  newButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  mealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
  },
  mealItemPressed: {
    opacity: 0.6,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  mealDate: {
    fontSize: 14,
    color: '#666',
  },
  mealCalories: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
});
