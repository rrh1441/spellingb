// src/hooks/useGameState.ts
import { useState, useCallback, useEffect } from "react";
import { getTodayDate } from "@/lib/utils";

export interface PersistedGameState {
  date: string;
  gameState: "ready" | "playing" | "finished";
  score: number;
  correctWordCount: number;
  timeLeft: number;
  attempts: string[];
  currentWordIndex: number;
  userInput: string;
}

const STORAGE_KEY = "spellingb_game_state";

export function useGameState(initialState: Omit<PersistedGameState, "date">) {
  const today = getTodayDate();
  const [state, setState] = useState<PersistedGameState>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as PersistedGameState;
          if (parsed.date === today) {
            return parsed;
          }
        } catch (err) {
          console.error("Error parsing persisted game state", err);
        }
      }
    }
    return { date: today, ...initialState };
  });

  const saveState = useCallback((newState: PersistedGameState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state, saveState]);

  return { state, setState };
}