import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BodyWeightEntry,
  ConsistencyResult,
  DailyStatsPoint,
  EfficiencyResult,
  EtaProjection,
  StatsPeriod,
  UserGoal,
  WeightTrend,
} from "@models/types";
import {
  calculateConsistency,
  calculateEfficiency,
  calculateETA,
  calculateMacroAdherence,
  calculateStreak,
  calculateWeightDelta,
  calculateWeightTrend,
  deriveGoalPace,
  getDateRange,
} from "./insights";

describe("insights utility", () => {
  describe("getDateRange", () => {
    it("returns last 7 days including today for 7d period", () => {
      const result = getDateRange("7d", "2025-06-15");
      expect(result).toEqual({
        from: "2025-06-09",
        to: "2025-06-15",
      });
    });

    it("returns last 30 days including today for 30d period", () => {
      const result = getDateRange("30d", "2025-06-15");
      expect(result).toEqual({
        from: "2025-05-17",
        to: "2025-06-15",
      });
    });

    it("returns last 90 days including today for 90d period", () => {
      const result = getDateRange("90d", "2025-06-15");
      expect(result).toEqual({
        from: "2025-03-18",
        to: "2025-06-15",
      });
    });

    it("uses current date when today is not provided", () => {
      const today = new Date().toISOString().split("T")[0];
      const result = getDateRange("7d");
      expect(result.to).toBe(today);
    });

    it("handles month boundaries correctly", () => {
      const result = getDateRange("7d", "2025-06-03");
      expect(result).toEqual({
        from: "2025-05-28",
        to: "2025-06-03",
      });
    });

    it("handles year boundaries correctly", () => {
      const result = getDateRange("30d", "2025-01-15");
      expect(result).toEqual({
        from: "2024-12-17",
        to: "2025-01-15",
      });
    });
  });

  describe("calculateStreak", () => {
    it("returns all zeros for empty array", () => {
      const result = calculateStreak([]);
      expect(result).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        totalTrackedDays: 0,
      });
    });

    it("returns streak of 1 for single day that is today", () => {
      const today = new Date().toISOString().split("T")[0];
      const result = calculateStreak([today]);
      expect(result).toEqual({
        currentStreak: 1,
        longestStreak: 1,
        totalTrackedDays: 1,
      });
    });

    it("returns streak of 1 for single day that is yesterday", () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const result = calculateStreak([yesterday]);
      expect(result).toEqual({
        currentStreak: 1,
        longestStreak: 1,
        totalTrackedDays: 1,
      });
    });

    it("returns zero current streak for single day in the past", () => {
      const result = calculateStreak(["2025-05-01"], "2025-06-15");
      expect(result).toEqual({
        currentStreak: 0,
        longestStreak: 1,
        totalTrackedDays: 1,
      });
    });

    it("calculates current streak for consecutive days ending today", () => {
      const result = calculateStreak(
        ["2025-06-13", "2025-06-14", "2025-06-15"],
        "2025-06-15",
      );
      expect(result).toEqual({
        currentStreak: 3,
        longestStreak: 3,
        totalTrackedDays: 3,
      });
    });

    it("calculates current streak for consecutive days ending yesterday", () => {
      const result = calculateStreak(
        ["2025-06-12", "2025-06-13", "2025-06-14"],
        "2025-06-15",
      );
      expect(result).toEqual({
        currentStreak: 3,
        longestStreak: 3,
        totalTrackedDays: 3,
      });
    });

    it("handles gaps in tracking", () => {
      const result = calculateStreak(
        ["2025-06-10", "2025-06-11", "2025-06-14", "2025-06-15"],
        "2025-06-15",
      );
      expect(result).toEqual({
        currentStreak: 2,
        longestStreak: 2,
        totalTrackedDays: 4,
      });
    });

    it("calculates longest streak correctly with gaps", () => {
      const result = calculateStreak(
        [
          "2025-06-01",
          "2025-06-02",
          "2025-06-03",
          "2025-06-04",
          "2025-06-06",
          "2025-06-14",
          "2025-06-15",
        ],
        "2025-06-15",
      );
      expect(result).toEqual({
        currentStreak: 2,
        longestStreak: 4,
        totalTrackedDays: 7,
      });
    });

    it("handles unsorted dates", () => {
      const result = calculateStreak(
        ["2025-06-15", "2025-06-13", "2025-06-14"],
        "2025-06-15",
      );
      expect(result).toEqual({
        currentStreak: 3,
        longestStreak: 3,
        totalTrackedDays: 3,
      });
    });

    it("handles duplicate dates", () => {
      const result = calculateStreak(
        ["2025-06-14", "2025-06-14", "2025-06-15", "2025-06-15"],
        "2025-06-15",
      );
      expect(result).toEqual({
        currentStreak: 2,
        longestStreak: 2,
        totalTrackedDays: 2,
      });
    });

    it("uses current date when today is not provided", () => {
      const today = new Date().toISOString().split("T")[0];
      const result = calculateStreak([today]);
      expect(result.currentStreak).toBeGreaterThan(0);
    });
  });

  describe("calculateMacroAdherence", () => {
    const mockGoal: UserGoal = {
      id: "goal-1",
      goalType: "manual",
      dailyCaloriesKcal: 2000,
      proteinGrams: 150,
      proteinPercent: 30,
      carbsGrams: 200,
      carbsPercent: 40,
      fatGrams: 67,
      fatPercent: 30,
      waterMl: 2000,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    it("returns zeros for empty points array", () => {
      const result = calculateMacroAdherence([], mockGoal);
      expect(result).toEqual({
        protein: 0,
        carbs: 0,
        fat: 0,
      });
    });

    it("returns zeros when goal targets are zero", () => {
      const zeroGoal: UserGoal = {
        ...mockGoal,
        proteinGrams: 0,
        carbsGrams: 0,
        fatGrams: 0,
      };
      const points: DailyStatsPoint[] = [
        {
          day: "2025-06-01",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
      ];
      const result = calculateMacroAdherence(points, zeroGoal);
      expect(result).toEqual({
        protein: 0,
        carbs: 0,
        fat: 0,
      });
    });

    it("calculates adherence for single point exactly on target", () => {
      const points: DailyStatsPoint[] = [
        {
          day: "2025-06-01",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
      ];
      const result = calculateMacroAdherence(points, mockGoal);
      expect(result).toEqual({
        protein: 1,
        carbs: 1,
        fat: 1,
      });
    });

    it("calculates adherence for single point above target", () => {
      const points: DailyStatsPoint[] = [
        {
          day: "2025-06-01",
          calories: 2500,
          protein: 225,
          carbs: 300,
          fat: 100,
        },
      ];
      const result = calculateMacroAdherence(points, mockGoal);
      expect(result.protein).toBeCloseTo(1.5, 2);
      expect(result.carbs).toBeCloseTo(1.5, 2);
      expect(result.fat).toBeCloseTo(1.49, 2);
    });

    it("calculates adherence for single point below target", () => {
      const points: DailyStatsPoint[] = [
        {
          day: "2025-06-01",
          calories: 1000,
          protein: 75,
          carbs: 100,
          fat: 33,
        },
      ];
      const result = calculateMacroAdherence(points, mockGoal);
      expect(result.protein).toBeCloseTo(0.5, 2);
      expect(result.carbs).toBeCloseTo(0.5, 2);
      expect(result.fat).toBeCloseTo(0.49, 2);
    });

    it("averages adherence across multiple points", () => {
      const points: DailyStatsPoint[] = [
        {
          day: "2025-06-01",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-02",
          calories: 2200,
          protein: 165,
          carbs: 220,
          fat: 73,
        },
        {
          day: "2025-06-03",
          calories: 1800,
          protein: 135,
          carbs: 180,
          fat: 60,
        },
      ];
      const result = calculateMacroAdherence(points, mockGoal);
      // Average protein: (150 + 165 + 135) / 3 = 150 → 150/150 = 1.0
      // Average carbs: (200 + 220 + 180) / 3 = 200 → 200/200 = 1.0
      // Average fat: (67 + 73 + 60) / 3 = 66.67 → 66.67/67 = 0.995
      expect(result.protein).toBeCloseTo(1.0, 2);
      expect(result.carbs).toBeCloseTo(1.0, 2);
      expect(result.fat).toBeCloseTo(0.995, 2);
    });

    it("handles zero values in points", () => {
      const points: DailyStatsPoint[] = [
        { day: "2025-06-01", calories: 0, protein: 0, carbs: 0, fat: 0 },
      ];
      const result = calculateMacroAdherence(points, mockGoal);
      expect(result).toEqual({
        protein: 0,
        carbs: 0,
        fat: 0,
      });
    });
  });

  describe("deriveGoalPace", () => {
    it("returns no_data for empty weights array", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "calculated",
        dailyCaloriesKcal: 1800,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        weightGoalType: "lose",
        targetWeightKg: 70,
        currentWeightKg: 80,
        weightChangePace: "moderate",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const result = deriveGoalPace([], goal);
      expect(result).toBe("no_data");
    });

    it("returns no_data for single weight entry", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "calculated",
        dailyCaloriesKcal: 1800,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        weightGoalType: "lose",
        targetWeightKg: 70,
        currentWeightKg: 80,
        weightChangePace: "moderate",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
      ];
      const result = deriveGoalPace(weights, goal);
      expect(result).toBe("no_data");
    });

    describe("lose goals", () => {
      it("returns ahead when losing faster than expected (slow pace)", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 1800,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "lose",
          targetWeightKg: 70,
          currentWeightKg: 80,
          weightChangePace: "slow", // Expected: ~0.25kg/week
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 79, // Lost 1kg in 2 weeks (~0.5kg/week) >> 0.25kg/week
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("ahead");
      });

      it("returns on_track when losing within 80-100% of expected rate", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 1800,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "lose",
          targetWeightKg: 70,
          currentWeightKg: 80,
          weightChangePace: "moderate", // Expected: ~0.5kg/week
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 79.1, // Lost 0.9kg in 2 weeks (~0.45kg/week) = 90% of target
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("on_track");
      });

      it("returns behind when losing slower than 80% of expected rate", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 1800,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "lose",
          targetWeightKg: 70,
          currentWeightKg: 80,
          weightChangePace: "moderate", // Expected: ~0.5kg/week
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 79.6, // Lost 0.4kg in 2 weeks (~0.2kg/week) = 40% of target
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("behind");
      });

      it("returns behind when gaining weight on lose goal", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 1800,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "lose",
          targetWeightKg: 70,
          currentWeightKg: 80,
          weightChangePace: "moderate",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 81,
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("behind");
      });
    });

    describe("gain goals", () => {
      it("returns ahead when gaining faster than expected", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 2500,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "gain",
          targetWeightKg: 90,
          currentWeightKg: 80,
          weightChangePace: "slow", // Expected: ~0.25kg/week
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 81, // Gained 1kg in 2 weeks (~0.5kg/week) >> 0.25kg/week
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("ahead");
      });

      it("returns on_track when gaining within 80-100% of expected rate", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 2500,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "gain",
          targetWeightKg: 90,
          currentWeightKg: 80,
          weightChangePace: "moderate", // Expected: ~0.5kg/week
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 80.9, // Gained 0.9kg in 2 weeks (~0.45kg/week) = 90% of target
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("on_track");
      });

      it("returns behind when gaining slower than 80% of expected rate", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 2500,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "gain",
          targetWeightKg: 90,
          currentWeightKg: 80,
          weightChangePace: "moderate", // Expected: ~0.5kg/week
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 80.4, // Gained 0.4kg in 2 weeks (~0.2kg/week) = 40% of target
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("behind");
      });

      it("returns behind when losing weight on gain goal", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 2500,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "gain",
          targetWeightKg: 90,
          currentWeightKg: 80,
          weightChangePace: "moderate",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 79,
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("behind");
      });
    });

    describe("maintain goals", () => {
      it("returns on_track when within ±1kg of current weight", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 2000,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "maintain",
          currentWeightKg: 80,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 80.8, // Within ±1kg
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("on_track");
      });

      it("returns behind when more than 1kg away from current weight", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 2000,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "maintain",
          currentWeightKg: 80,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 82, // More than 1kg away
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("behind");
      });

      it("returns on_track at exactly 1kg difference", () => {
        const goal: UserGoal = {
          id: "goal-1",
          goalType: "calculated",
          dailyCaloriesKcal: 2000,
          proteinGrams: 150,
          proteinPercent: 30,
          carbsGrams: 200,
          carbsPercent: 40,
          fatGrams: 67,
          fatPercent: 30,
          waterMl: 2000,
          weightGoalType: "maintain",
          currentWeightKg: 80,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        };
        const weights: BodyWeightEntry[] = [
          {
            id: "w1",
            day: "2025-06-01",
            weightKg: 80,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "w2",
            day: "2025-06-15",
            weightKg: 81, // Exactly 1kg
            createdAt: "2025-06-15T00:00:00.000Z",
            updatedAt: "2025-06-15T00:00:00.000Z",
          },
        ];
        const result = deriveGoalPace(weights, goal);
        expect(result).toBe("on_track");
      });
    });

    it("returns no_data for manual goal without weight tracking fields", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "manual",
        dailyCaloriesKcal: 2000,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 79,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = deriveGoalPace(weights, goal);
      expect(result).toBe("no_data");
    });
  });

  describe("calculateWeightDelta", () => {
    it("returns null for empty weights array", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "calculated",
        dailyCaloriesKcal: 1800,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        weightGoalType: "lose",
        targetWeightKg: 70,
        currentWeightKg: 80,
        weightChangePace: "moderate",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const result = calculateWeightDelta([], goal);
      expect(result).toBeNull();
    });

    it("returns null when goal has no target weight", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "calculated",
        dailyCaloriesKcal: 2000,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        weightGoalType: "maintain",
        currentWeightKg: 80,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
      ];
      const result = calculateWeightDelta(weights, goal);
      expect(result).toBeNull();
    });

    it("calculates delta for weight loss journey", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "calculated",
        dailyCaloriesKcal: 1800,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        weightGoalType: "lose",
        targetWeightKg: 70,
        currentWeightKg: 80,
        weightChangePace: "moderate",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-08",
          weightKg: 78,
          createdAt: "2025-06-08T00:00:00.000Z",
          updatedAt: "2025-06-08T00:00:00.000Z",
        },
        {
          id: "w3",
          day: "2025-06-15",
          weightKg: 76,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateWeightDelta(weights, goal);
      expect(result).toEqual({
        lost: 4, // 80 - 76
        remaining: 6, // 76 - 70
        percentComplete: 40, // 4 / (80-70) * 100
      });
    });

    it("calculates delta for weight gain journey", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "calculated",
        dailyCaloriesKcal: 2500,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        weightGoalType: "gain",
        targetWeightKg: 90,
        currentWeightKg: 80,
        weightChangePace: "moderate",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 84,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateWeightDelta(weights, goal);
      expect(result).toEqual({
        lost: -4, // 80 - 84 (negative = gained)
        remaining: 6, // 90 - 84
        percentComplete: 40, // 4 / (90-80) * 100
      });
    });

    it("calculates 100% complete when target is reached", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "calculated",
        dailyCaloriesKcal: 1800,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        weightGoalType: "lose",
        targetWeightKg: 70,
        currentWeightKg: 80,
        weightChangePace: "moderate",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-07-01",
          weightKg: 70,
          createdAt: "2025-07-01T00:00:00.000Z",
          updatedAt: "2025-07-01T00:00:00.000Z",
        },
      ];
      const result = calculateWeightDelta(weights, goal);
      expect(result).toEqual({
        lost: 10,
        remaining: 0,
        percentComplete: 100,
      });
    });

    it("handles weight going past target (>100%)", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "calculated",
        dailyCaloriesKcal: 1800,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        weightGoalType: "lose",
        targetWeightKg: 70,
        currentWeightKg: 80,
        weightChangePace: "moderate",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-07-01",
          weightKg: 65,
          createdAt: "2025-07-01T00:00:00.000Z",
          updatedAt: "2025-07-01T00:00:00.000Z",
        },
      ];
      const result = calculateWeightDelta(weights, goal);
      expect(result).toEqual({
        lost: 15,
        remaining: -5, // Negative = past target
        percentComplete: 150,
      });
    });

    it("handles single weight entry", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "calculated",
        dailyCaloriesKcal: 1800,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        weightGoalType: "lose",
        targetWeightKg: 70,
        currentWeightKg: 80,
        weightChangePace: "moderate",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
      ];
      const result = calculateWeightDelta(weights, goal);
      expect(result).toEqual({
        lost: 0, // No change yet
        remaining: 10,
        percentComplete: 0,
      });
    });

    it("handles unsorted weights correctly", () => {
      const goal: UserGoal = {
        id: "goal-1",
        goalType: "calculated",
        dailyCaloriesKcal: 1800,
        proteinGrams: 150,
        proteinPercent: 30,
        carbsGrams: 200,
        carbsPercent: 40,
        fatGrams: 67,
        fatPercent: 30,
        waterMl: 2000,
        weightGoalType: "lose",
        targetWeightKg: 70,
        currentWeightKg: 80,
        weightChangePace: "moderate",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 76,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
      ];
      const result = calculateWeightDelta(weights, goal);
      expect(result).toEqual({
        lost: 4,
        remaining: 6,
        percentComplete: 40,
      });
    });
  });

  describe("calculateWeightTrend", () => {
    it("returns stable with empty dataPoints for no data", () => {
      const result = calculateWeightTrend([], "7d");
      expect(result).toEqual({
        direction: "stable",
        changeKg: 0,
        changePercent: 0,
        dataPoints: [],
      });
    });

    it("returns stable with empty dataPoints for single entry", () => {
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-15",
          weightKg: 80,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateWeightTrend(weights, "7d", "2025-06-15");
      expect(result).toEqual({
        direction: "stable",
        changeKg: 0,
        changePercent: 0,
        dataPoints: [],
      });
    });

    it("detects downward trend (losing weight)", () => {
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-09",
          weightKg: 80,
          createdAt: "2025-06-09T00:00:00.000Z",
          updatedAt: "2025-06-09T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-12",
          weightKg: 79,
          createdAt: "2025-06-12T00:00:00.000Z",
          updatedAt: "2025-06-12T00:00:00.000Z",
        },
        {
          id: "w3",
          day: "2025-06-15",
          weightKg: 78,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateWeightTrend(weights, "7d", "2025-06-15");
      expect(result.direction).toBe("down");
      expect(result.changeKg).toBe(-2);
      expect(result.changePercent).toBeCloseTo(-2.5, 1);
      expect(result.dataPoints).toEqual([
        { day: "2025-06-09", weightKg: 80 },
        { day: "2025-06-12", weightKg: 79 },
        { day: "2025-06-15", weightKg: 78 },
      ]);
    });

    it("detects upward trend (gaining weight)", () => {
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-09",
          weightKg: 70,
          createdAt: "2025-06-09T00:00:00.000Z",
          updatedAt: "2025-06-09T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 71,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateWeightTrend(weights, "7d", "2025-06-15");
      expect(result.direction).toBe("up");
      expect(result.changeKg).toBe(1);
      expect(result.changePercent).toBeCloseTo(1.43, 1);
      expect(result.dataPoints).toHaveLength(2);
    });

    it("returns stable when change is less than 0.3 kg", () => {
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-09",
          weightKg: 80,
          createdAt: "2025-06-09T00:00:00.000Z",
          updatedAt: "2025-06-09T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 80.2,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateWeightTrend(weights, "7d", "2025-06-15");
      expect(result.direction).toBe("stable");
      expect(result.changeKg).toBeCloseTo(0.2, 1);
    });

    it("filters entries to the specified date range", () => {
      const weights: BodyWeightEntry[] = [
        {
          id: "w0",
          day: "2025-05-01",
          weightKg: 90,
          createdAt: "2025-05-01T00:00:00.000Z",
          updatedAt: "2025-05-01T00:00:00.000Z",
        },
        {
          id: "w1",
          day: "2025-06-09",
          weightKg: 80,
          createdAt: "2025-06-09T00:00:00.000Z",
          updatedAt: "2025-06-09T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 78,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateWeightTrend(weights, "7d", "2025-06-15");
      // The May entry should be excluded from 7d range
      expect(result.dataPoints).toHaveLength(2);
      expect(result.changeKg).toBe(-2);
    });

    it("handles 30d period", () => {
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-05-20",
          weightKg: 82,
          createdAt: "2025-05-20T00:00:00.000Z",
          updatedAt: "2025-05-20T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 79,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateWeightTrend(weights, "30d", "2025-06-15");
      expect(result.direction).toBe("down");
      expect(result.changeKg).toBe(-3);
      expect(result.dataPoints).toHaveLength(2);
    });
  });

  describe("calculateETA", () => {
    const baseGoal: UserGoal = {
      id: "goal-1",
      goalType: "calculated",
      dailyCaloriesKcal: 1800,
      proteinGrams: 150,
      proteinPercent: 30,
      carbsGrams: 200,
      carbsPercent: 40,
      fatGrams: 67,
      fatPercent: 30,
      waterMl: 2000,
      weightGoalType: "lose",
      targetWeightKg: 70,
      currentWeightKg: 80,
      weightChangePace: "moderate",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    it("returns defaults when no weight entries", () => {
      const result = calculateETA([], baseGoal, "2025-06-15");
      expect(result).toEqual({
        targetDate: null,
        daysRemaining: null,
        progressPercent: 0,
        isOnTrack: false,
      });
    });

    it("returns defaults when less than 2 days of data", () => {
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-10",
          weightKg: 80,
          createdAt: "2025-06-10T00:00:00.000Z",
          updatedAt: "2025-06-10T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-11",
          weightKg: 79.8,
          createdAt: "2025-06-11T00:00:00.000Z",
          updatedAt: "2025-06-11T00:00:00.000Z",
        },
      ];
      const result = calculateETA(weights, baseGoal, "2025-06-11");
      expect(result).toEqual({
        targetDate: null,
        daysRemaining: null,
        progressPercent: 0,
        isOnTrack: false,
      });
    });

    it("projects ETA with 2+ days of data", () => {
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-10",
          weightKg: 80,
          createdAt: "2025-06-10T00:00:00.000Z",
          updatedAt: "2025-06-10T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 79.5,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateETA(weights, baseGoal, "2025-06-15");
      expect(result.targetDate).not.toBeNull();
      expect(result.daysRemaining).toBeGreaterThan(0);
      expect(result.isOnTrack).toBe(true);
    });

    it("returns defaults when goal has no target weight", () => {
      const goalNoTarget: UserGoal = {
        ...baseGoal,
        targetWeightKg: undefined,
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 79,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateETA(weights, goalNoTarget, "2025-06-15");
      expect(result).toEqual({
        targetDate: null,
        daysRemaining: null,
        progressPercent: 0,
        isOnTrack: false,
      });
    });

    it("calculates ETA for weight loss on track", () => {
      // 80kg -> 79kg in 7 days = ~1kg/week rate
      // Remaining: 79 - 70 = 9 kg
      // Daily rate: 1/7 kg/day => days = 9 / (1/7) = 63
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-08",
          weightKg: 80,
          createdAt: "2025-06-08T00:00:00.000Z",
          updatedAt: "2025-06-08T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 79,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateETA(weights, baseGoal, "2025-06-15");
      expect(result.isOnTrack).toBe(true);
      expect(result.daysRemaining).toBe(63);
      expect(result.targetDate).toBe("2025-08-17");
      expect(result.progressPercent).toBeCloseTo(10, 0);
    });

    it("calculates ETA for weight gain on track", () => {
      const gainGoal: UserGoal = {
        ...baseGoal,
        weightGoalType: "gain",
        targetWeightKg: 90,
        currentWeightKg: 80,
      };
      // 80kg -> 82kg in 14 days = 1kg/week
      // Remaining: 90 - 82 = 8 kg
      // Daily rate: 2/14 kg/day => days = 8 / (2/14) = 56
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 82,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateETA(weights, gainGoal, "2025-06-15");
      expect(result.isOnTrack).toBe(true);
      expect(result.daysRemaining).toBe(56);
      expect(result.progressPercent).toBeCloseTo(20, 0);
    });

    it("detects wrong direction (losing when should gain)", () => {
      const gainGoal: UserGoal = {
        ...baseGoal,
        weightGoalType: "gain",
        targetWeightKg: 90,
        currentWeightKg: 80,
      };
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 78,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateETA(weights, gainGoal, "2025-06-15");
      expect(result.isOnTrack).toBe(false);
      expect(result.daysRemaining).toBeNull();
      expect(result.targetDate).toBeNull();
    });

    it("handles goal already reached (100% progress)", () => {
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 70,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateETA(weights, baseGoal, "2025-06-15");
      expect(result.isOnTrack).toBe(true);
      expect(result.daysRemaining).toBe(0);
      expect(result.progressPercent).toBe(100);
    });

    it("caps daysRemaining at 365", () => {
      // Very slow progress: 0.1 kg in 14 days
      // Remaining: 79.9 - 70 = 9.9 kg
      // Daily rate: 0.1/14 => days = 9.9 / (0.1/14) = 1386 => capped at 365
      const weights: BodyWeightEntry[] = [
        {
          id: "w1",
          day: "2025-06-01",
          weightKg: 80,
          createdAt: "2025-06-01T00:00:00.000Z",
          updatedAt: "2025-06-01T00:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-15",
          weightKg: 79.9,
          createdAt: "2025-06-15T00:00:00.000Z",
          updatedAt: "2025-06-15T00:00:00.000Z",
        },
      ];
      const result = calculateETA(weights, baseGoal, "2025-06-15");
      expect(result.daysRemaining).toBe(365);
    });
  });

  describe("calculateEfficiency", () => {
    const baseGoal: UserGoal = {
      id: "goal-1",
      goalType: "manual",
      dailyCaloriesKcal: 2000,
      proteinGrams: 150,
      proteinPercent: 30,
      carbsGrams: 200,
      carbsPercent: 40,
      fatGrams: 67,
      fatPercent: 30,
      waterMl: 2000,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    it("returns zeros when no data", () => {
      const result = calculateEfficiency([], baseGoal, "2025-06-15");
      expect(result).toEqual({
        deviationPercent: 0,
        direction: "on_target",
        avgCaloriesThisWeek: 0,
        avgCaloriesLastWeek: 0,
      });
    });

    it("returns zeros when only this week has data (no last week baseline)", () => {
      const stats: DailyStatsPoint[] = [
        {
          day: "2025-06-15",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-14",
          calories: 1900,
          protein: 140,
          carbs: 190,
          fat: 60,
        },
      ];
      const result = calculateEfficiency(stats, baseGoal, "2025-06-15");
      expect(result.avgCaloriesLastWeek).toBe(0);
      expect(result.deviationPercent).toBe(0);
      expect(result.direction).toBe("on_target");
    });

    it("returns zeros when only last week has data", () => {
      const stats: DailyStatsPoint[] = [
        {
          day: "2025-06-08",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-07",
          calories: 1900,
          protein: 140,
          carbs: 190,
          fat: 60,
        },
      ];
      const result = calculateEfficiency(stats, baseGoal, "2025-06-15");
      expect(result.avgCaloriesThisWeek).toBe(0);
      expect(result.deviationPercent).toBe(0);
      expect(result.direction).toBe("on_target");
    });

    it("detects over-eating compared to last week", () => {
      const stats: DailyStatsPoint[] = [
        // This week (June 9-15): avg 2200
        {
          day: "2025-06-15",
          calories: 2200,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-14",
          calories: 2200,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-13",
          calories: 2200,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-12",
          calories: 2200,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-11",
          calories: 2200,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-10",
          calories: 2200,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-09",
          calories: 2200,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        // Last week (June 2-8): avg 2000
        {
          day: "2025-06-08",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-07",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-06",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-05",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-04",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-03",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-02",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
      ];
      const result = calculateEfficiency(stats, baseGoal, "2025-06-15");
      expect(result.direction).toBe("over");
      expect(result.deviationPercent).toBeCloseTo(10, 0);
      expect(result.avgCaloriesThisWeek).toBe(2200);
      expect(result.avgCaloriesLastWeek).toBe(2000);
    });

    it("detects under-eating compared to last week", () => {
      const stats: DailyStatsPoint[] = [
        // This week: avg 1600
        {
          day: "2025-06-15",
          calories: 1600,
          protein: 120,
          carbs: 160,
          fat: 50,
        },
        {
          day: "2025-06-14",
          calories: 1600,
          protein: 120,
          carbs: 160,
          fat: 50,
        },
        {
          day: "2025-06-13",
          calories: 1600,
          protein: 120,
          carbs: 160,
          fat: 50,
        },
        {
          day: "2025-06-12",
          calories: 1600,
          protein: 120,
          carbs: 160,
          fat: 50,
        },
        {
          day: "2025-06-11",
          calories: 1600,
          protein: 120,
          carbs: 160,
          fat: 50,
        },
        {
          day: "2025-06-10",
          calories: 1600,
          protein: 120,
          carbs: 160,
          fat: 50,
        },
        {
          day: "2025-06-09",
          calories: 1600,
          protein: 120,
          carbs: 160,
          fat: 50,
        },
        // Last week: avg 2000
        {
          day: "2025-06-08",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-07",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-06",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-05",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-04",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-03",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-02",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
      ];
      const result = calculateEfficiency(stats, baseGoal, "2025-06-15");
      expect(result.direction).toBe("under");
      expect(result.deviationPercent).toBeCloseTo(-20, 0);
    });

    it("detects on_target when deviation is less than 5%", () => {
      const stats: DailyStatsPoint[] = [
        // This week: avg 2050
        {
          day: "2025-06-15",
          calories: 2050,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-14",
          calories: 2050,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-13",
          calories: 2050,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-12",
          calories: 2050,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-11",
          calories: 2050,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-10",
          calories: 2050,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-09",
          calories: 2050,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        // Last week: avg 2000
        {
          day: "2025-06-08",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-07",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-06",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-05",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-04",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-03",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-02",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
      ];
      const result = calculateEfficiency(stats, baseGoal, "2025-06-15");
      expect(result.direction).toBe("on_target");
      expect(result.deviationPercent).toBeCloseTo(2.5, 0);
    });
  });

  describe("calculateConsistency", () => {
    const baseGoal: UserGoal = {
      id: "goal-1",
      goalType: "manual",
      dailyCaloriesKcal: 2000,
      proteinGrams: 150,
      proteinPercent: 30,
      carbsGrams: 200,
      carbsPercent: 40,
      fatGrams: 67,
      fatPercent: 30,
      waterMl: 2000,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    it("returns zero score and empty weeks for no data", () => {
      const result = calculateConsistency([], baseGoal, "2025-06-15");
      expect(result.score).toBe(0);
      expect(result.weeks).toHaveLength(4);
      expect(result.avgIntake7d).toBe(0);
    });

    it("returns 100% score when all days hit both targets", () => {
      // Generate 28 days of perfect data
      const stats: DailyStatsPoint[] = [];
      for (let i = 27; i >= 0; i--) {
        const date = new Date("2025-06-15");
        date.setDate(date.getDate() - i);
        stats.push({
          day: date.toISOString().split("T")[0],
          calories: 2000, // Exactly on target (within 15% = 1700-2300)
          protein: 150, // >= 80% of 150 = 120
          carbs: 200,
          fat: 67,
        });
      }
      const result = calculateConsistency(stats, baseGoal, "2025-06-15");
      expect(result.score).toBe(100);
      expect(result.weeks).toHaveLength(4);
      expect(result.avgIntake7d).toBe(2000);
    });

    it("calculates partial score correctly", () => {
      // 7 days of data, only 4 days hit both targets
      const stats: DailyStatsPoint[] = [
        // Hits both (calories within 15% of 2000, protein >= 120)
        {
          day: "2025-06-15",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-14",
          calories: 1900,
          protein: 130,
          carbs: 190,
          fat: 60,
        },
        {
          day: "2025-06-13",
          calories: 2100,
          protein: 140,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-12",
          calories: 2050,
          protein: 125,
          carbs: 200,
          fat: 67,
        },
        // Misses protein (< 120)
        {
          day: "2025-06-11",
          calories: 2000,
          protein: 100,
          carbs: 200,
          fat: 67,
        },
        // Misses calories (outside 15% = beyond 2300 or below 1700)
        {
          day: "2025-06-10",
          calories: 1500,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        // Misses both
        {
          day: "2025-06-09",
          calories: 2500,
          protein: 100,
          carbs: 200,
          fat: 67,
        },
      ];
      const result = calculateConsistency(stats, baseGoal, "2025-06-15");
      // 4 out of 7 days with data hit both targets
      expect(result.score).toBeCloseTo(57.14, 0);
    });

    it("handles edge threshold for protein (exactly 80%)", () => {
      const stats: DailyStatsPoint[] = [
        {
          day: "2025-06-15",
          calories: 2000,
          protein: 120, // Exactly 80% of 150 = 120 -> should hit
          carbs: 200,
          fat: 67,
        },
      ];
      const result = calculateConsistency(stats, baseGoal, "2025-06-15");
      // 1 day with data, and it hits both targets
      expect(result.score).toBe(100);
    });

    it("handles edge threshold for calories (exactly at 15% boundary)", () => {
      const stats: DailyStatsPoint[] = [
        {
          day: "2025-06-15",
          calories: 1700, // Exactly 2000 - 300 = 1700 -> 15% deviation, should hit
          protein: 150,
          carbs: 200,
          fat: 67,
        },
      ];
      const result = calculateConsistency(stats, baseGoal, "2025-06-15");
      expect(result.score).toBe(100);
    });

    it("calculates avgIntake7d from last 7 days only", () => {
      const stats: DailyStatsPoint[] = [
        // Last 7 days
        {
          day: "2025-06-15",
          calories: 1800,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-14",
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        {
          day: "2025-06-13",
          calories: 2200,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
        // Older data (should not affect avgIntake7d)
        {
          day: "2025-06-01",
          calories: 5000,
          protein: 150,
          carbs: 200,
          fat: 67,
        },
      ];
      const result = calculateConsistency(stats, baseGoal, "2025-06-15");
      expect(result.avgIntake7d).toBe(2000);
    });

    it("builds 4 weeks of ConsistencyWeek objects", () => {
      const result = calculateConsistency([], baseGoal, "2025-06-15");
      expect(result.weeks).toHaveLength(4);
      // Each week should have 7 days
      for (const week of result.weeks) {
        expect(week.days).toHaveLength(7);
      }
    });
  });
});
