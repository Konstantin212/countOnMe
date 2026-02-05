import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressChart } from 'react-native-chart-kit';
import { ActivityIndicator, FAB, Portal, ProgressBar } from 'react-native-paper';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useDayStats, getMealTypeTotals } from '@hooks/useDayStats';
import { useGoal } from '@hooks/useGoal';
import { useTheme } from '@hooks/useTheme';
import { MyDayStackParamList, RootTabParamList } from '@app/navigationTypes';
import { MEAL_TYPE_KEYS, MEAL_TYPE_LABEL } from '@services/constants/mealTypes';
import type { MealTypeKey } from '@models/types';

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized.length === 3 ? normalized.repeat(2) : normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const MyDayScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MyDayStackParamList, 'MyDay'>>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(screenWidth - 64, 200); // account for screen + card padding
  const [fabOpen, setFabOpen] = useState(false);
  const backdropColor = colors.background;
  const summaryCardBg = colors.cardBackground;
  const rowCardBg = colors.cardBackgroundLight;
  const rowCardBorder = colors.border;

  // Fetch goal and today's stats
  const { goal, loading: goalLoading } = useGoal();
  const { stats, loading: statsLoading, refresh: refreshStats } = useDayStats();

  // Refresh stats when screen comes into focus (after adding meals)
  useEffect(() => {
    if (isFocused) {
      refreshStats();
    }
  }, [isFocused, refreshStats]);

  useEffect(() => {
    const blurSub = navigation.addListener('blur', () => setFabOpen(false));
    const focusSub = navigation.addListener('focus', () => setFabOpen(false));

    const parentNav = navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();
    const tabPressSub = parentNav?.addListener?.('tabPress', () => setFabOpen(false));

    return () => {
      blurSub();
      focusSub();
      tabPressSub?.();
    };
  }, [navigation]);

  // Default goals if user hasn't set one
  const calorieGoal = goal?.dailyCaloriesKcal ?? 2000;
  const proteinGoal = goal?.proteinGrams ?? 100;
  const carbsGoal = goal?.carbsGrams ?? 250;
  const fatGoal = goal?.fatGrams ?? 65;

  // Today's consumption from stats
  const consumed = stats?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };

  // Calculate progress (0-1, capped at 1)
  const calorieProgress = Math.min(consumed.calories / calorieGoal, 1);
  const proteinProgress = Math.min(consumed.protein / proteinGoal, 1);
  const carbsProgress = Math.min(consumed.carbs / carbsGoal, 1);
  const fatProgress = Math.min(consumed.fat / fatGoal, 1);

  const ringColors = [colors.macroProtein, colors.macroCarb, colors.macroFat];

  const macroProgress = {
    labels: ['Protein', 'Carbs', 'Fat'],
    data: [proteinProgress, carbsProgress, fatProgress],
    colors: ringColors,
  };

  const MEAL_TYPE_ICON: Record<MealTypeKey, number> = {
    breakfast: require('../../assets/breakfast.png'),
    lunch: require('../../assets/lunch.png'),
    dinner: require('../../assets/dinner.png'),
    snacks: require('../../assets/snacks.png'),
    water: require('../../assets/water.png'),
  };

  // Calculate per-meal-type calories from stats
  const meals = MEAL_TYPE_KEYS.filter((key) => key !== 'water').map((key) => {
    const mealTotals = getMealTypeTotals(stats, key);
    const calories = Math.round(mealTotals.calories);
    // Progress is relative to a quarter of daily goal (rough estimate per meal)
    const mealGoal = calorieGoal / 4;
    const progress = Math.min(calories / mealGoal, 1);

    return {
      key,
      label: MEAL_TYPE_LABEL[key],
      calories,
      progress,
      icon: MEAL_TYPE_ICON[key],
    };
  });

  const totalCalories = Math.round(consumed.calories);
  const isLoading = goalLoading || statsLoading;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      gap: 16,
    },
    chartCard: {
      width: '100%',
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
      elevation: 3,
    },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    chartSub: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    fabOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: backdropColor,
    },
    summaryCard: {
      width: '100%',
      marginTop: 16,
      padding: 16,
      borderRadius: 16,
      backgroundColor: summaryCardBg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
      elevation: 3,
      gap: 12,
    },
    summaryHeader: {
      alignItems: 'center',
      gap: 6,
    },
    summaryTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    summarySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    rowCard: {
      backgroundColor: rowCardBg,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: rowCardBorder,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      elevation: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowContent: {
      flex: 1,
      gap: 4,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    rowKcal: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    icon: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
    },
    macroLegend: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    macroItem: {
      alignItems: 'center',
      gap: 4,
    },
    macroDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    macroLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    macroValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    totalValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
    },
  });

  // Format number with thousands separator
  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Macro balance</Text>
            <Text style={styles.chartSub}>Today</Text>
          </View>
          {isLoading ? (
            <View style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              <ProgressChart
                data={macroProgress}
                width={chartWidth}
                height={220}
                strokeWidth={12}
                radius={44}
                withCustomBarColorFromData
                chartConfig={{
                  backgroundGradientFrom: colors.cardBackground,
                  backgroundGradientTo: colors.cardBackground,
                  // This controls the *track* (unfilled) ring color:
                  // ProgressChart calls chartConfig.color(0.2, i) for the background ring.
                  color: (opacity = 1, index = 0) => hexToRgba(ringColors[index] ?? colors.text, opacity),
                  labelColor: () => colors.text,
                }}
              />
              <View style={styles.macroLegend}>
                <View style={styles.macroItem}>
                  <View style={[styles.macroDot, { backgroundColor: colors.macroProtein }]} />
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={styles.macroValue}>{Math.round(consumed.protein)}/{proteinGoal}g</Text>
                </View>
                <View style={styles.macroItem}>
                  <View style={[styles.macroDot, { backgroundColor: colors.macroCarb }]} />
                  <Text style={styles.macroLabel}>Carbs</Text>
                  <Text style={styles.macroValue}>{Math.round(consumed.carbs)}/{carbsGoal}g</Text>
                </View>
                <View style={styles.macroItem}>
                  <View style={[styles.macroDot, { backgroundColor: colors.macroFat }]} />
                  <Text style={styles.macroLabel}>Fat</Text>
                  <Text style={styles.macroValue}>{Math.round(consumed.fat)}/{fatGoal}g</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Today</Text>
            <Text style={styles.summarySubtitle}>
              {formatNumber(totalCalories)} / {formatNumber(calorieGoal)} kcal
            </Text>
          </View>
          <ProgressBar
            progress={calorieProgress}
            color={calorieProgress >= 1 ? colors.warning : colors.success}
            style={{ height: 10, borderRadius: 8 }}
            theme={{ colors: { elevation: { level2: colors.borderLight } } }}
          />
          {meals.map((meal, index) => (
            <React.Fragment key={meal.key}>
              <Pressable
                style={({ pressed }) => [
                  styles.rowCard,
                  pressed && { transform: [{ scale: 0.995 }], opacity: 0.9 },
                ]}
                onPress={() => navigation.navigate('MealTypeEntries', { mealType: meal.key })}
              >
                <View style={styles.row}>
                  <Image source={meal.icon} style={styles.icon} />
                  <View style={styles.rowContent}>
                    <Text style={styles.rowTitle}>{meal.label}</Text>
                    <ProgressBar
                      progress={meal.progress}
                      color={colors.success}
                      style={{ height: 8, borderRadius: 6 }}
                      theme={{ colors: { elevation: { level2: colors.borderLight } } }}
                    />
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowKcal}>{formatNumber(meal.calories)} kcal</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </View>
                </View>
              </Pressable>
              {index < meals.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total today:</Text>
            <Text style={styles.totalValue}>{formatNumber(totalCalories)} kcal</Text>
          </View>
        </View>

        <Portal>
          {fabOpen && (
            <Pressable
              accessibilityLabel="Close quick actions"
              style={styles.fabOverlay}
              onPress={() => setFabOpen(false)}
            />
          )}
          <FAB.Group
            open={fabOpen}
            visible={isFocused}
            icon={fabOpen ? 'close' : 'plus'}
            actions={[
              { icon: 'food', label: 'Add meal', onPress: () => navigation.navigate('AddMeal') },
              { icon: 'package-variant', label: 'Add product', onPress: () => {} },
              { icon: 'cup-water', label: 'Add water', onPress: () => {} },
              { icon: 'barcode-scan', label: 'Scan food', onPress: () => {} },
            ]}
            onStateChange={({ open }) => setFabOpen(open)}
            onPress={() => {
              if (fabOpen) {
                setFabOpen(false);
              }
            }}
            fabStyle={{ backgroundColor: colors.primary }}
            color={colors.textInverse}
            style={{ bottom: insets.bottom + 72 }}
            backdropColor={backdropColor}
          />
        </Portal>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MyDayScreen;

