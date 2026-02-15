import {
  GoalCalculateRequest,
  GoalCalculateResponse,
  GoalCreateCalculatedRequest,
  GoalCreateManualRequest,
  UserGoal,
} from "@models/types";
import { apiFetch } from "./http";
import { parseNumeric } from "@services/utils/parsing";

// API response types (snake_case from backend)
// Note: Backend Decimal fields come as strings in JSON
type GoalApiResponse = {
  id: string;
  goal_type: string;
  gender?: string;
  birth_date?: string;
  height_cm?: string | number; // Decimal from backend
  current_weight_kg?: string | number; // Decimal from backend
  activity_level?: string;
  weight_goal_type?: string;
  target_weight_kg?: string | number; // Decimal from backend
  weight_change_pace?: string;
  bmr_kcal?: number;
  tdee_kcal?: number;
  daily_calories_kcal: number;
  protein_percent: number;
  carbs_percent: number;
  fat_percent: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  water_ml: number;
  healthy_weight_min_kg?: number;
  healthy_weight_max_kg?: number;
  current_bmi?: number;
  bmi_category?: string;
  created_at: string;
  updated_at: string;
};

type GoalCalculateApiResponse = {
  bmr_kcal: number;
  tdee_kcal: number;
  daily_calories_kcal: number;
  protein_percent: number;
  carbs_percent: number;
  fat_percent: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  water_ml: number;
  healthy_weight_min_kg: number;
  healthy_weight_max_kg: number;
  current_bmi: number;
  bmi_category: string;
};

// Transform API response to frontend type
const transformGoalResponse = (response: GoalApiResponse): UserGoal => ({
  id: response.id,
  goalType: response.goal_type as UserGoal["goalType"],
  gender: response.gender as UserGoal["gender"],
  birthDate: response.birth_date,
  heightCm: parseNumeric(response.height_cm),
  currentWeightKg: parseNumeric(response.current_weight_kg),
  activityLevel: response.activity_level as UserGoal["activityLevel"],
  weightGoalType: response.weight_goal_type as UserGoal["weightGoalType"],
  targetWeightKg: parseNumeric(response.target_weight_kg),
  weightChangePace: response.weight_change_pace as UserGoal["weightChangePace"],
  bmrKcal: response.bmr_kcal,
  tdeeKcal: response.tdee_kcal,
  dailyCaloriesKcal: response.daily_calories_kcal,
  proteinPercent: response.protein_percent,
  carbsPercent: response.carbs_percent,
  fatPercent: response.fat_percent,
  proteinGrams: response.protein_grams,
  carbsGrams: response.carbs_grams,
  fatGrams: response.fat_grams,
  waterMl: response.water_ml,
  healthyWeightMinKg: response.healthy_weight_min_kg,
  healthyWeightMaxKg: response.healthy_weight_max_kg,
  currentBmi: response.current_bmi,
  bmiCategory: response.bmi_category as UserGoal["bmiCategory"],
  createdAt: response.created_at,
  updatedAt: response.updated_at,
});

const transformCalculateResponse = (
  response: GoalCalculateApiResponse,
): GoalCalculateResponse => ({
  bmrKcal: response.bmr_kcal,
  tdeeKcal: response.tdee_kcal,
  dailyCaloriesKcal: response.daily_calories_kcal,
  proteinPercent: response.protein_percent,
  carbsPercent: response.carbs_percent,
  fatPercent: response.fat_percent,
  proteinGrams: response.protein_grams,
  carbsGrams: response.carbs_grams,
  fatGrams: response.fat_grams,
  waterMl: response.water_ml,
  healthyWeightMinKg: response.healthy_weight_min_kg,
  healthyWeightMaxKg: response.healthy_weight_max_kg,
  currentBmi: response.current_bmi,
  bmiCategory: response.bmi_category,
});

/**
 * Calculate goal preview (BMR/TDEE/targets) without saving.
 */
export const calculateGoal = async (
  request: GoalCalculateRequest,
): Promise<GoalCalculateResponse> => {
  const body = {
    gender: request.gender,
    birth_date: request.birthDate,
    height_cm: request.heightCm,
    current_weight_kg: request.currentWeightKg,
    activity_level: request.activityLevel,
    weight_goal_type: request.weightGoalType,
    target_weight_kg: request.targetWeightKg,
    weight_change_pace: request.weightChangePace,
  };

  const response = await apiFetch<GoalCalculateApiResponse>(
    "/v1/goals/calculate",
    {
      method: "POST",
      body,
    },
  );

  return transformCalculateResponse(response);
};

/**
 * Get the current active goal for this device.
 */
export const getCurrentGoal = async (): Promise<UserGoal | null> => {
  const response = await apiFetch<GoalApiResponse | null>("/v1/goals/current");
  return response ? transformGoalResponse(response) : null;
};

/**
 * Get a specific goal by ID.
 */
export const getGoal = async (goalId: string): Promise<UserGoal> => {
  const response = await apiFetch<GoalApiResponse>(`/v1/goals/${goalId}`);
  return transformGoalResponse(response);
};

/**
 * Create a calculated goal from body metrics.
 */
export const createCalculatedGoal = async (
  request: GoalCreateCalculatedRequest,
): Promise<UserGoal> => {
  const body = {
    id: request.id,
    gender: request.gender,
    birth_date: request.birthDate,
    height_cm: request.heightCm,
    current_weight_kg: request.currentWeightKg,
    activity_level: request.activityLevel,
    weight_goal_type: request.weightGoalType,
    target_weight_kg: request.targetWeightKg,
    weight_change_pace: request.weightChangePace,
    protein_percent: request.proteinPercent,
    carbs_percent: request.carbsPercent,
    fat_percent: request.fatPercent,
    water_ml: request.waterMl,
  };

  const response = await apiFetch<GoalApiResponse>("/v1/goals/calculated", {
    method: "POST",
    body,
  });

  return transformGoalResponse(response);
};

/**
 * Create a manual goal with direct calorie/macro input.
 */
export const createManualGoal = async (
  request: GoalCreateManualRequest,
): Promise<UserGoal> => {
  const body = {
    id: request.id,
    daily_calories_kcal: request.dailyCaloriesKcal,
    protein_percent: request.proteinPercent,
    carbs_percent: request.carbsPercent,
    fat_percent: request.fatPercent,
    water_ml: request.waterMl,
  };

  const response = await apiFetch<GoalApiResponse>("/v1/goals/manual", {
    method: "POST",
    body,
  });

  return transformGoalResponse(response);
};

/**
 * Update goal targets (macros and water).
 */
export const updateGoal = async (
  goalId: string,
  patch: {
    dailyCaloriesKcal?: number;
    proteinPercent?: number;
    carbsPercent?: number;
    fatPercent?: number;
    waterMl?: number;
  },
): Promise<UserGoal> => {
  const body = {
    daily_calories_kcal: patch.dailyCaloriesKcal,
    protein_percent: patch.proteinPercent,
    carbs_percent: patch.carbsPercent,
    fat_percent: patch.fatPercent,
    water_ml: patch.waterMl,
  };

  const response = await apiFetch<GoalApiResponse>(`/v1/goals/${goalId}`, {
    method: "PATCH",
    body,
  });

  return transformGoalResponse(response);
};

/**
 * Delete a goal.
 */
export const deleteGoal = async (goalId: string): Promise<void> => {
  await apiFetch<void>(`/v1/goals/${goalId}`, { method: "DELETE" });
};
