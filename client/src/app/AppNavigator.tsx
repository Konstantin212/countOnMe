import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';

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
    <Tab.Navigator screenOptions={{ headerShown: false }}>
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
