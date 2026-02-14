import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GoalCalculateRequest,
  GoalCalculateResponse,
  GoalCreateCalculatedRequest,
  GoalCreateManualRequest,
  UserGoal,
} from "@models/types";
import * as goalsApi from "./goals";

vi.mock("./http", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("./http");

describe("goals API wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGoalApiResponse = {
    id: "goal-1",
    goal_type: "calculated",
    gender: "male",
    birth_date: "1990-01-01",
    height_cm: 180,
    current_weight_kg: 80,
    activity_level: "moderate",
    weight_goal_type: "lose",
    target_weight_kg: 75,
    weight_change_pace: "moderate",
    bmr_kcal: 1800,
    tdee_kcal: 2500,
    daily_calories_kcal: 2200,
    protein_percent: 30,
    carbs_percent: 40,
    fat_percent: 30,
    protein_grams: 165,
    carbs_grams: 220,
    fat_grams: 73,
    water_ml: 2500,
    healthy_weight_min_kg: 65,
    healthy_weight_max_kg: 85,
    current_bmi: 24.7,
    bmi_category: "normal",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const expectedTransformedGoal: UserGoal = {
    id: "goal-1",
    goalType: "calculated",
    gender: "male",
    birthDate: "1990-01-01",
    heightCm: 180,
    currentWeightKg: 80,
    activityLevel: "moderate",
    weightGoalType: "lose",
    targetWeightKg: 75,
    weightChangePace: "moderate",
    bmrKcal: 1800,
    tdeeKcal: 2500,
    dailyCaloriesKcal: 2200,
    proteinPercent: 30,
    carbsPercent: 40,
    fatPercent: 30,
    proteinGrams: 165,
    carbsGrams: 220,
    fatGrams: 73,
    waterMl: 2500,
    healthyWeightMinKg: 65,
    healthyWeightMaxKg: 85,
    currentBmi: 24.7,
    bmiCategory: "normal",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };

  const mockCalculateApiResponse = {
    bmr_kcal: 1800,
    tdee_kcal: 2500,
    daily_calories_kcal: 2200,
    protein_percent: 30,
    carbs_percent: 40,
    fat_percent: 30,
    protein_grams: 165,
    carbs_grams: 220,
    fat_grams: 73,
    water_ml: 2500,
    healthy_weight_min_kg: 65,
    healthy_weight_max_kg: 85,
    current_bmi: 24.7,
    bmi_category: "normal",
  };

  const expectedTransformedCalculate: GoalCalculateResponse = {
    bmrKcal: 1800,
    tdeeKcal: 2500,
    dailyCaloriesKcal: 2200,
    proteinPercent: 30,
    carbsPercent: 40,
    fatPercent: 30,
    proteinGrams: 165,
    carbsGrams: 220,
    fatGrams: 73,
    waterMl: 2500,
    healthyWeightMinKg: 65,
    healthyWeightMaxKg: 85,
    currentBmi: 24.7,
    bmiCategory: "normal",
  };

  describe("calculateGoal", () => {
    it("sends correct request body with snake_case and returns transformed response", async () => {
      vi.mocked(apiFetch).mockResolvedValue(mockCalculateApiResponse);

      const request: GoalCalculateRequest = {
        gender: "male",
        birthDate: "1990-01-01",
        heightCm: 180,
        currentWeightKg: 80,
        activityLevel: "moderate",
        weightGoalType: "lose",
        targetWeightKg: 75,
        weightChangePace: "moderate",
      };

      const result = await goalsApi.calculateGoal(request);

      expect(apiFetch).toHaveBeenCalledWith("/v1/goals/calculate", {
        method: "POST",
        body: {
          gender: "male",
          birth_date: "1990-01-01",
          height_cm: 180,
          current_weight_kg: 80,
          activity_level: "moderate",
          weight_goal_type: "lose",
          target_weight_kg: 75,
          weight_change_pace: "moderate",
        },
      });
      expect(result).toEqual(expectedTransformedCalculate);
    });
  });

  describe("getCurrentGoal", () => {
    it("returns transformed goal when goal exists", async () => {
      vi.mocked(apiFetch).mockResolvedValue(mockGoalApiResponse);

      const result = await goalsApi.getCurrentGoal();

      expect(apiFetch).toHaveBeenCalledWith("/v1/goals/current");
      expect(result).toEqual(expectedTransformedGoal);
    });

    it("returns null when no goal exists", async () => {
      vi.mocked(apiFetch).mockResolvedValue(null);

      const result = await goalsApi.getCurrentGoal();

      expect(apiFetch).toHaveBeenCalledWith("/v1/goals/current");
      expect(result).toBeNull();
    });
  });

  describe("getGoal", () => {
    it("fetches goal by ID and returns transformed response", async () => {
      vi.mocked(apiFetch).mockResolvedValue(mockGoalApiResponse);

      const result = await goalsApi.getGoal("goal-1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/goals/goal-1");
      expect(result).toEqual(expectedTransformedGoal);
    });
  });

  describe("createCalculatedGoal", () => {
    it("sends correct request body with snake_case and returns transformed response", async () => {
      vi.mocked(apiFetch).mockResolvedValue(mockGoalApiResponse);

      const request: GoalCreateCalculatedRequest = {
        id: "goal-1",
        gender: "male",
        birthDate: "1990-01-01",
        heightCm: 180,
        currentWeightKg: 80,
        activityLevel: "moderate",
        weightGoalType: "lose",
        targetWeightKg: 75,
        weightChangePace: "moderate",
        proteinPercent: 30,
        carbsPercent: 40,
        fatPercent: 30,
        waterMl: 2500,
      };

      const result = await goalsApi.createCalculatedGoal(request);

      expect(apiFetch).toHaveBeenCalledWith("/v1/goals/calculated", {
        method: "POST",
        body: {
          id: "goal-1",
          gender: "male",
          birth_date: "1990-01-01",
          height_cm: 180,
          current_weight_kg: 80,
          activity_level: "moderate",
          weight_goal_type: "lose",
          target_weight_kg: 75,
          weight_change_pace: "moderate",
          protein_percent: 30,
          carbs_percent: 40,
          fat_percent: 30,
          water_ml: 2500,
        },
      });
      expect(result).toEqual(expectedTransformedGoal);
    });
  });

  describe("createManualGoal", () => {
    it("sends correct request body with snake_case and returns transformed response", async () => {
      const manualGoalResponse = {
        ...mockGoalApiResponse,
        goal_type: "manual",
        gender: undefined,
        birth_date: undefined,
        height_cm: undefined,
        current_weight_kg: undefined,
        activity_level: undefined,
        weight_goal_type: undefined,
        target_weight_kg: undefined,
        weight_change_pace: undefined,
        bmr_kcal: undefined,
        tdee_kcal: undefined,
      };
      vi.mocked(apiFetch).mockResolvedValue(manualGoalResponse);

      const request: GoalCreateManualRequest = {
        id: "goal-1",
        dailyCaloriesKcal: 2200,
        proteinPercent: 30,
        carbsPercent: 40,
        fatPercent: 30,
        waterMl: 2500,
      };

      const result = await goalsApi.createManualGoal(request);

      expect(apiFetch).toHaveBeenCalledWith("/v1/goals/manual", {
        method: "POST",
        body: {
          id: "goal-1",
          daily_calories_kcal: 2200,
          protein_percent: 30,
          carbs_percent: 40,
          fat_percent: 30,
          water_ml: 2500,
        },
      });
      expect(result.goalType).toBe("manual");
      expect(result.dailyCaloriesKcal).toBe(2200);
    });
  });

  describe("updateGoal", () => {
    it("sends PATCH with snake_case and returns transformed response", async () => {
      vi.mocked(apiFetch).mockResolvedValue(mockGoalApiResponse);

      const result = await goalsApi.updateGoal("goal-1", {
        dailyCaloriesKcal: 2000,
        proteinPercent: 35,
      });

      expect(apiFetch).toHaveBeenCalledWith("/v1/goals/goal-1", {
        method: "PATCH",
        body: {
          daily_calories_kcal: 2000,
          protein_percent: 35,
          carbs_percent: undefined,
          fat_percent: undefined,
          water_ml: undefined,
        },
      });
      expect(result).toEqual(expectedTransformedGoal);
    });
  });

  describe("deleteGoal", () => {
    it("sends DELETE request", async () => {
      vi.mocked(apiFetch).mockResolvedValue(undefined);

      await goalsApi.deleteGoal("goal-1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/goals/goal-1", {
        method: "DELETE",
      });
    });
  });
});
