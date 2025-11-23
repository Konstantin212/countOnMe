export type ProductsStackParamList = {
  ProductsList: undefined;
  ProductForm: { productId?: string } | undefined;
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

