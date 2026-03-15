import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@hooks/useTheme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VIEWFINDER_SIZE = SCREEN_WIDTH * 0.7;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;

const ScannerOverlay = () => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    viewfinder: {
      width: VIEWFINDER_SIZE,
      height: VIEWFINDER_SIZE * 0.6,
      borderRadius: 12,
      overflow: "hidden",
    },
    cutout: {
      flex: 1,
      backgroundColor: "transparent",
    },
    cornerTopLeft: {
      position: "absolute",
      top: 0,
      left: 0,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      borderTopWidth: CORNER_THICKNESS,
      borderLeftWidth: CORNER_THICKNESS,
      borderColor: colors.primary,
      borderTopLeftRadius: 12,
    },
    cornerTopRight: {
      position: "absolute",
      top: 0,
      right: 0,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      borderTopWidth: CORNER_THICKNESS,
      borderRightWidth: CORNER_THICKNESS,
      borderColor: colors.primary,
      borderTopRightRadius: 12,
    },
    cornerBottomLeft: {
      position: "absolute",
      bottom: 0,
      left: 0,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      borderBottomWidth: CORNER_THICKNESS,
      borderLeftWidth: CORNER_THICKNESS,
      borderColor: colors.primary,
      borderBottomLeftRadius: 12,
    },
    cornerBottomRight: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      borderBottomWidth: CORNER_THICKNESS,
      borderRightWidth: CORNER_THICKNESS,
      borderColor: colors.primary,
      borderBottomRightRadius: 12,
    },
    hint: {
      marginTop: 24,
      fontSize: 16,
      fontWeight: "500",
      color: colors.textInverse,
      textAlign: "center",
    },
  });

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.viewfinder}>
        <View style={styles.cutout} />
        <View style={styles.cornerTopLeft} />
        <View style={styles.cornerTopRight} />
        <View style={styles.cornerBottomLeft} />
        <View style={styles.cornerBottomRight} />
      </View>
      <Text style={styles.hint}>Point camera at barcode</Text>
    </View>
  );
};

export default ScannerOverlay;
