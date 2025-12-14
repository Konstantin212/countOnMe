import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ProductsStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductSearch'>;

type SearchResultItem = {
  id: string;
  name: string;
  isRecent: boolean;
};

const ProductSearchScreen = ({ navigation }: Props) => {
  const { products } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');

  // Get 5 most recent products
  const recentProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [products]);

  // Filter recent products by search query
  const displayItems = useMemo((): SearchResultItem[] => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchingRecent = recentProducts.filter((p) => p.name.toLowerCase().includes(query));

      return matchingRecent.map((p) => ({
        id: `recent-${p.id}`,
        name: p.name,
        isRecent: true,
      }));
    }

    // No search, show all recent products
    return recentProducts.map((p) => ({
      id: `recent-${p.id}`,
      name: p.name,
      isRecent: true,
    }));
  }, [searchQuery, recentProducts]);

  const handleSelectProduct = useCallback(
    (item: SearchResultItem) => {
      Keyboard.dismiss();

      // Recent product - find it and navigate to edit
      const productId = item.id.replace('recent-', '');
      navigation.navigate('ProductForm', { productId });
    },
    [navigation],
  );

  const handleAddProduct = useCallback(() => {
    navigation.navigate('ProductForm', {});
  }, [navigation]);

  const handleAddMeal = useCallback(() => {
    // Navigate to Meals tab and then to MealBuilder
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('MealsTab', { screen: 'MealBuilder' });
    }
  }, [navigation]);

  const renderItem = ({ item }: { item: SearchResultItem }) => (
    <Pressable
      style={({ pressed }) => [styles.resultItem, pressed && styles.resultItemPressed]}
      onPress={() => handleSelectProduct(item)}
    >
      <View style={styles.resultContent}>
        <Text style={styles.resultName}>{item.name}</Text>
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
          <Text style={styles.emptySubtext}>Add your first product to get started</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Button Row */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleAddProduct}>
          <Text style={styles.actionButtonText}>Add New Product</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleAddMeal}>
          <Text style={styles.actionButtonText}>Add New Meal</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
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
  buttonRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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

