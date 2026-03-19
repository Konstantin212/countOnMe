import { StyleSheet } from "react-native";

import { useTheme } from "@hooks/useTheme";

type ThemeColors = ReturnType<typeof useTheme>["colors"];

export const makeConfirmStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    backButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.cardBackground,
      marginRight: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    infoCard: {
      backgroundColor: colors.cardBackground,
      padding: 16,
      borderRadius: 8,
    },
    productName: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    productBrand: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    // Portion selector
    portionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    portionCard: {
      flex: 1,
      minWidth: 120,
      padding: 12,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
      alignItems: "center",
    },
    portionLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
      textAlign: "center",
    },
    portionCalories: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    // Amount input
    amountContainer: {
      gap: 12,
    },
    amountInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    amountHint: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
    },
    scaleButtons: {
      flexDirection: "row",
      gap: 8,
    },
    scaleButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
      alignItems: "center",
    },
    scaleButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    scaleButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    scaleButtonTextActive: {
      color: colors.buttonText,
    },

    // Nutrition cards
    nutritionCard: {
      backgroundColor: colors.successLight,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.success,
    },
    calculatedCard: {
      backgroundColor: colors.successLight,
      padding: 20,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.success,
    },
    referenceCard: {
      backgroundColor: colors.infoLight,
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nutrientRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    nutrientRowLast: {
      borderBottomWidth: 0,
    },
    nutrientLabel: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "500",
    },
    nutrientValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "600",
    },
    nutrientValueLarge: {
      fontSize: 24,
      color: colors.success,
      fontWeight: "700",
    },
    equivalentText: {
      fontSize: 13,
      color: colors.success,
      marginTop: 12,
      textAlign: "center",
      fontWeight: "500",
    },

    // Favourite toggle
    favouriteRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    favouriteText: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "500",
    },

    // Info box (fallback)
    infoBox: {
      margin: 16,
      padding: 16,
      backgroundColor: colors.warningLight,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    infoText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },

    // Footer
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    trackButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: "center",
    },
    trackButtonDisabled: {
      backgroundColor: colors.disabled,
    },
    trackButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: "600",
    },
  });
