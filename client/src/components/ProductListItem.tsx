import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Product } from '../models/types';

interface ProductListItemProps {
  product: Product;
  onPress?: () => void;
  onDelete?: () => void;
}

const ProductListItem = ({ product, onPress, onDelete }: ProductListItemProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.info}>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.meta}>{product.caloriesPer100g} kcal / 100g</Text>
      </View>
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressedDelete]}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
};

export default ProductListItem;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
  },
  info: {
    flex: 1,
    marginRight: 12,
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
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fee2e2',
  },
  pressedDelete: {
    opacity: 0.5,
  },
  deleteText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
});
