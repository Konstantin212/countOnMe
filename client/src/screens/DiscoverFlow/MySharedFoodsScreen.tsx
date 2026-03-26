import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import type { SharedFoodListItem as SharedFoodListItemType } from "@models/types";
import { DiscoverStackParamList } from "@app/navigationTypes";
import { useMySharedFoods } from "@hooks/useMySharedFoods";
import { useTheme } from "@hooks/useTheme";
import SharedFoodListItem from "./components/SharedFoodListItem";
import PublishStatusBadge from "./components/PublishStatusBadge";

type Props = NativeStackScreenProps<DiscoverStackParamList, "MySharedFoods">;

const MySharedFoodsScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const {
    foods,
    loading,
    error,
    refresh,
    publishFood,
    unpublishFood,
    deleteFood,
  } = useMySharedFoods();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handlePublish = (id: string) => {
    Alert.alert(
      "Publish Food",
      "Publishing will submit this food for review. It will become visible to other users once approved. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: () => publishFood(id),
        },
      ],
    );
  };

  const handleUnpublish = (id: string) => {
    Alert.alert(
      "Unpublish Food",
      "This will remove the food from the public directory. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unpublish",
          onPress: () => unpublishFood(id),
        },
      ],
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Shared Food",
      "This will permanently delete this shared food. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteFood(id),
        },
      ],
    );
  };

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
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      paddingHorizontal: 32,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 32,
    },
    errorText: {
      fontSize: 16,
      color: colors.error,
      textAlign: "center",
    },
    actionRow: {
      flexDirection: "row",
      gap: 8,
    },
    actionButton: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1,
    },
    publishButton: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryBg,
    },
    unpublishButton: {
      borderColor: colors.warning,
      backgroundColor: colors.warningLight,
    },
    deleteButton: {
      borderColor: colors.error,
      backgroundColor: colors.errorLight,
    },
    publishButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    unpublishButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.warning,
    },
    deleteButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.error,
    },
    pressedAction: {
      opacity: 0.5,
    },
  });

  const renderActions = (item: SharedFoodListItemType) => {
    const isPublic = item.visibility === "public";

    return (
      <View>
        <PublishStatusBadge
          visibility={item.visibility}
          moderationStatus={item.moderationStatus}
        />
        <View style={[styles.actionRow, { marginTop: 8 }]}>
          {isPublic ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.unpublishButton,
                pressed && styles.pressedAction,
              ]}
              onPress={() => handleUnpublish(item.id)}
              testID={`unpublish-${item.id}`}
            >
              <Text style={styles.unpublishButtonText}>Unpublish</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.publishButton,
                pressed && styles.pressedAction,
              ]}
              onPress={() => handlePublish(item.id)}
              testID={`publish-${item.id}`}
            >
              <Text style={styles.publishButtonText}>Publish</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.deleteButton,
              pressed && styles.pressedAction,
            ]}
            onPress={() => handleDelete(item.id)}
            testID={`delete-shared-${item.id}`}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: SharedFoodListItemType }) => (
    <SharedFoodListItem
      item={item}
      onPress={() =>
        navigation.navigate("SharedFoodDetail", { sharedFoodId: item.id })
      }
      rightElement={renderActions(item)}
    />
  );

  const renderEmptyState = () => {
    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No shared foods yet</Text>
        <Text style={styles.emptySubtext}>
          Share your first food to help the community! Go to Profile &gt;
          Products and tap the share icon on any product.
        </Text>
      </View>
    );
  };

  if (loading && foods.length === 0) {
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
            <Text style={styles.heading}>My Shared Foods</Text>
          </View>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
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
          <Text style={styles.heading}>My Shared Foods</Text>
        </View>
      </View>

      <FlatList
        data={foods}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
};

export default MySharedFoodsScreen;
