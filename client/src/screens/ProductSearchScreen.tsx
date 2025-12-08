import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ProductsStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';
import {
  extractCalories,
  extractMacros,
  OpenFoodFactsProduct,
  searchProducts,
} from '../services/openFoodFacts';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductSearch'>;

type SearchResultItem = {
  id: string;
  name: string;
  brands?: string;
  isRecent: boolean;
  externalProduct?: OpenFoodFactsProduct;
};

const ProductSearchScreen = ({ navigation }: Props) => {
  const { products } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OpenFoodFactsProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get 5 most recent products
  const recentProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [products]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await searchProducts(searchQuery);
        setSearchResults(result.products);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Combine recent products and search results
  const displayItems = useMemo((): SearchResultItem[] => {
    const items: SearchResultItem[] = [];

    // If searching, show recent products that match first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchingRecent = recentProducts.filter((p) => p.name.toLowerCase().includes(query));

      items.push(
        ...matchingRecent.map((p) => ({
          id: `recent-${p.id}`,
          name: p.name,
          isRecent: true,
        })),
      );
    } else {
      // No search, show all recent products
      items.push(
        ...recentProducts.map((p) => ({
          id: `recent-${p.id}`,
          name: p.name,
          isRecent: true,
        })),
      );
    }

    // Add search results from API
    if (searchQuery.trim() && searchResults.length > 0) {
      items.push(
        ...searchResults
          .filter((p) => p.product_name) // Only products with names
          .map((p) => ({
            id: `api-${p.code}`,
            name: p.product_name,
            brands: p.brands,
            isRecent: false,
            externalProduct: p,
          })),
      );
    }

    return items;
  }, [searchQuery, recentProducts, searchResults]);

  const handleSelectProduct = useCallback(
    (item: SearchResultItem) => {
      Keyboard.dismiss();

      if (item.isRecent) {
        // Recent product - find it and navigate to edit
        const productId = item.id.replace('recent-', '');
        navigation.navigate('ProductForm', { productId });
      } else if (item.externalProduct) {
        // External product - navigate to confirmation
        const calories = extractCalories(item.externalProduct);
        const macros = extractMacros(item.externalProduct);

        navigation.navigate('ProductConfirm', {
          externalProduct: {
            code: item.externalProduct.code,
            name: item.externalProduct.product_name,
            brands: item.externalProduct.brands,
            caloriesPer100g: calories,
            proteinPer100g: macros.protein,
            carbsPer100g: macros.carbs,
            fatPer100g: macros.fat,
          },
        });
      }
    },
    [navigation],
  );

  const renderItem = ({ item }: { item: SearchResultItem }) => (
    <Pressable
      style={({ pressed }) => [styles.resultItem, pressed && styles.resultItemPressed]}
      onPress={() => handleSelectProduct(item)}
    >
      <View style={styles.resultContent}>
        <Text style={styles.resultName}>{item.name}</Text>
        {item.brands && <Text style={styles.resultBrands}>{item.brands}</Text>}
        {item.isRecent && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Recent</Text>
          </View>
        )}
      </View>
    </Pressable>
  );

  const renderHeader = () => {
    if (!searchQuery.trim() && recentProducts.length > 0) {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recently Added</Text>
        </View>
      );
    }
    return null;
  };

  const renderEmptyState = () => {
    if (loading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>⚠️ {error}</Text>
          <Text style={styles.emptySubtext}>Please check your internet connection</Text>
        </View>
      );
    }

    if (searchQuery.trim() && displayItems.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No products found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      );
    }

    if (!searchQuery.trim() && recentProducts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No recent products</Text>
          <Text style={styles.emptySubtext}>Search to add your first product</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search products..."
          placeholderTextColor="#999"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {loading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        )}
      </View>

      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
};

export default ProductSearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  loadingIndicator: {
    position: 'absolute',
    right: 28,
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 24,
  },
  resultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultItemPressed: {
    backgroundColor: '#f9fafb',
  },
  resultContent: {
    flexDirection: 'column',
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  resultBrands: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

