import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SegmentedButtons } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '@hooks/useTheme';
import { useProducts } from '@hooks/useProducts';
import { useMeals } from '@hooks/useMeals';
import { calcMealCalories } from '@services/utils/calories';
import { MEAL_TYPE_KEYS, MEAL_TYPE_LABEL } from '@services/constants/mealTypes';
import { MyDayStackParamList } from '@app/navigationTypes';
import { useDraftMeal } from '../../context';

type Props = NativeStackScreenProps<MyDayStackParamList, 'AddMeal'>;

const AddMealScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { products } = useProducts();
  const { addMeal } = useMeals(products);
  const { draft, setMealType, reset, removeItem } = useDraftMeal();

  const currentItems = draft.itemsByMealType[draft.mealType] ?? [];

  const totalCalories = useMemo(() => {
    return calcMealCalories(currentItems, products);
  }, [currentItems, products]);

  const hasAnyItems = useMemo(() => {
    return Object.values(draft.itemsByMealType).some((items) => items.length > 0);
  }, [draft.itemsByMealType]);

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
    scroll: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
    addButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    addButtonText: { color: colors.buttonText, fontSize: 16, fontWeight: '700' },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    itemName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
    itemMeta: { color: colors.textSecondary, fontSize: 13 },
    removeText: { color: colors.error, fontWeight: '700' },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      gap: 12,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    totalValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    saveButtonDisabled: { backgroundColor: colors.disabled },
    saveButtonText: { color: colors.buttonText, fontSize: 16, fontWeight: '700' },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Add meal</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Meal type</Text>
          <SegmentedButtons
            value={draft.mealType}
            onValueChange={(value) => setMealType(value as any)}
            buttons={MEAL_TYPE_KEYS.filter((k) => k !== 'snacks' && k !== 'water').map((k) => ({
              value: k,
              label: MEAL_TYPE_LABEL[k],
            }))}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Products</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => navigation.navigate('SelectProduct')}
          >
            <Text style={styles.addButtonText}>Add product</Text>
          </Pressable>

          {currentItems.length === 0 ? (
            <Text style={styles.itemMeta}>No products added yet.</Text>
          ) : (
            currentItems.map((item) => {
              const p = products.find((x) => x.id === item.productId);
              return (
                <View key={item.productId} style={styles.itemRow}>
                  <Text style={styles.itemName}>{p?.name ?? 'Unknown product'}</Text>
                  <Text style={styles.itemMeta}>
                    {item.amount} {item.unit}
                  </Text>
                  <Pressable onPress={() => removeItem(item.productId)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{Math.round(totalCalories)} kcal</Text>
        </View>
        <Pressable
          style={[styles.saveButton, !hasAnyItems && styles.saveButtonDisabled]}
          disabled={!hasAnyItems}
          onPress={async () => {
            // Save each meal type that has items as its own meal record.
            for (const mealType of MEAL_TYPE_KEYS) {
              const items = draft.itemsByMealType[mealType] ?? [];
              if (items.length === 0) continue;
              await addMeal({
                name: MEAL_TYPE_LABEL[mealType],
                mealType,
                items,
              });
            }
            reset();
            navigation.replace('MyDay');
            // TODO: later navigate to details/history
          }}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default AddMealScreen;

