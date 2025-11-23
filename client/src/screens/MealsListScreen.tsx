import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { MealsStackParamList } from '../app/navigationTypes';

type Props = NativeStackScreenProps<MealsStackParamList, 'MealsList'>;

const MealsListScreen = ({ navigation }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Meals</Text>
      <Text style={styles.body}>
        Meals combine your saved products. We will load meals from AsyncStorage in the next
        milestone—until then this placeholder screen makes the navigation flow tangible.
      </Text>
      <Button title="Build meal" onPress={() => navigation.navigate('MealBuilder')} />
    </View>
  );
};

export default MealsListScreen;

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
    color: '#555',
    marginBottom: 16,
  },
});
