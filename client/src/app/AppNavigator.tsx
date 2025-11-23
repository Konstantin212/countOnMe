import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';

import { Ionicons } from '@expo/vector-icons';

import { RootTabParamList, MealsStackParamList, ProductsStackParamList } from './navigationTypes';
import MealBuilderScreen from '../screens/MealBuilderScreen';
import MealDetailsScreen from '../screens/MealDetailsScreen';
import MealsListScreen from '../screens/MealsListScreen';
import ProductFormScreen from '../screens/ProductFormScreen';
import ProductsListScreen from '../screens/ProductsListScreen';

enableScreens();

const Tab = createBottomTabNavigator<RootTabParamList>();
const ProductsStack = createNativeStackNavigator<ProductsStackParamList>();
const MealsStack = createNativeStackNavigator<MealsStackParamList>();

type TabName = keyof RootTabParamList;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<TabName, { focused: IoniconName; unfocused: IoniconName }> = {
  ProductsTab: { focused: 'basket', unfocused: 'basket-outline' },
  MealsTab: { focused: 'restaurant', unfocused: 'restaurant-outline' },
};

const ProductsStackNavigator = () => (
  <ProductsStack.Navigator>
    <ProductsStack.Screen
      name="ProductsList"
      component={ProductsListScreen}
      options={{ title: 'Products' }}
    />
    <ProductsStack.Screen
      name="ProductForm"
      component={ProductFormScreen}
      options={{ title: 'Product' }}
    />
  </ProductsStack.Navigator>
);

const MealsStackNavigator = () => (
  <MealsStack.Navigator>
    <MealsStack.Screen
      name="MealsList"
      component={MealsListScreen}
      options={{ title: 'Meals' }}
    />
    <MealsStack.Screen
      name="MealBuilder"
      component={MealBuilderScreen}
      options={{ title: 'Build Meal' }}
    />
    <MealsStack.Screen
      name="MealDetails"
      component={MealDetailsScreen}
      options={{ title: 'Meal Details' }}
    />
  </MealsStack.Navigator>
);

export const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const icons = TAB_ICONS[route.name as TabName];
        return {
          headerShown: false,
          tabBarActiveTintColor: '#111',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? icons.focused : icons.unfocused} color={color} size={size} />
          ),
        };
      }}
    >
      <Tab.Screen
        name="ProductsTab"
        component={ProductsStackNavigator}
        options={{ title: 'Products' }}
      />
      <Tab.Screen
        name="MealsTab"
        component={MealsStackNavigator}
        options={{ title: 'Meals' }}
      />
    </Tab.Navigator>
  );
};
