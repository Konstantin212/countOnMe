import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ProductsStackParamList } from '../app/navigationTypes';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductForm'>;

const ProductFormScreen = ({ route }: Props) => {
  const isEditing = Boolean(route.params?.productId);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{isEditing ? 'Edit product' : 'Add product'}</Text>
      <Text style={styles.subtitle}>
        The actual form will live here shortly. For now this screen is a stub that confirms the
        navigation stack works end-to-end.
      </Text>
    </View>
  );
};

export default ProductFormScreen;

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
  subtitle: {
    fontSize: 16,
    color: '#444',
  },
});
