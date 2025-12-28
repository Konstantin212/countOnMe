import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressChart } from 'react-native-chart-kit';
import { FAB, Portal } from 'react-native-paper';
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
  const backdropColor = hexToRgba(colors.background, 0.9);

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
    fabOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: backdropColor,
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
      </View>
    </SafeAreaView>
  );
};

export default MyDayScreen;

