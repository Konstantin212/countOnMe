import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BodyWeightEntry,
  DailyStatsPoint,
  StatsPeriod,
  UserGoal,
} from "@models/types";
import {
  calculateMacroAdherence,
  calculateStreak,
  calculateWeightDelta,
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
});
