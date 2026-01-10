import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SegmentedButtons } from 'react-native-paper';
import { StackActions } from '@react-navigation/native';

import { useTheme } from '@hooks/useTheme';
import { useProducts } from '@hooks/useProducts';
import type { Unit } from '@models/types';
import { MyDayStackParamList } from '@app/navigationTypes';
import { useDraftMeal } from '../../context';
import { convertUnit } from '@services/utils/units';

type Props = NativeStackScreenProps<MyDayStackParamList, 'AddFood'>;

const AddFoodScreen = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { products } = useProducts();
  const { upsertItem } = useDraftMeal();

  const product = products.find((p) => p.id === route.params.productId);
  const [amountText, setAmountText] = useState('1');

  const baseUnit = (product?.scaleUnit ?? 'g') as Unit;
  const allowedUnits = (product?.allowedUnits?.length ? product.allowedUnits : []) as Unit[];

  const unitOptions: Unit[] = [baseUnit, ...allowedUnits];
  const [unit, setUnit] = useState<Unit>(baseUnit);

  const amount = Number(amountText);

  const calories = useMemo(() => {
    if (!product) return 0;
    const baseAmount = product.portionSize ?? 100;
    const calPerBase = product.caloriesPerBase ?? product.caloriesPer100g;
    if (!Number.isFinite(amount) || amount <= 0 || calPerBase <= 0) return 0;

    const converted = convertUnit(amount, unit, baseUnit);
    if (converted === null) return 0;
    return calPerBase * (converted / baseAmount);
  }, [amount, baseUnit, product, unit]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 16 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
      gap: 12,
    },
    backButton: { padding: 8, borderRadius: 999, backgroundColor: colors.cardBackground },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 },
    card: {
      marginHorizontal: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    label: { color: colors.textSecondary, fontWeight: '700' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.inputBackground,
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    caloriesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    caloriesLabel: { color: colors.textSecondary, fontWeight: '700' },
    caloriesValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
    button: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buttonText: { color: colors.buttonText, fontSize: 16, fontWeight: '700' },
    error: { marginHorizontal: 16, color: colors.error, fontWeight: '700' },
  });

  if (!product) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Add food</Text>
        </View>
        <Text style={styles.error}>Product not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{product.name}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Unit</Text>
        <SegmentedButtons
          value={unit}
          onValueChange={(v) => setUnit(v as Unit)}
          buttons={unitOptions.map((u) => ({ value: u, label: u }))}
        />

        <Text style={styles.label}>Amount</Text>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          style={styles.input}
        />

        <View style={styles.caloriesRow}>
          <Text style={styles.caloriesLabel}>Calories</Text>
          <Text style={styles.caloriesValue}>{Math.round(calories)} kcal</Text>
        </View>
      </View>

      <Pressable
        style={styles.button}
        onPress={async () => {
          const numeric = Number(amountText);
          if (!Number.isFinite(numeric) || numeric <= 0) return;

          upsertItem({ productId: product.id, amount: numeric, unit });
          navigation.dispatch(StackActions.popTo('AddMeal'));
        }}
      >
        <Text style={styles.buttonText}>Add</Text>
      </Pressable>
    </SafeAreaView>
  );
};

export default AddFoodScreen;

