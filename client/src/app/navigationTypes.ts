import { NavigatorScreenParams } from '@react-navigation/native';

export type MyDayStackParamList = {
  MyDay: undefined;
  AddMeal: undefined;
  SelectProduct: undefined;
  AddFood: { productId: string };
};

export type MyPathStackParamList = {
  MyPath: undefined;
};

export type ProfileStackParamList = {
  ProfileMenu: undefined;
  ProductsList: undefined;
  ProductDetails: { productId: string };
  ProductForm: { productId?: string } | undefined;
  ProductSearch: undefined;
  ProductConfirm: {
    externalProduct: {
      code: string;
      name: string;
      brands?: string;
      caloriesPer100g: number;
      proteinPer100g?: number;
      carbsPer100g?: number;
      fatPer100g?: number;
    };
  };
  MealsList: undefined;
  MealBuilder: { mealId?: string } | undefined;
  MealDetails: { mealId: string };
};

export type RootTabParamList = {
  MyDayTab: NavigatorScreenParams<MyDayStackParamList>;
  MyPathTab: NavigatorScreenParams<MyPathStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

