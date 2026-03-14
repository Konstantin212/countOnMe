import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { SegmentedButtons } from "react-native-paper";

import { useTheme } from "@hooks/useTheme";
import { useProducts } from "@hooks/useProducts";
import type { Product, ProductSearchResult } from "@models/types";
import { MyDayStackParamList } from "@app/navigationTypes";
import {
  loadProductFavourites,
  loadProductRecents,
  saveProductFavourites,
} from "@storage/storage";
import { searchProducts } from "@services/api/products";

type Props = NativeStackScreenProps<MyDayStackParamList, "SelectProduct">;

const SEARCH_DEBOUNCE_MS = 400;

const SelectProductScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { products, refresh: refreshProducts, addProduct } = useProducts();

  useFocusEffect(
    useCallback(() => {
      refreshProducts();
    }, [refreshProducts]),
  );

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "favourited">("all");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  const [searchResults, setSearchResults] = useState<
    ProductSearchResult[] | null
  >(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchError, setIsSearchError] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const [fav, recent] = await Promise.all([
        loadProductFavourites(),
        loadProductRecents(),
      ]);
      setFavourites(fav);
      setRecents(recent);
    })();
  }, []);

  const toggleFavourite = useCallback(async (productId: string) => {
    setFavourites((prev) => {
      const isAlreadyFav = prev.includes(productId);
      const next = isAlreadyFav
        ? prev.filter((id) => id !== productId)
        : [productId, ...prev];
      void saveProductFavourites(next);
      return next;
    });
  }, []);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const favouritedList = useMemo(
    () =>
      favourites
        .map((id) => productMap.get(id))
        .filter((p): p is Product => p !== undefined),
    [favourites, productMap],
  );

  const defaultList = useMemo(() => {
    if (tab === "favourited") return favouritedList;
    // "all" tab: up to 5 favourites (alpha sorted) + up to 10 recents not in favourites (alpha sorted)
    const favSlot = favourites
      .slice(0, 5)
      .map((id) => productMap.get(id))
      .filter((p): p is Product => p !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
    const favIds = new Set(favSlot.map((p) => p.id));
    const recentSlot = recents
      .filter((id) => !favIds.has(id))
      .slice(0, 10)
      .map((id) => productMap.get(id))
      .filter((p): p is Product => p !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...favSlot, ...recentSlot];
  }, [tab, favourites, recents, productMap, favouritedList]);

  const runSearch = useCallback(async (q: string) => {
    setSearchLoading(true);
    setIsSearchError(false);
    try {
      const data = await searchProducts(q, 35);
      const results: ProductSearchResult[] = data.map((item) => ({
        id: item.id,
        name: item.name,
        source: item.source,
        caloriesPer100g: item.calories_per_100g,
        catalogId: item.catalog_id,
        proteinPer100g: item.protein_per_100g,
        carbsPer100g: item.carbs_per_100g,
        fatPer100g: item.fat_per_100g,
      }));
      setSearchResults(results);
    } catch {
      setIsSearchError(true);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current !== null) {
      clearTimeout(searchTimer.current);
    }

    if (!query.trim()) {
      setSearchResults(null);
      setIsSearchError(false);
      return;
    }

    searchTimer.current = setTimeout(() => {
      void runSearch(query.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimer.current !== null) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [query, runSearch]);

  const handleCatalogSelect = useCallback(
    async (item: ProductSearchResult) => {
      try {
        const newProduct = await addProduct({
          name: item.name,
          caloriesPer100g: item.caloriesPer100g ?? 0,
          source: "catalog",
          proteinPer100g: item.proteinPer100g ?? undefined,
          carbsPer100g: item.carbsPer100g ?? undefined,
          fatPer100g: item.fatPer100g ?? undefined,
        });
        navigation.navigate("AddFood", { productId: newProduct.id });
      } catch {
        Alert.alert("Error", "Could not add product. Please try again.");
      }
    },
    [addProduct, navigation],
  );

  const favouriteSet = useMemo(() => new Set(favourites), [favourites]);
  const recentSet = useMemo(() => new Set(recents), [recents]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 16 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      marginBottom: 8,
      gap: 12,
    },
    backButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.cardBackground,
    },
    title: { fontSize: 20, fontWeight: "700", color: colors.text, flex: 1 },
    controls: { paddingHorizontal: 16, gap: 12, paddingBottom: 12 },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    tabs: {
      marginTop: 4,
    },
    addProductButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
    },
    addProductText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    listContent: { paddingHorizontal: 16, paddingBottom: 24 },
    row: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    rowName: { flex: 1, color: colors.text, fontWeight: "600" },
    rowMeta: { color: colors.textSecondary, fontSize: 12 },
    star: { padding: 6 },
    catalogBadge: {
      fontSize: 11,
      color: colors.textSecondary,
      opacity: 0.7,
      marginTop: 2,
    },
    centeredState: {
      paddingVertical: 32,
      alignItems: "center",
      gap: 12,
    },
    stateText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
    },
    retryButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    retryText: {
      color: colors.buttonText,
      fontWeight: "600",
      fontSize: 14,
    },
    rowContent: { flex: 1 },
  });

  const renderUserRow = ({ item }: { item: Product }) => (
    <Pressable
      onPress={() => {
        Keyboard.dismiss();
        navigation.navigate("AddFood", { productId: item.id });
      }}
      style={styles.row}
      testID={`product-row-${item.id}`}
    >
      <View style={styles.rowContent}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowMeta}>{item.caloriesPer100g} kcal / 100g</Text>
      </View>
      <Pressable
        style={styles.star}
        onPress={() => toggleFavourite(item.id)}
        hitSlop={8}
        testID={`favourite-btn-${item.id}`}
      >
        <Ionicons
          name={
            favouriteSet.has(item.id)
              ? "star"
              : recentSet.has(item.id)
                ? "refresh-circle-outline"
                : "star-outline"
          }
          size={20}
          color={
            favouriteSet.has(item.id) ? colors.warning : colors.textSecondary
          }
        />
      </Pressable>
    </Pressable>
  );

  const renderSearchRow = ({ item }: { item: ProductSearchResult }) => {
    if (item.source === "user") {
      const product = productMap.get(item.id);
      if (product) {
        return renderUserRow({ item: product });
      }
      return (
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            navigation.navigate("AddFood", { productId: item.id });
          }}
          style={styles.row}
          testID={`search-row-${item.id}`}
        >
          <View style={styles.rowContent}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {item.caloriesPer100g != null
                ? `${item.caloriesPer100g} kcal / 100g`
                : ""}
            </Text>
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          void handleCatalogSelect(item);
        }}
        style={styles.row}
        testID={`catalog-row-${item.id}`}
      >
        <View style={styles.rowContent}>
          <Text style={styles.rowName}>{item.name}</Text>
          <Text style={styles.rowMeta}>
            {item.caloriesPer100g != null
              ? `${item.caloriesPer100g} kcal / 100g`
              : ""}
          </Text>
          <Text style={styles.catalogBadge}>Catalog</Text>
        </View>
      </Pressable>
    );
  };

  const isSearchActive = query.trim().length > 0;

  const renderSearchState = () => {
    if (searchLoading) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    if (isSearchError) {
      return (
        <View style={styles.centeredState}>
          <Text style={styles.stateText}>Search failed. Please try again.</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void runSearch(query.trim())}
            testID="search-retry-btn"
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    if (searchResults !== null && searchResults.length === 0) {
      return (
        <View style={styles.centeredState}>
          <Text style={styles.stateText}>No results found.</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          testID="back-btn"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Select product</Text>
      </View>

      <View style={styles.controls}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search products..."
          placeholderTextColor={colors.textTertiary}
          style={styles.search}
          testID="search-input"
        />

        {!query && (
          <SegmentedButtons
            value={tab}
            onValueChange={(v) => {
              const val = v === "all" || v === "favourited" ? v : "all";
              setTab(val);
            }}
            buttons={[
              { value: "all", label: "All" },
              { value: "favourited", label: "Favourited" },
            ]}
            style={styles.tabs}
          />
        )}

        <Pressable
          style={styles.addProductButton}
          onPress={() => navigation.navigate("ProductForm")}
          testID="create-product-btn"
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.addProductText}>Create new product</Text>
        </Pressable>
      </View>

      {isSearchActive ? (
        <>
          {renderSearchState()}
          {!searchLoading &&
          !isSearchError &&
          searchResults !== null &&
          searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchRow}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          ) : null}
        </>
      ) : (
        <FlatList
          data={defaultList}
          keyExtractor={(p) => p.id}
          renderItem={renderUserRow}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
};

export default SelectProductScreen;
