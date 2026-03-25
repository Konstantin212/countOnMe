import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Svg, Path, Rect } from "react-native-svg";

import { useTheme } from "@hooks/useTheme";

const INTERVAL_MS = 100;
const INCREMENT_ML = 50;
const FILL_LERP_SPEED = 4;

const CARD_WIDTH = 300;
const CARD_HEIGHT = 400;

// Back wave — slower, broader swells
const BACK_WAVE_LAYERS = [
  { amplitude: 5, frequency: 0.06, speed: 1.8, phase: 0.5 },
  { amplitude: 3, frequency: 0.1, speed: -1.3, phase: 2.1 },
  { amplitude: 1.5, frequency: 0.16, speed: 2.0, phase: 3.5 },
];

// Front wave — faster, sharper ripples
const FRONT_WAVE_LAYERS = [
  { amplitude: 4, frequency: 0.08, speed: 2.5, phase: 0 },
  { amplitude: 2.5, frequency: 0.12, speed: -1.8, phase: 1.2 },
  { amplitude: 1.5, frequency: 0.18, speed: 3.2, phase: 2.8 },
  { amplitude: 1, frequency: 0.25, speed: -2.2, phase: 0.7 },
];

const BACK_WAVE_Y_OFFSET = -3;

type WaveLayer = {
  amplitude: number;
  frequency: number;
  speed: number;
  phase: number;
};

interface WaterModalProps {
  visible: boolean;
  currentMl: number;
  goalMl: number;
  onAddWater: (amountMl: number) => void;
  onRemoveWater: (amountMl: number) => void;
  onClose: () => void;
}

const compositeWave = (
  x: number,
  time: number,
  amplitudeScale: number,
  layers: WaveLayer[],
): number => {
  let y = 0;
  for (const layer of layers) {
    y +=
      layer.amplitude *
      amplitudeScale *
      Math.sin(layer.frequency * x + layer.speed * time + layer.phase);
  }
  return y;
};

const buildWavePath = (
  waterY: number,
  time: number,
  amplitudeScale: number,
  layers: WaveLayer[],
): string => {
  const steps = 50;
  const stepWidth = CARD_WIDTH / steps;

  let d = `M 0 ${CARD_HEIGHT}`;

  const y0 = waterY + compositeWave(0, time, amplitudeScale, layers);
  d += ` L 0 ${y0.toFixed(1)}`;

  for (let i = 1; i <= steps; i++) {
    const x = i * stepWidth;
    const y = waterY + compositeWave(x, time, amplitudeScale, layers);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  d += ` L ${CARD_WIDTH} ${CARD_HEIGHT}`;
  d += " Z";
  return d;
};

export const WaterModal = ({
  visible,
  currentMl,
  goalMl,
  onAddWater,
  onRemoveWater,
  onClose,
}: WaterModalProps) => {
  const { colors } = useTheme();
  const [pendingMl, setPendingMl] = useState(0);
  const [animState, setAnimState] = useState({ time: 0, displayFill: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const isActive = useRef(false);
  const modeRef = useRef<"add" | "remove">("add");
  const committedRef = useRef(false);
  const currentMlRef = useRef(currentMl);
  currentMlRef.current = currentMl;

  const effectiveMl = Math.max(0, currentMl + pendingMl);
  const targetFill = goalMl > 0 ? Math.min(effectiveMl / goalMl, 1) : 0;
  const targetFillRef = useRef(targetFill);
  targetFillRef.current = targetFill;

  const clearHoldInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Animation loop
  useEffect(() => {
    if (!visible) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let lastTime = Date.now();
    const displayFillRef = { current: targetFillRef.current };

    const animate = () => {
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const target = targetFillRef.current;
      const current = displayFillRef.current;
      const diff = target - current;
      displayFillRef.current =
        Math.abs(diff) < 0.001
          ? target
          : current + diff * Math.min(FILL_LERP_SPEED * dt, 1);

      setAnimState((prev) => ({
        time: prev.time + dt,
        displayFill: displayFillRef.current,
      }));

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [visible]);

  // Clear pending once parent reflects the change
  useEffect(() => {
    if (committedRef.current) {
      committedRef.current = false;
      pendingRef.current = 0;
      setPendingMl(0);
    }
  }, [currentMl]);

  useEffect(() => {
    return () => {
      clearHoldInterval();
    };
  }, [clearHoldInterval]);

  const startHold = useCallback((mode: "add" | "remove") => {
    pendingRef.current = 0;
    setPendingMl(0);
    isActive.current = true;
    modeRef.current = mode;

    intervalRef.current = setInterval(() => {
      const sign = modeRef.current === "add" ? 1 : -1;
      pendingRef.current += sign * INCREMENT_ML;
      if (
        modeRef.current === "remove" &&
        pendingRef.current < -currentMlRef.current
      ) {
        pendingRef.current = -currentMlRef.current;
      }
      setPendingMl(pendingRef.current);
    }, INTERVAL_MS);
  }, []);

  const endHold = useCallback(() => {
    clearHoldInterval();
    isActive.current = false;
    const amount = pendingRef.current;

    if (amount > 0) {
      committedRef.current = true;
      onAddWater(amount);
    } else if (amount < 0) {
      committedRef.current = true;
      onRemoveWater(Math.abs(amount));
    } else {
      pendingRef.current = 0;
      setPendingMl(0);
    }
  }, [clearHoldInterval, onAddWater, onRemoveWater]);

  // Wave fills card from bottom to top
  const waterY = CARD_HEIGHT * (1 - animState.displayFill);
  const amplitudeScale = isActive.current ? 2.2 : 1;

  const backWavePath = buildWavePath(
    waterY + BACK_WAVE_Y_OFFSET,
    animState.time,
    amplitudeScale,
    BACK_WAVE_LAYERS,
  );
  const frontWavePath = buildWavePath(
    waterY,
    animState.time,
    amplitudeScale,
    FRONT_WAVE_LAYERS,
  );

  const canRemove = currentMl > 0 || pendingMl < 0;
  const percentage = goalMl > 0 ? Math.round((effectiveMl / goalMl) * 100) : 0;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 24,
      overflow: "hidden",
    },
    waveBg: {
      position: "absolute",
      top: 0,
      left: 0,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    },
    content: {
      flex: 1,
      justifyContent: "space-between",
      padding: 20,
    },
    header: {
      alignItems: "center",
      gap: 4,
      zIndex: 1,
    },
    closeButton: {
      position: "absolute",
      top: 8,
      right: 8,
      padding: 4,
      zIndex: 10,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
    },
    mlText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    fillArea: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1,
    },
    percentText: {
      fontSize: 48,
      fontWeight: "800",
      color: colors.text,
      opacity: 0.15,
    },
    pendingText: {
      fontSize: 28,
      fontWeight: "800",
      minHeight: 36,
    },
    hint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    footer: {
      alignItems: "center",
      zIndex: 1,
    },
    undoButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 20,
      backgroundColor: colors.error,
      opacity: canRemove ? 1 : 0.3,
    },
    undoText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textInverse,
    },
  });

  return (
    <Modal
      testID="water-modal"
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Wave background fills the card */}
          <View style={styles.waveBg}>
            <Svg
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
            >
              {/* Unfilled area above the wave */}
              <Rect
                x="0"
                y="0"
                width={String(CARD_WIDTH)}
                height={String(waterY)}
                fill={colors.cardBackground}
              />
              {/* Filled area below the wave */}
              <Rect
                x="0"
                y={String(waterY)}
                width={String(CARD_WIDTH)}
                height={String(CARD_HEIGHT - waterY)}
                fill={colors.waterFillBg}
              />
              {/* Back wave */}
              <Path d={backWavePath} fill={colors.waterFillDeep} />
              {/* Front wave */}
              <Path d={frontWavePath} fill={colors.waterFill} />
            </Svg>
          </View>

          {/* Close button */}
          <Pressable
            testID="water-modal-close"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Water</Text>
              <Text style={styles.mlText}>
                {effectiveMl} / {goalMl} ml
              </Text>
            </View>

            {/* Tap-and-hold fill area */}
            <Pressable
              testID="water-fill-area"
              onPressIn={() => startHold("add")}
              onPressOut={endHold}
              style={styles.fillArea}
            >
              <Text style={styles.percentText}>{percentage}%</Text>
              {pendingMl !== 0 ? (
                <Text
                  style={[
                    styles.pendingText,
                    {
                      color: pendingMl > 0 ? colors.textInverse : colors.error,
                    },
                  ]}
                >
                  {pendingMl > 0 ? "+" : ""}
                  {pendingMl} ml
                </Text>
              ) : (
                <Text style={styles.pendingText}> </Text>
              )}
              <Text style={styles.hint}>Hold to add water</Text>
            </Pressable>

            <View style={styles.footer}>
              <Pressable
                testID="water-remove-button"
                onPressIn={() => canRemove && startHold("remove")}
                onPressOut={endHold}
                style={styles.undoButton}
                disabled={!canRemove}
              >
                <Ionicons
                  name="arrow-undo"
                  size={18}
                  color={colors.textInverse}
                />
                <Text style={styles.undoText}>Undo</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
