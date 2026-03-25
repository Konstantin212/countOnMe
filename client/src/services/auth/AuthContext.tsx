import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "@services/supabase";
import { getOrCreateDeviceId, getDeviceToken } from "@storage/device";
import { linkDevice, deleteAccount as deleteAccountApi } from "./authApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthUser = {
  id: string;
  email: string | null;
};

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: AuthUser; accessToken: string };

type AuthContextValue = AuthState & {
  signInWithEmail: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Deep link URL parser
// ---------------------------------------------------------------------------

const extractTokensFromUrl = (
  url: string,
): { accessToken: string; refreshToken: string } | null => {
  try {
    // Supabase magic links put tokens in the hash fragment:
    // countonme://auth/callback#access_token=...&refresh_token=...&type=magiclink
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) {
      return null;
    }
    const fragment = url.substring(hashIndex + 1);
    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) {
      return { accessToken, refreshToken };
    }
    return null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Link-device helper (fires after sign-in)
// ---------------------------------------------------------------------------

const performLinkDevice = async (): Promise<void> => {
  try {
    const deviceId = await getOrCreateDeviceId();
    const legacyToken = await getDeviceToken();
    await linkDevice(deviceId, Platform.OS, legacyToken ?? undefined);
  } catch {
    // link-device failure is non-fatal; user is still authenticated
  }
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  // ------ Bootstrap: check existing session ------
  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setAuthState({
          status: "authenticated",
          user: { id: session.user.id, email: session.user.email ?? null },
          accessToken: session.access_token,
        });
      } else {
        setAuthState({ status: "unauthenticated" });
      }
    };
    bootstrap();
  }, []);

  // ------ Listen for auth state changes ------
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
        session?.user
      ) {
        setAuthState({
          status: "authenticated",
          user: { id: session.user.id, email: session.user.email ?? null },
          accessToken: session.access_token,
        });
        if (event === "SIGNED_IN") {
          await performLinkDevice();
        }
      } else if (event === "SIGNED_OUT") {
        setAuthState({ status: "unauthenticated" });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ------ Deep link handler for magic link callback ------
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const tokens = extractTokensFromUrl(event.url);
      if (tokens) {
        await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
      }
    };

    const subscription = Linking.addEventListener("url", handleUrl);

    return () => {
      subscription.remove();
    };
  }, []);

  // ------ Actions ------
  const signInWithEmail = useCallback(async (email: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: Linking.createURL("auth/callback"),
      },
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const verifyOtp = useCallback(
    async (email: string, token: string): Promise<void> => {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const deleteAccount = useCallback(async (): Promise<void> => {
    await deleteAccountApi();
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = {
    ...authState,
    signInWithEmail,
    verifyOtp,
    signOut,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export { extractTokensFromUrl };
