export type ProductsStackParamList = {
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
};

export type MealsStackParamList = {
  MealsList: undefined;
  MealBuilder: { mealId?: string } | undefined;
  MealDetails: { mealId: string };
};

export type RootTabParamList = {
  ProductsTab: undefined;
  MealsTab: undefined;
};

