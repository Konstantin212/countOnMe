import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { MealsStackParamList } from '../app/navigationTypes';

type Props = NativeStackScreenProps<MealsStackParamList, 'MealDetails'>;

const MealDetailsScreen = ({ route }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Meal details</Text>
      <Text style={styles.body}>
        Once the data layer is ready we will show the full ingredient list, macros, and totals for
        meal <Text style={styles.accent}>{route.params.mealId}</Text>.
      </Text>
    </View>
  );
};

export default MealDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: '#444',
  },
  accent: {
    fontWeight: '600',
  },
});
