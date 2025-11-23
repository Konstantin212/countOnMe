import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { MealsStackParamList } from '../app/navigationTypes';

type Props = NativeStackScreenProps<MealsStackParamList, 'MealBuilder'>;

const MealBuilderScreen = ({ navigation, route }: Props) => {
  const isEditing = Boolean(route.params?.mealId);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{isEditing ? 'Edit meal' : 'Build meal'}</Text>
      <Text style={styles.body}>
        This builder will let you pick products, enter grams, and view totals. Once the data layer is
        in place, saving here will navigate to the meal details screen.
      </Text>
      <Text
        style={styles.link}
        onPress={() =>
          navigation.navigate('MealDetails', {
            mealId: route.params?.mealId ?? 'preview',
          })
        }
      >
        Preview meal details
      </Text>
    </View>
  );
};

export default MealBuilderScreen;

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
    marginBottom: 16,
  },
  link: {
    fontSize: 16,
    color: '#2563eb',
  },
});
