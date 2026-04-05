import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@hooks/useTheme";
import { useFasting } from "@hooks/useFasting";
import { NumericInput, Button } from "@particles";
import type { MyPathStackParamList } from "@app/navigationTypes";
import type { FastingTechnique } from "@models/types";

type NavigationProp = NativeStackNavigationProp<
  MyPathStackParamList,
  "FastingSetup"
>;

type TechniqueOption = {
  technique: FastingTechnique;
  title: string;
  description: string;
  badge?: string;
  hours: number;
};

const TECHNIQUE_OPTIONS: TechniqueOption[] = [
  {
    technique: "16:8",
    title: "16:8",
    description: "16 hours fasting, 8 hours eating",
    badge: "Popular",
    hours: 16,
  },
  {
    technique: "18:6",
    title: "18:6",
    description: "18 hours fasting, 6 hours eating",
    badge: "Intermediate",
    hours: 18,
  },
  {
    technique: "20:4",
    title: "20:4",
    description: "20 hours fasting, 4 hours eating",
    badge: "Advanced",
    hours: 20,
  },
];

const MIN_CUSTOM_HOURS = 1;
const MAX_CUSTOM_HOURS = 72;

const FastingSetupScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { startSession, loading } = useFasting();

  const [selectedTechnique, setSelectedTechnique] =
    useState<FastingTechnique>("16:8");
  const [customHours, setCustomHours] = useState<number | undefined>(undefined);

  const handleCustomHoursChange = (value: number | undefined): void => {
    setCustomHours(value !== undefined ? Math.floor(value) : undefined);
  };
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const isCustom = selectedTechnique === "custom";
  const isCustomValid =
    customHours !== undefined &&
    customHours >= MIN_CUSTOM_HOURS &&
    customHours <= MAX_CUSTOM_HOURS;
  const isStartDisabled = isStarting || loading || (isCustom && !isCustomValid);

  const handleSelectTechnique = (technique: FastingTechnique) => {
    setSelectedTechnique(technique);
  };

  const handleStartFast = async () => {
    setIsStarting(true);
    setStartError(null);
    try {
      const hours = isCustom
        ? (customHours ?? 16)
        : (TECHNIQUE_OPTIONS.find((o) => o.technique === selectedTechnique)
            ?.hours ?? 16);

      const session = await startSession(selectedTechnique, hours);
      navigation.navigate("FastingScreen", { sessionId: session.id });
    } catch {
      setStartError("Failed to start fasting session. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      padding: 4,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    scrollContent: {
      padding: 16,
      gap: 16,
      paddingBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    techniqueCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      backgroundColor: colors.cardBackground,
    },
    techniqueCardSelected: {
      borderColor: colors.fastingAccent,
      backgroundColor: colors.fastingBg,
    },
    techniqueCardUnselected: {
      borderColor: colors.border,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    radioOuterSelected: {
      borderColor: colors.fastingAccent,
    },
    radioOuterUnselected: {
      borderColor: colors.borderLight,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.fastingAccent,
    },
    techniqueInfo: {
      flex: 1,
    },
    techniqueTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    techniqueDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: colors.fastingAccent,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textInverse,
    },
    customSection: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      backgroundColor: colors.cardBackground,
    },
    customSectionSelected: {
      borderColor: colors.fastingAccent,
      backgroundColor: colors.fastingBg,
    },
    customSectionUnselected: {
      borderColor: colors.border,
    },
    customHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    customLabel: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    customInputContainer: {
      marginTop: 12,
    },
    customHint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    startButton: {
      marginTop: 8,
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      textAlign: "center",
      marginBottom: 4,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          testID="back-button"
          onPress={handleGoBack}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Start Fast</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Choose Your Fast</Text>
        <Text style={styles.subtitle}>
          Select an intermittent fasting schedule that fits your lifestyle.
        </Text>

        {TECHNIQUE_OPTIONS.map((option) => {
          const isSelected = selectedTechnique === option.technique;
          return (
            <Pressable
              key={option.technique}
              testID={`technique-${option.technique}`}
              style={[
                styles.techniqueCard,
                isSelected
                  ? styles.techniqueCardSelected
                  : styles.techniqueCardUnselected,
              ]}
              onPress={() => handleSelectTechnique(option.technique)}
            >
              <View
                style={[
                  styles.radioOuter,
                  isSelected
                    ? styles.radioOuterSelected
                    : styles.radioOuterUnselected,
                ]}
              >
                {isSelected && <View style={styles.radioInner} />}
              </View>
              <View style={styles.techniqueInfo}>
                <Text style={styles.techniqueTitle}>{option.title}</Text>
                <Text style={styles.techniqueDescription}>
                  {option.description}
                </Text>
              </View>
              {option.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{option.badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}

        <Pressable
          testID="technique-custom"
          style={[
            styles.customSection,
            isCustom
              ? styles.customSectionSelected
              : styles.customSectionUnselected,
          ]}
          onPress={() => handleSelectTechnique("custom")}
        >
          <View style={styles.customHeader}>
            <View
              style={[
                styles.radioOuter,
                isCustom
                  ? styles.radioOuterSelected
                  : styles.radioOuterUnselected,
              ]}
            >
              {isCustom && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.customLabel}>Custom</Text>
          </View>
          {isCustom && (
            <View style={styles.customInputContainer}>
              <NumericInput
                testID="custom-hours-input"
                label="Fasting hours"
                value={customHours}
                onChangeValue={handleCustomHoursChange}
                placeholder="e.g. 14"
              />
              <Text style={styles.customHint}>
                Enter between {MIN_CUSTOM_HOURS} and {MAX_CUSTOM_HOURS} hours
              </Text>
            </View>
          )}
        </Pressable>

        <View style={styles.startButton}>
          {startError && (
            <Text testID="start-error-text" style={styles.errorText}>
              {startError}
            </Text>
          )}
          <Button
            testID="start-fast-button"
            onPress={handleStartFast}
            disabled={isStartDisabled}
            loading={isStarting}
          >
            Start Fast
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default FastingSetupScreen;
