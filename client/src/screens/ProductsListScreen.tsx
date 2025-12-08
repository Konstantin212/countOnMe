import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import ProductListItem from '../components/ProductListItem';
import { Product } from '../models/types';
import { ProductsStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductsList'>;

const ProductsListScreen = ({ navigation }: Props) => {
  const { products, loading } = useProducts();

  const renderItem = ({ item }: { item: Product }) => (
    <ProductListItem
      product={item}
      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No products yet</Text>
      <Text style={styles.emptySubtext}>Tap "Add Product" to search and add your first product</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.loadingText}>Loading products...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Products</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => navigation.navigate('ProductSearch')}
        >
          <Text style={styles.addButtonText}>+ Add Product</Text>
        </Pressable>
      </View>

      <FlatList
        data={products}
        keyExtractor={(product) => product.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
      />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
});
