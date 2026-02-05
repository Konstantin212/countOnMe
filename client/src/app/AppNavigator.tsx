import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';

import { Ionicons } from '@expo/vector-icons';

import {
  RootTabParamList,
  MyDayStackParamList,
  MyPathStackParamList,
  ProfileStackParamList,
} from './navigationTypes';
import GoalCalculatedResultScreen from '@screens/GoalCalculatedResultScreen';
import GoalCalculatedScreen from '@screens/GoalCalculatedScreen';
import GoalManualScreen from '@screens/GoalManualScreen';
import GoalSetupScreen from '@screens/GoalSetupScreen';
import MealBuilderScreen from '@screens/MealBuilderScreen';
import MealDetailsScreen from '@screens/MealDetailsScreen';
import MealsListScreen from '@screens/MealsListScreen';
import MyDayScreen from '@screens/MyDayScreen';
import MyPathScreen from '@screens/MyPathScreen';
import ProductConfirmScreen from '@screens/ProductConfirmScreen';
import ProductDetailsScreen from '@screens/ProductDetailsScreen';
import ProductFormScreen from '@screens/ProductFormScreen';
import ProductSearchScreen from '@screens/ProductSearchScreen';
import ProductsListScreen from '@screens/ProductsListScreen';
import ProfileScreen from '@screens/ProfileScreen';
import { useTheme } from '@hooks/useTheme';
import AddMealScreen from '@screens/AddMealFlow/components/AddMeal';
import SelectProductScreen from '@screens/AddMealFlow/components/SelectProduct';
import AddFoodScreen from '@screens/AddMealFlow/components/AddFood';
import MealTypeEntriesScreen from '@screens/MealTypeEntriesScreen';
import { DraftMealProvider } from '@screens/AddMealFlow/context';

enableScreens();

const Tab = createBottomTabNavigator<RootTabParamList>();
const MyDayStack = createNativeStackNavigator<MyDayStackParamList>();
const MyPathStack = createNativeStackNavigator<MyPathStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

type TabName = keyof RootTabParamList;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<TabName, { focused: IoniconName; unfocused: IoniconName }> = {
  MyDayTab: { focused: 'calendar', unfocused: 'calendar-outline' },
  MyPathTab: { focused: 'trending-up', unfocused: 'trending-up-outline' },
  ProfileTab: { focused: 'person', unfocused: 'person-outline' },
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
        name="ProductsList"
        component={ProductsListScreen}
        options={{ title: 'My Products' }}
      />
      <ProfileStack.Screen
        name="ProductDetails"
        component={ProductDetailsScreen}
        options={{ title: 'Product Details' }}
      />
      <ProfileStack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={{ title: 'Product' }}
      />
      <ProfileStack.Screen
        name="ProductSearch"
        component={ProductSearchScreen}
        options={{ title: 'Add Product' }}
      />
      <ProfileStack.Screen
        name="ProductConfirm"
        component={ProductConfirmScreen}
        options={{ title: 'Confirm Product' }}
      />
      <ProfileStack.Screen
        name="MealsList"
        component={MealsListScreen}
        options={{ title: 'My Meals' }}
      />
      <ProfileStack.Screen
        name="MealBuilder"
        component={MealBuilderScreen}
        options={{ title: 'Build Meal' }}
      />
      <ProfileStack.Screen
        name="MealDetails"
        component={MealDetailsScreen}
        options={{ title: 'Meal Details' }}
      />
      <ProfileStack.Screen
        name="GoalSetup"
        component={GoalSetupScreen}
        options={{ title: 'My Goal' }}
      />
      <ProfileStack.Screen
        name="GoalCalculated"
        component={GoalCalculatedScreen}
        options={{ title: 'Calculate Goal' }}
      />
      <ProfileStack.Screen
        name="GoalCalculatedResult"
        component={GoalCalculatedResultScreen}
        options={{ title: 'Your Goal' }}
      />
      <ProfileStack.Screen
        name="GoalManual"
        component={GoalManualScreen}
        options={{ title: 'Set Goal Manually' }}
      />
    </ProfileStack.Navigator>
  );
};

const MyDayStackNavigator = () => {
  const { colors } = useTheme();
  return (
    <DraftMealProvider>
      <MyDayStack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <MyDayStack.Screen name="MyDay" component={MyDayScreen} options={{ headerShown: false }} />
        <MyDayStack.Screen name="AddMeal" component={AddMealScreen} />
        <MyDayStack.Screen name="SelectProduct" component={SelectProductScreen} />
        <MyDayStack.Screen name="AddFood" component={AddFoodScreen} />
        <MyDayStack.Screen name="MealTypeEntries" component={MealTypeEntriesScreen} />
      </MyDayStack.Navigator>
    </DraftMealProvider>
  );
};

const MyPathStackNavigator = () => {
  const { colors } = useTheme();
  return (
    <MyPathStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <MyPathStack.Screen name="MyPath" component={MyPathScreen} options={{ headerShown: false }} />
    </MyPathStack.Navigator>
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
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? icons.focused : icons.unfocused} color={color} size={size} />
          ),
        };
      }}
    >
      <Tab.Screen
        name="MyDayTab"
        component={MyDayStackNavigator}
        options={{ title: 'My Day' }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('MyDayTab', { screen: 'MyDay' } as any);
          },
        })}
      />
      <Tab.Screen
        name="MyPathTab"
        component={MyPathStackNavigator}
        options={{ title: 'My Path' }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('MyPathTab', { screen: 'MyPath' } as any);
          },
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ title: 'Profile' }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('ProfileTab', { screen: 'ProfileMenu' } as any);
          },
        })}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return <TabNavigator />;
};
