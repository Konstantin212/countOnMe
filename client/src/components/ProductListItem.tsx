import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Product } from '../models/types';

interface ProductListItemProps {
  product: Product;
  onPress?: () => void;
}

const ProductListItem = ({ product, onPress }: ProductListItemProps) => {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.container, pressed && styles.pressed]}>
      <View>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.meta}>{product.caloriesPer100g} kcal / 100g</Text>
      </View>
    </Pressable>
  );
};

export default ProductListItem;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
  },
  pressed: {
    opacity: 0.6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  meta: {
    fontSize: 14,
    color: '#555',
  },
});
