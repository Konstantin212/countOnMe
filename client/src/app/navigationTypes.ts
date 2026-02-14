import { NavigatorScreenParams } from "@react-navigation/native";
import {
  GoalCalculateRequest,
  GoalCalculateResponse,
  MealTypeKey,
} from "@models/types";

export type MyDayStackParamList = {
  MyDay: undefined;
  AddMeal: undefined;
  SelectProduct: undefined;
  AddFood: { productId: string };
  MealTypeEntries: { mealType: MealTypeKey };
  ProductForm: { productId?: string } | undefined;
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
  // Goal screens
  GoalSetup: undefined;
  GoalCalculated: undefined;
  GoalCalculatedResult: {
    calculation: GoalCalculateResponse;
    inputs: GoalCalculateRequest;
  };
  GoalManual: undefined;
};

export type RootTabParamList = {
  MyDayTab: NavigatorScreenParams<MyDayStackParamList>;
  MyPathTab: NavigatorScreenParams<MyPathStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};
