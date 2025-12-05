// src/hooks/useStreak.ts
import { useState, useCallback, useEffect } from "react";
import { getTodayDate } from "@/lib/utils";

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string | null;
  totalGamesPlayed: number;
  totalScore: number;
}

const STREAK_STORAGE_KEY = "spellingb_streak";

const initialStreakData: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastPlayedDate: null,
  totalGamesPlayed: 0,
  totalScore: 0,
};

// Get yesterday's date in YYYY-MM-DD format (LA timezone)
function getYesterdayDate(): string {
  const today = new Date(getTodayDate());
  today.setDate(today.getDate() - 1);
  return today.toISOString().split("T")[0];
}

export function useStreak() {
  const [streak, setStreak] = useState<StreakData>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STREAK_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored) as StreakData;
        } catch (err) {
          console.error("Error parsing streak data", err);
        }
      }
    }
    return initialStreakData;
  });

  // Save streak to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(streak));
    }
  }, [streak]);

  // Record a completed game and update streak
  const recordGame = useCallback((score: number) => {
    const today = getTodayDate();
    const yesterday = getYesterdayDate();

    setStreak((prev) => {
      // Already played today - don't double count
      if (prev.lastPlayedDate === today) {
        return prev;
      }

      let newCurrentStreak: number;

      if (prev.lastPlayedDate === yesterday) {
        // Continuing streak from yesterday
        newCurrentStreak = prev.currentStreak + 1;
      } else if (prev.lastPlayedDate === null) {
        // First time playing
        newCurrentStreak = 1;
      } else {
        // Streak broken - start fresh
        newCurrentStreak = 1;
      }

      const newLongestStreak = Math.max(newCurrentStreak, prev.longestStreak);

      return {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastPlayedDate: today,
        totalGamesPlayed: prev.totalGamesPlayed + 1,
        totalScore: prev.totalScore + score,
      };
    });
  }, []);

  // Check if streak is still valid (played yesterday or today)
  const isStreakActive = useCallback((): boolean => {
    if (!streak.lastPlayedDate) return false;
    const today = getTodayDate();
    const yesterday = getYesterdayDate();
    return streak.lastPlayedDate === today || streak.lastPlayedDate === yesterday;
  }, [streak.lastPlayedDate]);

  // Get display streak (0 if broken, current otherwise)
  const displayStreak = useCallback((): number => {
    if (!isStreakActive()) return 0;
    return streak.currentStreak;
  }, [streak.currentStreak, isStreakActive]);

  // Reset streak data (for testing/debugging)
  const resetStreak = useCallback(() => {
    setStreak(initialStreakData);
  }, []);

  return {
    streak,
    recordGame,
    isStreakActive,
    displayStreak,
    resetStreak,
  };
}
