import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "@app/navigationTypes";
import { useAuth } from "@services/auth/AuthContext";
import { useTheme } from "@hooks/useTheme";
import { Button, Input } from "@particles";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const LoginScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSendLink = async () => {
    if (!isValidEmail) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signInWithEmail(email.trim());
      navigation.navigate("MagicLinkSent", { email: email.trim() });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send magic link";
      setError(message);
    } finally {
      setIsLoading(false);
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
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 40,
    },
    inputContainer: {
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
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Text style={styles.title}>CountOnMe</Text>
        <Text style={styles.subtitle}>
          Enter your email to sign in or create an account
        </Text>

        <View style={styles.inputContainer}>
          <Input
            testID="email-input"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          testID="send-magic-link-button"
          onPress={handleSendLink}
          disabled={!isValidEmail}
          loading={isLoading}
        >
          Send Magic Link
        </Button>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
