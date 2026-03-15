import React, { useCallback, useEffect, useRef } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  MyDayStackParamList,
  ProfileStackParamList,
} from "@app/navigationTypes";
import { useBarcodeLookup } from "@hooks/useBarcodeLookup";
import { useTheme } from "@hooks/useTheme";
import { logEvent } from "@services/analytics";

import LookupStatus from "./components/LookupStatus";
import ManualFallback from "./components/ManualFallback";
import ScannerOverlay from "./components/ScannerOverlay";

type MyDayProps = NativeStackScreenProps<MyDayStackParamList, "BarcodeScanner">;
type ProfileProps = NativeStackScreenProps<
  ProfileStackParamList,
  "BarcodeScanner"
>;
type Props = MyDayProps | ProfileProps;

const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"] as const;

const BarcodeScannerScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const { lookup, result, status, error, reset } = useBarcodeLookup();
  const hasNavigatedRef = useRef(false);

  // Reset navigation guard when screen regains focus (e.g., user navigates back from ProductConfirm)
  useFocusEffect(
    useCallback(() => {
      hasNavigatedRef.current = false;
      reset();
    }, [reset]),
  );

  useEffect(() => {
    logEvent("scanner_opened");
  }, []);

  useEffect(() => {
    if (permission && !permission.granted) {
      logEvent("permission_denied");
    }
  }, [permission]);

  useEffect(() => {
    if (status === "found" && result) {
      logEvent("lookup_succeeded", { source: result.source });
    } else if (status === "not_found") {
      logEvent("lookup_not_found");
    } else if (status === "error") {
      logEvent("lookup_failed");
    }
  }, [status, result]);

  useEffect(() => {
    if (status === "found" && result && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;

      // Both stacks have ProductConfirm with identical params, so either nav type works
      (navigation as MyDayProps["navigation"]).replace("ProductConfirm", {
        externalProduct: {
          code: result.code,
          name: result.name,
          brands: result.brands,
          caloriesPer100g: result.caloriesPer100g,
          proteinPer100g: result.proteinPer100g,
          carbsPer100g: result.carbsPer100g,
          fatPer100g: result.fatPer100g,
        },
      });
    }
  }, [status, result, navigation]);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (hasNavigatedRef.current || status === "loading") {
        return;
      }
      logEvent("barcode_scanned", { barcode: data });
      void lookup(data);
    },
    [lookup, status],
  );

  const handleRetry = useCallback(() => {
    reset();
  }, [reset]);

  const handleSearchByName = useCallback(() => {
    logEvent("user_continued_via_manual_fallback");
    navigation.goBack();
  }, [navigation]);

  const handleEnterManually = useCallback(() => {
    logEvent("user_continued_via_manual_fallback");
    (navigation as MyDayProps["navigation"]).navigate("ProductForm", {});
  }, [navigation]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const showManualFallback = status === "not_found" || status === "error";

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    permissionContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
      gap: 16,
    },
    permissionIcon: {
      marginBottom: 8,
    },
    permissionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    permissionText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    permissionButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 8,
      marginTop: 8,
    },
    permissionButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: "600",
    },
    backButton: {
      marginTop: 8,
    },
    backButtonText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: "500",
    },
    camera: {
      flex: 1,
    },
    headerOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      paddingTop: 52,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    headerBack: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.overlay,
      alignSelf: "flex-start",
    },
    bottomArea: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 40,
      backgroundColor: colors.overlay,
    },
  });

  // Still loading permission state
  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.permissionContainer} />
      </SafeAreaView>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.permissionContainer}>
          <Ionicons
            name="camera-outline"
            size={64}
            color={colors.textSecondary}
            style={styles.permissionIcon}
          />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            CountOnMe needs camera access to scan barcodes and look up product
            nutrition information.
          </Text>
          {permission.canAskAgain ? (
            <Pressable
              style={styles.permissionButton}
              onPress={requestPermission}
              testID="grant-permission-btn"
            >
              <Text style={styles.permissionButtonText}>Allow Camera</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.permissionButton}
              onPress={handleOpenSettings}
              testID="open-settings-btn"
            >
              <Text style={styles.permissionButtonText}>Open Settings</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.backButton}
            onPress={handleGoBack}
            testID="permission-back-btn"
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Camera view
  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [...BARCODE_TYPES],
        }}
        onBarcodeScanned={handleBarcodeScanned}
        testID="camera-view"
      />
      <ScannerOverlay />
      <View style={styles.headerOverlay}>
        <Pressable
          style={styles.headerBack}
          onPress={handleGoBack}
          testID="scanner-back-btn"
        >
          {/* White is intentional on camera overlay — theme tokens don't guarantee contrast on live camera feed */}
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.bottomArea}>
        <LookupStatus status={status} error={error} onRetry={handleRetry} />
        <ManualFallback
          onSearchByName={handleSearchByName}
          onEnterManually={handleEnterManually}
          visible={showManualFallback}
        />
      </View>
    </View>
  );
};

export default BarcodeScannerScreen;
