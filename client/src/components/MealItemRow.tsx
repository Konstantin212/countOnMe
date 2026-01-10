import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@hooks/useTheme';

interface MealItemRowProps {
  name: string;
  amount: number;
  unit: string;
  calories: number;
}

const MealItemRow = ({ name, amount, unit, calories }: MealItemRowProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
      color: colors.text,
    },
    meta: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>
        {amount} {unit} • {calories} kcal
      </Text>
    </View>
  );
};

export default MealItemRow;
