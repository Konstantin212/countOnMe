import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import ProductListItem from '@components/ProductListItem';
import { Product } from '@models/types';
import { ProfileStackParamList } from '@app/navigationTypes';
import { useProducts } from '@hooks/useProducts';
import { useTheme } from '@hooks/useTheme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProductsList'>;

const ProductsListScreen = ({ navigation }: Props) => {
  const { products, loading, refresh } = useProducts();
  const { colors } = useTheme();

  // Refresh products when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('ProductsList screen focused, refreshing...');
      refresh();
    }, [refresh])
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 24,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    backButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.cardBackground,
    },
    headerTitle: {
      flex: 1,
      marginLeft: 12,
    },
    heading: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
    },
    addButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    addButtonText: {
      color: colors.buttonText,
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
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 32,
    },
  });

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
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.loadingText}>Loading products...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.heading}>Products</Text>
        </View>
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
