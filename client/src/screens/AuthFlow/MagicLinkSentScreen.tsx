import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { AuthStackParamList } from "@app/navigationTypes";
import { useAuth } from "@services/auth/AuthContext";
import { useTheme } from "@hooks/useTheme";
import { Button, Input } from "@particles";

type Props = NativeStackScreenProps<AuthStackParamList, "MagicLinkSent">;

const RESEND_COOLDOWN_SECONDS = 60;

const MagicLinkSentScreen = ({ route }: Props) => {
  const { email } = route.params;
  const { colors } = useTheme();
  const { signInWithEmail, verifyOtp } = useAuth();

  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startCooldown();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleResend = async () => {
    setIsResending(true);
    setError(null);

    try {
      await signInWithEmail(email);
      startCooldown();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to resend email";
      setError(message);
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.trim().length < 6) {
      setError("Please enter the 6-digit code from your email");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      await verifyOtp(email, code.trim());
      // Success transitions are handled by AuthContext (onAuthStateChange)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid or expired code";
      setError(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    iconContainer: {
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
      marginBottom: 12,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 8,
      lineHeight: 22,
    },
    emailText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.primary,
      textAlign: "center",
      marginBottom: 32,
    },
    resendContainer: {
      alignItems: "center",
      marginBottom: 24,
    },
    resendText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    resendButton: {
      marginTop: 8,
    },
    resendButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.primary,
    },
    resendDisabled: {
      color: colors.disabled,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      paddingHorizontal: 12,
      fontSize: 13,
      color: colors.textSecondary,
    },
    codeToggle: {
      alignItems: "center",
      marginBottom: 16,
    },
    codeToggleText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.primary,
    },
    codeSection: {
      marginBottom: 16,
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      textAlign: "center",
      marginBottom: 16,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.description}>We sent a magic link to</Text>
        <Text style={styles.emailText}>{email}</Text>

        {/* Resend */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>
            {cooldown > 0
              ? `Resend available in ${cooldown}s`
              : "Didn't receive it?"}
          </Text>
          <Pressable
            testID="resend-button"
            style={styles.resendButton}
            onPress={handleResend}
            disabled={cooldown > 0 || isResending}
          >
            <Text
              style={[
                styles.resendButtonText,
                (cooldown > 0 || isResending) && styles.resendDisabled,
              ]}
            >
              {isResending ? "Sending..." : "Resend email"}
            </Text>
          </Pressable>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Code entry toggle */}
        {!showCodeEntry && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              testID="show-code-entry-button"
              style={styles.codeToggle}
              onPress={() => setShowCodeEntry(true)}
            >
              <Text style={styles.codeToggleText}>Enter code manually</Text>
            </Pressable>
          </>
        )}

        {/* Code entry form */}
        {showCodeEntry && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>enter code from email</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.codeSection}>
              <Input
                testID="otp-code-input"
                label="6-digit code"
                placeholder="000000"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>

            <Button
              testID="verify-code-button"
              onPress={handleVerifyCode}
              disabled={code.trim().length < 6}
              loading={isVerifying}
            >
              Verify Code
            </Button>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

export default MagicLinkSentScreen;
