import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ProfileStackParamList } from '@app/navigationTypes';
import { useProducts } from '@hooks/useProducts';
import { useMeals } from '@hooks/useMeals';
import { useTheme } from '@hooks/useTheme';
import MealItemRow from '@components/MealItemRow';
import { convertUnit } from '@services/utils/units';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MealDetails'>;

const MealDetailsScreen = ({ navigation, route }: Props) => {
  const { products } = useProducts();
  const { meals } = useMeals(products);
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 16,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 8,
      gap: 12,
    },
    topBarBackButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.cardBackground,
    },
    topBarTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mealName: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    mealDate: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    totalCard: {
      margin: 16,
      padding: 20,
      backgroundColor: colors.infoLight,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.info,
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.info,
      marginBottom: 8,
    },
    totalValue: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.info,
    },
    itemsSection: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    noItemsText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 24,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    editButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    editButtonText: {
      color: colors.buttonText,
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
      color: colors.text,
      marginBottom: 8,
    },
    notFoundSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    backButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    backButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const meal = useMemo(() => {
    return meals.find((m) => m.id === route.params.mealId);
  }, [meals, route.params.mealId]);

  const mealItemsWithDetails = useMemo(() => {
    if (!meal) return [];

    return meal.items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return null;

        const baseAmount = product.portionSize ?? 100;
        const baseUnit = (product.scaleUnit ?? 'g') as any;
        const calPerBase = product.caloriesPerBase ?? product.caloriesPer100g;
        const converted = convertUnit(item.amount, item.unit as any, baseUnit);
        const itemCalories =
          converted === null || baseAmount <= 0 || calPerBase <= 0 ? 0 : (calPerBase * converted) / baseAmount;

        return {
          productId: item.productId,
          name: product.name,
          amount: item.amount,
          unit: item.unit,
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
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.topBarBackButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>Meal</Text>
        </View>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Meal not found</Text>
          <Text style={styles.notFoundSubtext}>This meal may have been deleted.</Text>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.topBarBackButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>{meal.name}</Text>
      </View>

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
                amount={item.amount}
                unit={item.unit}
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
    </SafeAreaView>
  );
};

export default MealDetailsScreen;

