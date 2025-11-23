import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import ProductListItem from '../components/ProductListItem';
import { Product } from '../models/types';
import { ProductsStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductsList'>;

const ProductsListScreen = ({ navigation }: Props) => {
  const { products, loading, refresh, deleteProduct } = useProducts();

  const handleAddProduct = useCallback(() => {
    navigation.navigate('ProductForm');
  }, [navigation]);

  const handleEditProduct = useCallback(
    (productId: string) => {
      navigation.navigate('ProductForm', { productId });
    },
    [navigation],
  );

  const confirmDeleteProduct = useCallback(
    (product: Product) => {
      Alert.alert(
        'Delete product',
        `Remove ${product.name}? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteProduct(product.id),
          },
        ],
        { cancelable: true },
      );
    },
    [deleteProduct],
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const renderItem = ({ item }: { item: Product }) => (
    <ProductListItem
      product={item}
      onPress={() => handleEditProduct(item.id)}
      onDelete={() => confirmDeleteProduct(item)}
    />
  );

  const ListEmptyComponent = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No products yet</Text>
      <Text style={styles.emptyBody}>Add your first product to start building meals.</Text>
      <Button title="Add product" onPress={handleAddProduct} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Products</Text>
        <Text style={styles.caption}>
          Products live entirely on your device. Use them to build accurate meals quickly.
        </Text>
      </View>

      {loading && products.length === 0 ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color="#111" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(product) => product.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            products.length === 0 && styles.listContentEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={ListEmptyComponent}
        />
      )}

      <View style={styles.footer}>
        <Button title="Add product" onPress={handleAddProduct} />
      </View>
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
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  caption: {
    fontSize: 14,
    color: '#555',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 12,
  },
  footer: {
    paddingVertical: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyBody: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
});
