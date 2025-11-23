import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MealItemRowProps {
  name: string;
  grams: number;
  calories: number;
}

const MealItemRow = ({ name, grams, calories }: MealItemRowProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>
        {grams} g • {calories} kcal
      </Text>
    </View>
  );
};

export default MealItemRow;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  meta: {
    fontSize: 14,
    color: '#555',
  },
});
