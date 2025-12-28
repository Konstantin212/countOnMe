import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressChart } from 'react-native-chart-kit';
import { FAB, Portal, ProgressBar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@hooks/useTheme';
import { MyDayStackParamList, RootTabParamList } from '@app/navigationTypes';

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
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(screenWidth - 64, 200); // account for screen + card padding
  const [fabOpen, setFabOpen] = useState(false);
  const backdropColor = colors.background;
  const summaryCardBg = colors.cardBackground;
  const rowCardBg = colors.cardBackgroundLight;
  const rowCardBorder = colors.primaryBg;

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

  const ringColors = [colors.macroProtein, colors.macroCarb, colors.macroFat];

  const macroProgress = {
    labels: ['Protein', 'Carbs', 'Fat'],
    data: [0.72, 0.55, 0.38], // hardcoded sample progress
    colors: ringColors,
  };

  const meals = [
    {
      key: 'breakfast',
      label: 'Breakfast',
      calories: 420,
      progress: 0.7,
      icon: require('../../assets/breakfast.png'),
    },
    {
      key: 'lunch',
      label: 'Lunch',
      calories: 610,
      progress: 0.55,
      icon: require('../../assets/lunch.png'),
    },
    {
      key: 'dinner',
      label: 'Dinner',
      calories: 350,
      progress: 0.42,
      icon: require('../../assets/dinner.png'),
    },
    {
      key: 'snacks',
      label: 'Snacks',
      calories: 120,
      progress: 0.25,
      icon: require('../../assets/snacks.png'),
    },
    {
      key: 'water',
      label: 'Water',
      calories: 100,
      progress: 0.3,
      icon: require('../../assets/water.png'),
    },
  ] as const;

  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);

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
              color: () => colors.text,
              labelColor: () => colors.text,
            }}
          />
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Today</Text>
            <Text style={styles.summarySubtitle}>1,480 / 2,200 kcal</Text>
          </View>
          <ProgressBar
            progress={0.67}
            color={colors.success}
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
                  <Text style={styles.rowKcal}>{meal.calories} kcal</Text>
                </View>
              </Pressable>
              {index < meals.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total today:</Text>
            <Text style={styles.totalValue}>{totalCalories} kcal</Text>
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
            visible
            icon={fabOpen ? 'close' : 'plus'}
            actions={[
              { icon: 'food', label: 'Add meal', onPress: () => {} },
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

