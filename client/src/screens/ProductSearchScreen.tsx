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
import { Ionicons } from '@expo/vector-icons';

import { ProfileStackParamList } from '@app/navigationTypes';
import { useProducts } from '@hooks/useProducts';
import { useTheme } from '@hooks/useTheme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProductSearch'>;

type SearchResultItem = {
  id: string;
  name: string;
  isRecent: boolean;
};

const ProductSearchScreen = ({ navigation }: Props) => {
  const { products } = useProducts();
  const { colors } = useTheme();
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
    // Navigate to MealBuilder in the same stack
    navigation.navigate('MealBuilder', {});
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 4,
    },
    backButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.cardBackground,
      marginRight: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    buttonRow: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    actionButton: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: '600',
    },
    searchContainer: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    sectionHeader: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.cardBackground,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    listContent: {
      paddingBottom: 24,
    },
    resultItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    resultItemPressed: {
      backgroundColor: colors.pressed,
    },
    resultContent: {
      flexDirection: 'column',
    },
    resultName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginTop: 4,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
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
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Add Product</Text>
      </View>

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

