import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressChart } from 'react-native-chart-kit';
import { useTheme } from '@hooks/useTheme';

const MyDayScreen = () => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(screenWidth - 64, 200); // account for screen + card padding

  const ringColors = [colors.macroProtein, colors.macroCarb, colors.macroFat];

  const macroProgress = {
    labels: ['Protein', 'Carbs', 'Fat'],
    data: [0.72, 0.55, 0.38], // hardcoded sample progress
    colors: ringColors,
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'center',
      padding: 16,
    },
    chartCard: {
      width: '100%',
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.cardBackground,
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
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
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
      </View>
    </SafeAreaView>
  );
};

export default MyDayScreen;

