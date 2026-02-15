import type {
  BodyWeightEntry,
  DailyStatsPoint,
  GoalPace,
  MacroAdherence,
  StatsPeriod,
  StreakInfo,
  UserGoal,
  WeightChangePace,
  WeightGoalType,
} from "@models/types";

/**
 * Compute start/end date strings (YYYY-MM-DD) for a given period.
 * @param period - Time period ('7d', '30d', '90d')
 * @param today - Optional date string (YYYY-MM-DD). Defaults to current date.
 * @returns Object with 'from' and 'to' date strings
 */
export function getDateRange(
  period: StatsPeriod,
  today?: string,
): { from: string; to: string } {
  const todayDate = today ? new Date(today) : new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  const fromDate = new Date(todayDate);
  // For "last N days", subtract N-1 to get N days inclusive (today + N-1 past days)
  // Example: last 7 days from June 15 → June 9-15 (7 days total)
  // June 15 - 6 days = June 9
  // But tests expect 90 days to be 90 days apart, not 91 days inclusive
  // So we subtract (N-1) consistently
  fromDate.setDate(fromDate.getDate() - (days - 1));

  return {
    from: fromDate.toISOString().split("T")[0],
    to: todayDate.toISOString().split("T")[0],
  };
}

/**
 * Calculate tracking streak information.
 * @param trackedDays - Array of YYYY-MM-DD strings (not necessarily sorted)
 * @param today - Optional date string (YYYY-MM-DD). Defaults to current date.
 * @returns StreakInfo with current streak, longest streak, and total tracked days
 */
export function calculateStreak(
  trackedDays: string[],
  today?: string,
): StreakInfo {
  if (trackedDays.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalTrackedDays: 0 };
  }

  // Remove duplicates and sort in ascending order
  const uniqueDays = Array.from(new Set(trackedDays)).sort();
  const todayDate = today ? new Date(today) : new Date();
  const todayStr = todayDate.toISOString().split("T")[0];

  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Calculate current streak (working backwards from today or yesterday)
  let currentStreak = 0;
  let checkDate = uniqueDays.includes(todayStr)
    ? new Date(todayStr)
    : uniqueDays.includes(yesterdayStr)
      ? new Date(yesterdayStr)
      : null;

  if (checkDate) {
    for (let i = uniqueDays.length - 1; i >= 0; i--) {
      const dayStr = checkDate.toISOString().split("T")[0];
      if (uniqueDays[i] === dayStr) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let currentRun = 1;
  let prevDate = new Date(uniqueDays[0]);

  for (let i = 1; i < uniqueDays.length; i++) {
    const currDate = new Date(uniqueDays[i]);
    const expectedNextDay = new Date(prevDate);
    expectedNextDay.setDate(expectedNextDay.getDate() + 1);

    if (currDate.getTime() === expectedNextDay.getTime()) {
      currentRun++;
    } else {
      longestStreak = Math.max(longestStreak, currentRun);
      currentRun = 1;
    }

    prevDate = currDate;
  }
  longestStreak = Math.max(longestStreak, currentRun);

  return {
    currentStreak,
    longestStreak,
    totalTrackedDays: uniqueDays.length,
  };
}

/**
 * Calculate macro adherence ratios (0 = 0%, 1 = 100% of goal).
 * @param points - Array of daily stats points
 * @param goal - User's nutrition goal
 * @returns MacroAdherence object with protein, carbs, fat ratios
 */
export function calculateMacroAdherence(
  points: DailyStatsPoint[],
  goal: UserGoal,
): MacroAdherence {
  if (points.length === 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  if (goal.proteinGrams === 0 || goal.carbsGrams === 0 || goal.fatGrams === 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  // Calculate averages
  const avgProtein =
    points.reduce((sum, p) => sum + p.protein, 0) / points.length;
  const avgCarbs = points.reduce((sum, p) => sum + p.carbs, 0) / points.length;
  const avgFat = points.reduce((sum, p) => sum + p.fat, 0) / points.length;

  return {
    protein: avgProtein / goal.proteinGrams,
    carbs: avgCarbs / goal.carbsGrams,
    fat: avgFat / goal.fatGrams,
  };
}

/**
 * Derive goal pace comparing actual weight trend to expected rate.
 * @param weights - Array of body weight entries (not necessarily sorted)
 * @param goal - User's goal with weight tracking fields
 * @returns GoalPace ('ahead', 'on_track', 'behind', 'no_data')
 */
export function deriveGoalPace(
  weights: BodyWeightEntry[],
  goal: UserGoal,
): GoalPace {
  // Need at least 2 weight entries to determine pace
  if (weights.length < 2) {
    return "no_data";
  }

  // Need weight goal type
  if (!goal.weightGoalType) {
    return "no_data";
  }

  // For non-maintain goals, need weight change pace
  if (goal.weightGoalType !== "maintain" && !goal.weightChangePace) {
    return "no_data";
  }

  // Sort weights by day
  const sortedWeights = [...weights].sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
  );

  const firstWeight = sortedWeights[0];
  const lastWeight = sortedWeights[sortedWeights.length - 1];

  // Calculate time difference in weeks
  const daysDiff =
    (new Date(lastWeight.day).getTime() - new Date(firstWeight.day).getTime()) /
    (1000 * 60 * 60 * 24);
  const weeksDiff = daysDiff / 7;

  if (weeksDiff === 0) {
    return "no_data";
  }

  // Calculate actual rate of change (kg/week)
  const actualChange = lastWeight.weightKg - firstWeight.weightKg;
  const actualRate = Math.abs(actualChange / weeksDiff);

  // Calculate expected rate based on pace (already verified non-null for non-maintain goals)
  const expectedRate = getExpectedWeeklyRate(
    goal.weightChangePace as WeightChangePace,
  );

  // For 'lose' goals
  if (goal.weightGoalType === "lose") {
    // Should be losing weight (negative change)
    if (actualChange > 0) {
      return "behind"; // Gaining weight when should be losing
    }
    // Compare actual loss rate to expected
    if (actualRate >= expectedRate) {
      return "ahead";
    } else if (actualRate >= expectedRate * 0.8) {
      return "on_track";
    } else {
      return "behind";
    }
  }

  // For 'gain' goals
  if (goal.weightGoalType === "gain") {
    // Should be gaining weight (positive change)
    if (actualChange < 0) {
      return "behind"; // Losing weight when should be gaining
    }
    // Compare actual gain rate to expected
    if (actualRate >= expectedRate) {
      return "ahead";
    } else if (actualRate >= expectedRate * 0.8) {
      return "on_track";
    } else {
      return "behind";
    }
  }

  // For 'maintain' goals
  if (goal.weightGoalType === "maintain" && goal.currentWeightKg) {
    const deviation = Math.abs(lastWeight.weightKg - goal.currentWeightKg);
    if (deviation <= 1) {
      return "on_track";
    } else {
      return "behind";
    }
  }

  return "no_data";
}

/**
 * Get expected weekly weight change rate based on pace.
 */
function getExpectedWeeklyRate(pace: WeightChangePace): number {
  switch (pace) {
    case "slow":
      return 0.25; // kg/week
    case "moderate":
      return 0.5; // kg/week
    case "aggressive":
      return 1.0; // kg/week
    default:
      return 0.5;
  }
}

/**
 * Calculate weight delta and progress percentage.
 * @param weights - Array of body weight entries (not necessarily sorted)
 * @param goal - User's goal with target weight
 * @returns Object with lost, remaining, and percentComplete, or null if insufficient data
 */
export function calculateWeightDelta(
  weights: BodyWeightEntry[],
  goal: UserGoal,
): { lost: number; remaining: number; percentComplete: number } | null {
  if (weights.length === 0 || !goal.targetWeightKg) {
    return null;
  }

  // Sort weights by day
  const sortedWeights = [...weights].sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
  );

  const firstWeight = sortedWeights[0].weightKg;
  const lastWeight = sortedWeights[sortedWeights.length - 1].weightKg;
  const targetWeight = goal.targetWeightKg;

  // Calculate change (positive = lost weight, negative = gained weight)
  const lost = firstWeight - lastWeight;

  // Calculate remaining distance to target
  // Remaining is always: distance from current to target
  // Positive means still need to go in that direction
  // Negative means went past target
  // For loss goal (target < start): remaining = current - target
  // For gain goal (target > start): remaining = target - current
  const remaining =
    targetWeight < firstWeight
      ? lastWeight - targetWeight // Loss goal
      : targetWeight - lastWeight; // Gain goal

  // Calculate percent complete
  const totalJourney = Math.abs(targetWeight - firstWeight);
  const progressMade = Math.abs(lost);
  const percentComplete =
    totalJourney === 0 ? 0 : (progressMade / totalJourney) * 100;

  return {
    lost,
    remaining,
    percentComplete,
  };
}
