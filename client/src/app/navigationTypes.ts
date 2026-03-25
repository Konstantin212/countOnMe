import { NavigatorScreenParams } from "@react-navigation/native";
import { CatalogPortionData } from "@hooks/useBarcodeLookup";
import {
  GoalCalculateRequest,
  GoalCalculateResponse,
  MealTypeKey,
} from "@models/types";

export type ProductFormParams = { productId?: string } | undefined;

export type ExternalProductParam = {
  code: string;
  name: string;
  brands?: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  catalogProductId?: string;
  catalogPortions?: CatalogPortionData[];
};

export type MyDayStackParamList = {
  MyDay: undefined;
  AddMeal: { mealType?: MealTypeKey } | undefined;
  SelectProduct: undefined;
  AddFood: { productId: string };
  MealTypeEntries: { mealType: MealTypeKey };
  ProductForm: ProductFormParams;
  BarcodeScanner: undefined;
  ProductConfirm: {
    externalProduct: ExternalProductParam;
  };
};

export type MyPathStackParamList = {
  MyPath: undefined;
};

export type ProfileStackParamList = {
  ProfileMenu: undefined;
  ProductsList: undefined;
  ProductDetails: { productId: string };
  ProductForm: ProductFormParams;
  ProductSearch: undefined;
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
