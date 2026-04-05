import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { FAB, Portal } from "react-native-paper";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@hooks/useTheme";
import { useGoal } from "@hooks/useGoal";
import { useWaterTracking } from "@hooks/useWaterTracking";
import { useBodyWeight } from "@hooks/useBodyWeight";
import { useStatsRange } from "@hooks/useStatsRange";
import { useFasting } from "@hooks/useFasting";
import { WaterModal } from "@components/WaterModal";
import {
  calculateWeightTrend,
  calculateETA,
  calculateEfficiency,
  calculateConsistency,
} from "@services/utils/insights";
import { WeightMetricWidget } from "./components/WeightMetricWidget";
import { EtaTrajectoryWidget } from "./components/EtaTrajectoryWidget";
import { EfficiencyWidget } from "./components/EfficiencyWidget";
import { ConsistencyWidget } from "./components/ConsistencyWidget";
import { HydrationWidget } from "./components/HydrationWidget";
import { FastingWidget } from "./components/FastingWidget";
import { ActiveCalWidget } from "./components/ActiveCalWidget";
import { AddWeightModal } from "./components/AddWeightModal";
import type {
  MyPathStackParamList,
  RootTabParamList,
} from "@app/navigationTypes";
import type { StatsPeriod } from "@models/types";

const MyPathScreen = () => {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<MyPathStackParamList, "MyPath">>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [fabOpen, setFabOpen] = useState(false);
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightPeriod, setWeightPeriod] = useState<StatsPeriod>("7d");
  const backdropColor = colors.background;

  // Hooks
  const { goal, loading: goalLoading, refresh: refreshGoal } = useGoal();
  const {
    weights,
    loading: weightsLoading,
    refresh: refreshWeights,
    logWeight,
  } = useBodyWeight();
  const {
    dailyStats,
    loading: statsLoading,
    refresh: refreshStats,
  } = useStatsRange();
  const { todayTotal, waterGoal, addWater, removeWater } = useWaterTracking(
    goal?.waterMl,
  );
  const { activeSession, refresh: refreshFasting } = useFasting();

  // Derived data
  const trend = calculateWeightTrend(weights, weightPeriod);
  const eta = goal ? calculateETA(weights, goal) : null;
  const efficiency = goal ? calculateEfficiency(dailyStats, goal) : null;
  const consistency = goal ? calculateConsistency(dailyStats, goal) : null;

  // Loading state
  const isLoading = goalLoading || weightsLoading || statsLoading;

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refreshGoal(),
      refreshWeights(),
      refreshStats(),
      refreshFasting(),
    ]);
  }, [refreshGoal, refreshWeights, refreshStats, refreshFasting]);

  // Close FAB on navigation events
  useEffect(() => {
    const blurSub = navigation.addListener("blur", () => setFabOpen(false));
    const focusSub = navigation.addListener("focus", () => setFabOpen(false));

    const parentNav =
      navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();
    const tabPressSub = parentNav?.addListener?.("tabPress", () =>
      setFabOpen(false),
    );

    return () => {
      blurSub();
      focusSub();
      tabPressSub?.();
    };
  }, [navigation]);

  // Handle goal setup navigation
  const handleSetupGoal = () => {
    navigation
      .getParent<BottomTabNavigationProp<RootTabParamList>>()
      ?.navigate("ProfileTab", { screen: "GoalSetup" });
  };

  // Handle fasting press
  const handleFastingPress = () => {
    if (activeSession) {
      navigation.navigate("FastingScreen", { sessionId: activeSession.id });
    } else {
      navigation.navigate("FastingSetup");
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      gap: 16,
      paddingBottom: 100,
    },
    header: {
      marginBottom: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.text,
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    halfRow: {
      flexDirection: "row",
      gap: 12,
    },
    fabOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>My Path</Text>
          </View>

          <WeightMetricWidget
            weights={weights}
            trend={trend}
            period={weightPeriod}
            onPeriodChange={setWeightPeriod}
          />

          <View style={styles.row}>
            <EtaTrajectoryWidget
              eta={eta}
              goal={goal}
              onSetupGoal={handleSetupGoal}
            />
            <EfficiencyWidget efficiency={efficiency} />
          </View>

          <ConsistencyWidget consistency={consistency} />

          <View style={styles.row}>
            <HydrationWidget todayTotal={todayTotal} waterGoal={waterGoal} />
            <FastingWidget
              activeSession={activeSession}
              onPress={handleFastingPress}
            />
          </View>

          <View style={styles.halfRow}>
            <ActiveCalWidget />
          </View>
        </ScrollView>
      )}

      <Portal>
        {fabOpen && (
          <Pressable
            accessibilityLabel="Close quick actions"
            testID="backdrop-close"
            style={styles.fabOverlay}
            onPress={() => setFabOpen(false)}
          />
        )}
        <FAB.Group
          open={fabOpen}
          visible={isFocused}
          icon={fabOpen ? "close" : "plus"}
          actions={[
            {
              icon: "food",
              label: "Add meal",
              onPress: () =>
                navigation
                  .getParent<BottomTabNavigationProp<RootTabParamList>>()
                  ?.navigate("MyDayTab", { screen: "AddMeal" }),
            },
            {
              icon: "package-variant",
              label: "Add product",
              onPress: () =>
                navigation
                  .getParent<BottomTabNavigationProp<RootTabParamList>>()
                  ?.navigate("MyDayTab", { screen: "SelectProduct" }),
            },
            {
              icon: "cup-water",
              label: "Add water",
              onPress: () => setWaterModalVisible(true),
            },
            {
              icon: "barcode-scan",
              label: "Scan food",
              onPress: () =>
                navigation
                  .getParent<BottomTabNavigationProp<RootTabParamList>>()
                  ?.navigate("MyDayTab", { screen: "BarcodeScanner" }),
            },
            {
              icon: "scale-bathroom",
              label: "Log weight",
              onPress: () => setWeightModalVisible(true),
            },
            {
              icon: "timer-outline",
              label: "Start fast",
              onPress: () => handleFastingPress(),
            },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
          onPress={() => {
            if (fabOpen) {
              setFabOpen(false);
            }
          }}
          fabStyle={{ backgroundColor: colors.primary }}
          color={colors.textInverse}
          style={{ bottom: insets.bottom + 72 }}
          backdropColor={backdropColor}
        />
      </Portal>

      <WaterModal
        visible={waterModalVisible}
        currentMl={todayTotal}
        goalMl={waterGoal}
        onAddWater={addWater}
        onRemoveWater={removeWater}
        onClose={() => setWaterModalVisible(false)}
      />

      <AddWeightModal
        visible={weightModalVisible}
        onClose={() => setWeightModalVisible(false)}
        onLogWeight={async (day, weightKg) => {
          await logWeight(day, weightKg);
        }}
      />
    </SafeAreaView>
  );
};

export default MyPathScreen;
