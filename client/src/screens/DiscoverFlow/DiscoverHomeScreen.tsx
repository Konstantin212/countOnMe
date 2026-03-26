import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import type { SharedFoodListItem as SharedFoodListItemType } from "@models/types";
import { DiscoverStackParamList } from "@app/navigationTypes";
import { useSharedFoodSearch } from "@hooks/useSharedFoodSearch";
import { useTheme } from "@hooks/useTheme";
import { Button } from "@particles";
import SharedFoodListItem from "./components/SharedFoodListItem";

type Props = NativeStackScreenProps<DiscoverStackParamList, "DiscoverHome">;

const DiscoverHomeScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { results, query, setQuery, loading, isError, retry, hasSearched } =
    useSharedFoodSearch();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 24,
      backgroundColor: colors.background,
    },
    heading: {
      fontSize: 24,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 12,
      marginBottom: 16,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
    },
    clearButton: {
      padding: 4,
    },
    mySharedCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
      marginBottom: 16,
    },
    mySharedCardPressed: {
      opacity: 0.6,
    },
    mySharedLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    mySharedText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    mySharedSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    listContent: {
      gap: 12,
      paddingBottom: 24,
    },
    centerContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    errorText: {
      fontSize: 16,
      color: colors.error,
      marginBottom: 12,
      textAlign: "center",
    },
  });

  const handleItemPress = (item: SharedFoodListItemType) => {
    navigation.navigate("SharedFoodDetail", { sharedFoodId: item.id });
  };

  const renderItem = ({ item }: { item: SharedFoodListItemType }) => (
    <SharedFoodListItem item={item} onPress={() => handleItemPress(item)} />
  );

  const renderEmptyContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Search failed. Please try again.</Text>
          <Button onPress={retry} testID="retry-search-button">
            Retry
          </Button>
        </View>
      );
    }

    if (hasSearched) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Search for community foods</Text>
        <Text style={styles.emptySubtext}>
          Type a food name above to discover shared foods
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.heading}>Discover</Text>
      <Text style={styles.subtitle}>Find foods shared by the community</Text>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.textTertiary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search community foods..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="discover-search-input"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery("")}
            style={styles.clearButton}
            testID="clear-search-button"
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={colors.textTertiary}
            />
          </Pressable>
        ) : null}
      </View>

      {!query.trim() ? (
        <Pressable
          onPress={() => navigation.navigate("MySharedFoods")}
          style={({ pressed }) => [
            styles.mySharedCard,
            pressed && styles.mySharedCardPressed,
          ]}
          testID="my-shared-foods-card"
        >
          <View style={styles.mySharedLeft}>
            <Ionicons name="share-outline" size={22} color={colors.primary} />
            <View>
              <Text style={styles.mySharedText}>My Shared Foods</Text>
              <Text style={styles.mySharedSubtext}>
                Manage your shared contributions
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </Pressable>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyContent}
      />
    </SafeAreaView>
  );
};

export default DiscoverHomeScreen;
