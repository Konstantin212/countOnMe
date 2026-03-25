const path = require("path");
const dotenv = require("dotenv");

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

module.exports = {
  expo: {
    name: "CountOnMe",
    slug: "countonme",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    scheme: "countonme",
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission: "CountOnMe needs camera access to scan barcodes.",
        },
      ],
    ],
    extra: {
      // Pass env vars to the app
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000",
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
