import React, { useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import ProductListItem from "@components/ProductListItem";
import { Product } from "@models/types";
import { ProfileStackParamList, RootTabParamList } from "@app/navigationTypes";
import { useProducts } from "@hooks/useProducts";
import { useTheme } from "@hooks/useTheme";

type Props = NativeStackScreenProps<ProfileStackParamList, "ProductsList">;

const ProductsListScreen = ({ navigation }: Props) => {
  const { products, loading, refresh } = useProducts();
  const { colors } = useTheme();
  const userProducts = useMemo(
    () => products.filter((p) => p.source === "user"),
    [products],
  );

  // Refresh products when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 24,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
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
      fontWeight: "600",
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
      fontWeight: "600",
    },
    listContent: {
      gap: 12,
      paddingBottom: 24,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 32,
    },
    shareButton: {
      padding: 6,
      borderRadius: 6,
    },
    shareButtonPressed: {
      opacity: 0.5,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    itemContent: {
      flex: 1,
    },
  });

  const handleShare = useCallback(
    (productId: string) => {
      navigation
        .getParent<BottomTabNavigationProp<RootTabParamList>>()
        ?.navigate("DiscoverTab", {
          screen: "PublishFood",
          params: { productId },
        });
    },
    [navigation],
  );

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemContent}>
        <ProductListItem
          product={item}
          onPress={() =>
            navigation.navigate("ProductDetails", { productId: item.id })
          }
        />
      </View>
      <Pressable
        onPress={() => handleShare(item.id)}
        style={({ pressed }) => [
          styles.shareButton,
          pressed && styles.shareButtonPressed,
        ]}
        testID={`share-product-${item.id}`}
        hitSlop={8}
      >
        <Ionicons name="share-outline" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No products yet</Text>
      <Text style={styles.emptySubtext}>
        Tap "Add Product" to search and add your first product
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <Text style={styles.loadingText}>Loading products...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.heading}>Products</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => navigation.navigate("ProductSearch")}
        >
          <Text style={styles.addButtonText}>+ Add Product</Text>
        </Pressable>
      </View>

      <FlatList
        data={userProducts}
        keyExtractor={(product) => product.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
};

export default ProductsListScreen;
