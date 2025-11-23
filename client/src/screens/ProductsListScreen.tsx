import React from 'react';
import { Button, FlatList, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import ProductListItem from '../components/ProductListItem';
import { Product } from '../models/types';
import { ProductsStackParamList } from '../app/navigationTypes';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductsList'>;

const placeholderProducts: Product[] = [
  {
    id: 'sample-chicken',
    name: 'Chicken breast',
    caloriesPer100g: 165,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'sample-rice',
    name: 'Cooked rice',
    caloriesPer100g: 130,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

const ProductsListScreen = ({ navigation }: Props) => {
  const renderItem = ({ item }: { item: Product }) => (
    <ProductListItem
      product={item}
      onPress={() => navigation.navigate('ProductForm', { productId: item.id })}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Text style={styles.heading}>Products</Text>
      <Text style={styles.caption}>
        Saved products power every meal. This placeholder list keeps the navigation flow visible
        while we flesh out persistence.
      </Text>

      <FlatList
        data={placeholderProducts}
        keyExtractor={(product) => product.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />

      <Button title="Add product" onPress={() => navigation.navigate('ProductForm')} />
    </SafeAreaView>
  );
};

export default ProductsListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  caption: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
});
