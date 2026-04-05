import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";

import { Ionicons } from "@expo/vector-icons";

import {
  RootTabParamList,
  MyDayStackParamList,
  MyPathStackParamList,
  DiscoverStackParamList,
  ProfileStackParamList,
  AuthStackParamList,
} from "./navigationTypes";
import { useAuth } from "@services/auth/AuthContext";
import LoginScreen from "@screens/AuthFlow/LoginScreen";
import MagicLinkSentScreen from "@screens/AuthFlow/MagicLinkSentScreen";
import AccountScreen from "@screens/ProfileFlow/AccountScreen";
import GoalCalculatedResultScreen from "@screens/GoalFlow/GoalCalculatedResultScreen";
import GoalCalculatedScreen from "@screens/GoalFlow/GoalCalculatedScreen";
import GoalManualScreen from "@screens/GoalFlow/GoalManualScreen";
import GoalSetupScreen from "@screens/GoalFlow/GoalSetupScreen";
import MealBuilderScreen from "@screens/MealFlow/MealBuilderScreen";
import MealDetailsScreen from "@screens/MealFlow/MealDetailsScreen";
import MealsListScreen from "@screens/MealFlow/MealsListScreen";
import MyDayScreen from "@screens/MyDayScreen";
import MyPathScreen from "@screens/MyPath/MyPathScreen";
import ProductConfirmScreen from "@screens/ProductFlow/ProductConfirmScreen";
import ProductDetailsScreen from "@screens/ProductFlow/ProductDetailsScreen";
import ProductFormScreen from "@screens/ProductFlow/ProductFormScreen";
import ProductSearchScreen from "@screens/ProductFlow/ProductSearchScreen";
import ProductsListScreen from "@screens/ProductFlow/ProductsListScreen";
import ProfileScreen from "@screens/ProfileScreen";
import { useTheme } from "@hooks/useTheme";
import AddMealScreen from "@screens/AddMealFlow/components/AddMeal";
import SelectProductScreen from "@screens/AddMealFlow/components/SelectProduct";
import AddFoodScreen from "@screens/AddMealFlow/components/AddFood";
import MealTypeEntriesScreen from "@screens/MealFlow/MealTypeEntriesScreen";
import BarcodeScannerScreen from "@screens/BarcodeFlow/BarcodeScannerScreen";
import FastingSetupScreen from "@screens/FastingFlow/FastingSetupScreen";
import FastingScreen from "@screens/FastingFlow/FastingScreen";
import { DraftMealProvider } from "@screens/AddMealFlow/context";
import { DatabaseProvider } from "@storage/DatabaseProvider";
import DiscoverHomeScreen from "@screens/DiscoverFlow/DiscoverHomeScreen";
import SharedFoodDetailScreen from "@screens/DiscoverFlow/SharedFoodDetailScreen";
import MySharedFoodsScreen from "@screens/DiscoverFlow/MySharedFoodsScreen";
import PublishFoodScreen from "@screens/DiscoverFlow/PublishFoodScreen";

enableScreens();

const Tab = createBottomTabNavigator<RootTabParamList>();
const MyDayStack = createNativeStackNavigator<MyDayStackParamList>();
const MyPathStack = createNativeStackNavigator<MyPathStackParamList>();
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

type TabName = keyof RootTabParamList;
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<
  TabName,
  { focused: IoniconName; unfocused: IoniconName }
> = {
  MyDayTab: { focused: "calendar", unfocused: "calendar-outline" },
  MyPathTab: { focused: "trending-up", unfocused: "trending-up-outline" },
  DiscoverTab: { focused: "search", unfocused: "search-outline" },
  ProfileTab: { focused: "person", unfocused: "person-outline" },
};

const ProfileStackNavigator = () => {
  const { colors } = useTheme();

  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ProfileStack.Screen
        name="ProfileMenu"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: "Account" }}
      />
      <ProfileStack.Screen
        name="ProductsList"
        component={ProductsListScreen}
        options={{ title: "My Products" }}
      />
      <ProfileStack.Screen
        name="ProductDetails"
        component={ProductDetailsScreen}
        options={{ title: "Product Details" }}
      />
      <ProfileStack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={{ title: "Product" }}
      />
      <ProfileStack.Screen
        name="ProductSearch"
        component={ProductSearchScreen}
        options={{ title: "Add Product" }}
      />
      <ProfileStack.Screen
        name="MealsList"
        component={MealsListScreen}
        options={{ title: "My Meals" }}
      />
      <ProfileStack.Screen
        name="MealBuilder"
        component={MealBuilderScreen}
        options={{ title: "Build Meal" }}
      />
      <ProfileStack.Screen
        name="MealDetails"
        component={MealDetailsScreen}
        options={{ title: "Meal Details" }}
      />
      <ProfileStack.Screen
        name="GoalSetup"
        component={GoalSetupScreen}
        options={{ title: "My Goal" }}
      />
      <ProfileStack.Screen
        name="GoalCalculated"
        component={GoalCalculatedScreen}
        options={{ title: "Calculate Goal" }}
      />
      <ProfileStack.Screen
        name="GoalCalculatedResult"
        component={GoalCalculatedResultScreen}
        options={{ title: "Your Goal" }}
      />
      <ProfileStack.Screen
        name="GoalManual"
        component={GoalManualScreen}
        options={{ title: "Set Goal Manually" }}
      />
    </ProfileStack.Navigator>
  );
};

const MyDayStackNavigator = () => {
  const { colors } = useTheme();
  return (
    <DraftMealProvider>
      <MyDayStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <MyDayStack.Screen
          name="MyDay"
          component={MyDayScreen}
          options={{ headerShown: false }}
        />
        <MyDayStack.Screen name="AddMeal" component={AddMealScreen} />
        <MyDayStack.Screen
          name="SelectProduct"
          component={SelectProductScreen}
        />
        <MyDayStack.Screen name="AddFood" component={AddFoodScreen} />
        <MyDayStack.Screen
          name="MealTypeEntries"
          component={MealTypeEntriesScreen}
        />
        <MyDayStack.Screen name="ProductForm" component={ProductFormScreen} />
        <MyDayStack.Screen
          name="BarcodeScanner"
          component={BarcodeScannerScreen}
          options={{ title: "Scan Barcode", headerShown: false }}
        />
        <MyDayStack.Screen
          name="ProductConfirm"
          component={ProductConfirmScreen}
          options={{ title: "Confirm Product" }}
        />
      </MyDayStack.Navigator>
    </DraftMealProvider>
  );
};

const MyPathStackNavigator = () => {
  const { colors } = useTheme();
  return (
    <MyPathStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <MyPathStack.Screen
        name="MyPath"
        component={MyPathScreen}
        options={{ headerShown: false }}
      />
      <MyPathStack.Screen
        name="FastingSetup"
        component={FastingSetupScreen}
        options={{ title: "Start Fast", headerShown: false }}
      />
      <MyPathStack.Screen
        name="FastingScreen"
        component={FastingScreen}
        options={{ title: "Fasting", headerShown: false }}
      />
    </MyPathStack.Navigator>
  );
};

const DiscoverStackNavigator = () => {
  const { colors } = useTheme();
  return (
    <DiscoverStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <DiscoverStack.Screen
        name="DiscoverHome"
        component={DiscoverHomeScreen}
        options={{ headerShown: false }}
      />
      <DiscoverStack.Screen
        name="SharedFoodDetail"
        component={SharedFoodDetailScreen}
        options={{ title: "Food Details" }}
      />
      <DiscoverStack.Screen
        name="MySharedFoods"
        component={MySharedFoodsScreen}
        options={{ title: "My Shared Foods" }}
      />
      <DiscoverStack.Screen
        name="PublishFood"
        component={PublishFoodScreen}
        options={{ title: "Share Food" }}
      />
    </DiscoverStack.Navigator>
  );
};

const TabNavigator = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const icons = TAB_ICONS[route.name as TabName];
        return {
          headerShown: false,
          tabBarActiveTintColor: colors.tabBarActive,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? icons.focused : icons.unfocused}
              color={color}
              size={size}
            />
          ),
        };
      }}
    >
      <Tab.Screen
        name="MyDayTab"
        component={MyDayStackNavigator}
        options={{ title: "My Day" }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("MyDayTab", { screen: "MyDay" } as any);
          },
        })}
      />
      <Tab.Screen
        name="MyPathTab"
        component={MyPathStackNavigator}
        options={{ title: "My Path" }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("MyPathTab", { screen: "MyPath" } as any);
          },
        })}
      />
      <Tab.Screen
        name="DiscoverTab"
        component={DiscoverStackNavigator}
        options={{ title: "Discover" }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("DiscoverTab", {
              screen: "DiscoverHome",
            } as any);
          },
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ title: "Profile" }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("ProfileTab", { screen: "ProfileMenu" } as any);
          },
        })}
      />
    </Tab.Navigator>
  );
};

const AuthStackNavigator = () => {
  const { colors } = useTheme();

  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="MagicLinkSent" component={MagicLinkSentScreen} />
    </AuthStack.Navigator>
  );
};

export const AppNavigator = () => {
  const auth = useAuth();

  if (auth.status === "loading") {
    return null;
  }

  if (auth.status === "unauthenticated") {
    return <AuthStackNavigator />;
  }

  const userId = auth.user.id;

  return (
    <DatabaseProvider userId={userId}>
      <TabNavigator />
    </DatabaseProvider>
  );
};
