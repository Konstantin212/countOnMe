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
import MealBuilderScreen from '@screens/MealBuilderScreen';
import MealDetailsScreen from '@screens/MealDetailsScreen';
import MealsListScreen from '@screens/MealsListScreen';
import ProductFormScreen from '@screens/ProductFormScreen';
import ProductsListScreen from '@screens/ProductsListScreen';
import ProductSearchScreen from '@screens/ProductSearchScreen';
import ProductConfirmScreen from '@screens/ProductConfirmScreen';
import ProductDetailsScreen from '@screens/ProductDetailsScreen';
import MyDayScreen from '@screens/MyDayScreen';
import MyPathScreen from '@screens/MyPathScreen';
import ProfileScreen from '@screens/ProfileScreen';
import { useTheme } from '@hooks/useTheme';

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

const ProfileStackNavigator = () => (
  <ProfileStack.Navigator>
    <ProfileStack.Screen
      name="ProfileMenu"
      component={ProfileScreen}
      options={{ title: 'Profile' }}
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
  </ProfileStack.Navigator>
);

const MyDayStackNavigator = () => (
  <MyDayStack.Navigator>
    <MyDayStack.Screen name="MyDay" component={MyDayScreen} options={{ title: 'My Day' }} />
  </MyDayStack.Navigator>
);

const MyPathStackNavigator = () => (
  <MyPathStack.Navigator>
    <MyPathStack.Screen name="MyPath" component={MyPathScreen} options={{ title: 'My Path' }} />
  </MyPathStack.Navigator>
);

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
