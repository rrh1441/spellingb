// src/app/game/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Volume2, Play, Share2, X, Trophy, Flame, RotateCcw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import supabase from "@/lib/supabase";
import useIsIpad from "@/hooks/useIsIpad";
import { getTodayDate, getLaMidnightUtc } from "@/lib/utils";
import { useGameState } from "@/hooks/useGameState";
import { useStreak } from "@/hooks/useStreak";
import { Keyboard } from "@/components/Keyboard";
import { shareResults, getGameDayNumber, ShareData } from "@/lib/share";

type Difficulty = "easy" | "medium" | "hard";
type GameMode = "daily" | "practice";

interface Word {
  id: number;
  word: string;
  definition: string;
  audio_url: string;
  difficulty?: Difficulty;
}

// Helper function to seed a random number generator
const seedRandom = (seed: number): (() => number) => {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
};

// Deterministic Fisher-Yates Shuffle
const deterministicShuffle = <T,>(array: T[], seed: number): T[] => {
  const shuffled = [...array];
  const rand = seedRandom(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Random shuffle for practice mode
const randomShuffle = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Mask the word in the definition to avoid giving away the answer
const maskWordInDefinition = (definition: string, word: string): string => {
  if (!definition || !word) return definition;
  // Create a regex that matches the word (case insensitive, whole word)
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  return definition.replace(regex, '_____');
};

export default function SpellingGame() {
  const TOTAL_TIME = 60;
  const WORDS_PER_GAME = 3;
  const isIpad = useIsIpad();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Game mode and difficulty
  const [gameMode, setGameMode] = useState<GameMode>("daily");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showIpadKeyboard, setShowIpadKeyboard] = useState(false);
  const [showAnswersModal, setShowAnswersModal] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(true);

  // Streak tracking
  const { streak, recordGame, displayStreak } = useStreak();

  // Persistent game state hook
  const { state: gameData, setState: setGameData } = useGameState({
    gameState: "ready",
    score: 0,
    correctWordCount: 0,
    timeLeft: TOTAL_TIME,
    attempts: [],
    currentWordIndex: 0,
    userInput: "",
  });

  // Get today's words based on a deterministic shuffle (for daily mode)
  const getTodayWords = useCallback(
    (wordList: Word[], diff: Difficulty): Word[] => {
      const filteredWords = wordList.filter((w) => w.difficulty === diff);
      if (filteredWords.length < WORDS_PER_GAME) {
        // Fallback to all words if not enough in difficulty
        return wordList.slice(0, WORDS_PER_GAME);
      }

      const referenceDate = new Date("2023-01-01");
      const laDateString = getTodayDate();
      const laMidnightUtc = getLaMidnightUtc(laDateString);
      const diffTime = laMidnightUtc.getTime() - referenceDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Add difficulty to seed so different difficulties get different words
      const seed = diffDays + (diff === "easy" ? 0 : diff === "medium" ? 10000 : 20000);
      const shuffledWords = deterministicShuffle(filteredWords, seed);
      return shuffledWords.slice(0, WORDS_PER_GAME);
    },
    []
  );

  // Get random words for practice mode
  const getPracticeWords = useCallback(
    (wordList: Word[], diff: Difficulty): Word[] => {
      const filteredWords = wordList.filter((w) => w.difficulty === diff);
      if (filteredWords.length < WORDS_PER_GAME) {
        return randomShuffle(wordList).slice(0, WORDS_PER_GAME);
      }
      return randomShuffle(filteredWords).slice(0, WORDS_PER_GAME);
    },
    []
  );

  // Reset game state to initial
  const setStateToInitial = useCallback(() => {
    setGameData((prev) => ({
      ...prev,
      gameState: "ready",
      score: 0,
      correctWordCount: 0,
      timeLeft: TOTAL_TIME,
      attempts: Array(WORDS_PER_GAME).fill(""),
      currentWordIndex: 0,
      userInput: "",
    }));
  }, [setGameData]);

  // Fetch words from Supabase
  useEffect(() => {
    const fetchWords = async () => {
      setIsLoading(true);

      if (!supabase) {
        console.error("Supabase client is not initialized.");
        toast({
          title: "Error",
          description: "Game configuration error. Please check setup.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("audio_files")
          .select("*")
          .order("id", { ascending: true });

        if (error) {
          console.error("Error fetching words:", error);
          toast({
            description: `Failed to load words: ${error.message}`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (data) {
          const words: Word[] = data.map((w: Word) => ({
            ...w,
            difficulty: w.difficulty || "easy", // Default to easy if no difficulty
          }));
          const validWords = words.filter((w) => w.word && w.definition && w.audio_url);

          if (validWords.length < WORDS_PER_GAME) {
            toast({
              description: "Insufficient words available.",
              variant: "destructive",
            });
            setAllWords([]);
          } else {
            setAllWords(validWords);
          }
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        toast({
          description: "An unexpected error occurred.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchWords();
  }, []);

  // Select words when mode/difficulty changes or words load
  useEffect(() => {
    if (allWords.length === 0) return;

    if (gameMode === "daily") {
      const todaysWords = getTodayWords(allWords, difficulty);
      setSelectedWords(todaysWords);
    }
    // For practice mode, words are selected when starting a new game
  }, [allWords, gameMode, difficulty, getTodayWords]);

  // If we fetched words and the attempts array length doesn't match, reset
  useEffect(() => {
    if (
      selectedWords.length > 0 &&
      gameData.attempts.length !== selectedWords.length
    ) {
      setStateToInitial();
    }
  }, [selectedWords, gameData.attempts.length, setStateToInitial]);

  // End game by applying remaining time bonus
  const handleGameEnd = useCallback(() => {
    setGameData((prev) => {
      const finalScore = prev.score + prev.timeLeft;
      // Record game for streak tracking (daily mode only)
      if (gameMode === "daily") {
        recordGame(finalScore);
      }
      return {
        ...prev,
        score: finalScore,
        gameState: "finished",
      };
    });
  }, [setGameData, gameMode, recordGame]);

  // Handle submission of an answer
  const handleSubmit = useCallback(() => {
    if (gameData.currentWordIndex >= selectedWords.length) return;

    const currentWord = selectedWords[gameData.currentWordIndex];
    if (!currentWord) return;

    const userAttempt = gameData.userInput.trim().toLowerCase();
    const isCorrect = userAttempt === currentWord.word.trim().toLowerCase();

    setGameData((prev) => {
      const newAttempts = [...prev.attempts];
      newAttempts[prev.currentWordIndex] = gameData.userInput.trim();

      let newScore = prev.score;
      let newCorrectWordCount = prev.correctWordCount;
      if (isCorrect) {
        newCorrectWordCount += 1;
        newScore += 50;
      }
      const nextIndex = prev.currentWordIndex + 1;

      if (nextIndex < selectedWords.length && prev.timeLeft > 0) {
        setTimeout(() => {
          if (audioRef.current && selectedWords[nextIndex]) {
            audioRef.current.src = selectedWords[nextIndex].audio_url;
            audioRef.current.load();
            audioRef.current.play().catch((err) => console.error("Audio error:", err));
          }
        }, 500);
        return {
          ...prev,
          score: newScore,
          correctWordCount: newCorrectWordCount,
          currentWordIndex: nextIndex,
          userInput: "",
          attempts: newAttempts,
        };
      } else {
        return {
          ...prev,
          score: newScore,
          correctWordCount: newCorrectWordCount,
          attempts: newAttempts,
          gameState: "finished",
        };
      }
    });
  }, [gameData.userInput, gameData.currentWordIndex, selectedWords, setGameData]);

  // Apply time bonus when game ends
  useEffect(() => {
    if (gameData.gameState === "finished" && gameMode === "daily") {
      recordGame(gameData.score);
    }
  }, [gameData.gameState, gameData.score, gameMode, recordGame]);

  // Start the game
  const startGame = useCallback(() => {
    // For daily mode, check if already played
    if (gameMode === "daily" && gameData.gameState === "finished") {
      toast({
        description: "You've already played today! Try Practice mode or come back tomorrow.",
        variant: "destructive",
      });
      return;
    }

    // Get the words to use for this game
    let wordsForGame: Word[];
    if (gameMode === "practice") {
      wordsForGame = getPracticeWords(allWords, difficulty);
      setSelectedWords(wordsForGame);
    } else {
      wordsForGame = selectedWords;
    }

    setShowModeSelect(false);
    setStateToInitial();
    setGameData((prev) => ({
      ...prev,
      gameState: "playing",
    }));

    // Play audio for first word after a short delay
    setTimeout(() => {
      if (audioRef.current && wordsForGame[0]) {
        audioRef.current.src = wordsForGame[0].audio_url;
        audioRef.current.load();
        audioRef.current.play().catch((error) => console.error("Failed to play audio:", error));
      }
    }, 500);
  }, [gameMode, gameData.gameState, allWords, difficulty, selectedWords, setGameData, setStateToInitial, getPracticeWords]);

  // Physical keyboard events (desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameData.gameState === "playing" && !isIpad) {
        if (e.key === "Backspace") {
          setGameData((prev) => ({
            ...prev,
            userInput: prev.userInput.slice(0, -1),
          }));
        } else if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
          setGameData((prev) => ({
            ...prev,
            userInput: prev.userInput + e.key.toLowerCase(),
          }));
        } else if (e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameData.gameState, handleSubmit, isIpad, setGameData]);

  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameData.gameState === "playing" && gameData.timeLeft > 0) {
      timer = setTimeout(() => {
        setGameData((prev) => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
    } else if (gameData.timeLeft === 0 && gameData.gameState === "playing") {
      handleGameEnd();
    }
    return () => clearTimeout(timer);
  }, [gameData.timeLeft, gameData.gameState, setGameData, handleGameEnd]);

  // On-screen keyboard presses
  const handleKeyPress = (key: string) => {
    if (gameData.gameState !== "playing") return;

    if (key === "backspace") {
      setGameData((prev) => ({
        ...prev,
        userInput: prev.userInput.slice(0, -1),
      }));
    } else if (key === "submit") {
      handleSubmit();
    } else {
      setGameData((prev) => ({ ...prev, userInput: prev.userInput + key.toLowerCase() }));
    }
  };

  // Play current word's audio
  const playAudio = () => {
    if (
      gameData.gameState !== "playing" ||
      gameData.currentWordIndex >= selectedWords.length ||
      !selectedWords[gameData.currentWordIndex]?.audio_url ||
      !audioRef.current
    ) {
      return;
    }

    audioRef.current.src = selectedWords[gameData.currentWordIndex].audio_url;
    audioRef.current.load();
    audioRef.current.play().catch((error) => {
      console.error("Error playing audio:", error);
      toast({
        description: "Failed to play audio. Please try again.",
        variant: "destructive",
      });
    });
  };

  // Share results with new format
  const handleShare = async () => {
    const shareData: ShareData = {
      score: gameData.score,
      correctCount: gameData.correctWordCount,
      totalWords: selectedWords.length,
      streak: displayStreak(),
      difficulty,
      dayNumber: getGameDayNumber(),
      attempts: gameData.attempts,
      correctWords: selectedWords.map((w) => w.word),
    };

    const result = await shareResults(shareData);

    if (result.success) {
      if (result.method === "clipboard") {
        toast({
          title: "Copied to clipboard!",
          description: "Share your results with friends.",
        });
      } else {
        toast({ description: "Results shared!" });
      }
    } else {
      toast({ description: "Sharing failed.", variant: "destructive" });
    }
  };

  // Back to mode selection
  const backToModeSelect = () => {
    setShowModeSelect(true);
    setStateToInitial();
  };

  // Loading State UI
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-lg text-gray-600">Loading words...</p>
      </div>
    );
  }

  // Main Game UI
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-2 relative">
      <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-lg bg-white rounded-xl z-10">
        <CardContent className="p-4">
          {/* Header with streak */}
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-800">Spelling B-</h1>
            {displayStreak() > 0 && (
              <div className="flex items-center gap-1 bg-orange-100 px-3 py-1 rounded-full">
                <Flame className="h-5 w-5 text-orange-500" />
                <span className="font-bold text-orange-600">{displayStreak()}</span>
              </div>
            )}
          </div>

          {/* ----- MODE SELECTION ----- */}
          {showModeSelect && (gameData.gameState === "ready" || gameData.gameState === "finished") && (
            <div className="space-y-6">
              {/* Show today's score if already played */}
              {gameData.gameState === "finished" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600 mb-1">Today&apos;s Score</p>
                  <p className="text-3xl font-bold text-blue-700">{gameData.score}</p>
                  <p className="text-sm text-blue-600 mt-1">
                    {gameData.correctWordCount}/{selectedWords.length} correct
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Come back tomorrow for a new challenge!</p>
                </div>
              )}

              {gameData.gameState === "ready" && (
                <p className="text-center text-gray-600">
                  Test your spelling skills on everyday words.
                  <br />
                  Autocorrect won&apos;t save you!
                </p>
              )}

              {/* Difficulty Selection */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 text-center">Difficulty</p>
                <div className="flex gap-2 justify-center">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <Button
                      key={d}
                      variant={difficulty === d ? "default" : "outline"}
                      onClick={() => setDifficulty(d)}
                      className={
                        difficulty === d
                          ? d === "easy"
                            ? "bg-green-500 hover:bg-green-600"
                            : d === "medium"
                            ? "bg-yellow-500 hover:bg-yellow-600"
                            : "bg-red-500 hover:bg-red-600"
                          : ""
                      }
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Game Mode Selection */}
              <div className="space-y-3">
                {gameData.gameState === "ready" && (
                  <Button
                    onClick={() => {
                      setGameMode("daily");
                      startGame();
                    }}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                    size="lg"
                    disabled={allWords.length === 0}
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Daily Challenge
                  </Button>
                )}

                {gameData.gameState === "finished" && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    Daily challenge completed for today
                  </div>
                )}

                <Button
                  onClick={() => {
                    setGameMode("practice");
                    startGame();
                  }}
                  variant="outline"
                  className="w-full"
                  size="lg"
                  disabled={allWords.length === 0}
                >
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Practice Mode (Unlimited)
                </Button>
              </div>

              {/* Stats display */}
              {streak.totalGamesPlayed > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{streak.totalGamesPlayed}</p>
                    <p className="text-xs text-gray-500">Games</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{streak.longestStreak}</p>
                    <p className="text-xs text-gray-500">Best Streak</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{streak.totalScore}</p>
                    <p className="text-xs text-gray-500">Total Score</p>
                  </div>
                </div>
              )}

              {!isLoading && allWords.length === 0 && (
                <p className="text-center text-red-600 mt-4">
                  Could not load words. Please try refreshing.
                </p>
              )}
            </div>
          )}

          {/* ----- PLAYING STATE ----- */}
          {gameData.gameState === "playing" && selectedWords.length > 0 && (
            <div className="space-y-4">
              {/* Mode indicator */}
              <div className="flex justify-between items-center text-sm">
                <span
                  className={`px-2 py-1 rounded ${
                    difficulty === "easy"
                      ? "bg-green-100 text-green-700"
                      : difficulty === "medium"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </span>
                <span className="text-gray-500">
                  {gameMode === "daily" ? "Daily" : "Practice"}
                </span>
              </div>

              {/* Score & Timer */}
              <div className="flex justify-between items-center">
                <p className="text-lg font-medium text-gray-700">Score: {gameData.score}</p>
                <p className="text-lg font-medium text-gray-700">Time: {gameData.timeLeft}s</p>
              </div>

              {/* Definition */}
              <div className="min-h-[3rem] flex items-center justify-center">
                <p className="text-center font-medium text-gray-700">
                  {selectedWords[gameData.currentWordIndex]
                    ? maskWordInDefinition(
                        selectedWords[gameData.currentWordIndex].definition,
                        selectedWords[gameData.currentWordIndex].word
                      )
                    : "Loading..."}
                </p>
              </div>

              {/* Audio Button */}
              <div className="flex justify-center">
                <Button
                  onClick={playAudio}
                  variant="outline"
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <Volume2 className="mr-2 h-5 w-5" /> Play Pronunciation
                </Button>
              </div>
              <audio ref={audioRef} preload="auto" />

              {/* Timer Bar */}
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 flex rounded bg-gray-200">
                  <div
                    style={{ width: `${(gameData.timeLeft / TOTAL_TIME) * 100}%` }}
                    className="bg-blue-500 transition-all duration-500 ease-linear"
                  ></div>
                </div>
              </div>

              {/* User Input Display */}
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-200 shadow-inner">
                <p className="text-2xl text-center font-mono text-gray-800 min-h-[40px] tracking-widest">
                  {gameData.userInput || <span className="text-gray-400">Type your answer</span>}
                </p>
              </div>

              {/* On-Screen Keyboard */}
              <Keyboard
                onKeyPress={handleKeyPress}
                isIpad={isIpad}
                showIpadKeyboard={showIpadKeyboard}
                setShowIpadKeyboard={setShowIpadKeyboard}
              />
            </div>
          )}

          {/* ----- FINISHED STATE ----- */}
          {gameData.gameState === "finished" && (
            <div className="text-center space-y-4">
              <p className="text-3xl font-bold text-gray-800">
                {gameData.correctWordCount === selectedWords.length
                  ? "Perfect!"
                  : gameData.correctWordCount > 0
                  ? "Well Done!"
                  : "Keep Practicing!"}
              </p>

              {/* Emoji result */}
              <div className="text-4xl py-2">
                {gameData.attempts.map((attempt, i) => {
                  const correct = selectedWords[i]?.word || "";
                  const isCorrect = attempt.trim().toLowerCase() === correct.trim().toLowerCase();
                  return (
                    <span key={i} className="mx-1">
                      {isCorrect ? "✅" : "❌"}
                    </span>
                  );
                })}
              </div>

              {/* Results Box */}
              <div className="mt-4 p-4 bg-gray-100 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Score</p>
                    <p className="text-2xl font-bold text-indigo-600">{gameData.score}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Correct</p>
                    <p className="text-2xl font-bold text-green-600">
                      {gameData.correctWordCount}/{selectedWords.length}
                    </p>
                  </div>
                </div>

                {displayStreak() > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <span className="font-bold text-orange-600">{displayStreak()} day streak!</span>
                  </div>
                )}
              </div>

              {gameMode === "daily" && (
                <p className="text-gray-600">Come back tomorrow for a new challenge!</p>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={() => setShowAnswersModal(true)}
                  className="w-full bg-gray-500 hover:bg-gray-600 text-white"
                  size="lg"
                >
                  Review Answers
                </Button>

                <Button
                  onClick={handleShare}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  size="lg"
                >
                  <Share2 className="mr-2 h-5 w-5" /> Share Results
                </Button>

                {gameMode === "practice" && (
                  <Button
                    onClick={() => {
                      setStateToInitial();
                      setShowModeSelect(true);
                    }}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <RotateCcw className="mr-2 h-5 w-5" /> Play Again
                  </Button>
                )}

                <Button
                  onClick={backToModeSelect}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Back to Menu
                </Button>

                <Button
                  onClick={() => window.open("https://buy.stripe.com/5kAg2qb6R5gjfKw28f", "_blank")}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  size="lg"
                >
                  <Trophy className="mr-2 h-5 w-5" /> Support Spelling B-
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----- Answers Modal ----- */}
      {showAnswersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md relative shadow-xl">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-200"
              onClick={() => setShowAnswersModal(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold text-center mb-5">Your Answers</h2>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {selectedWords.map((word, i) => {
                const attempt = gameData.attempts[i] ?? "";
                const isCorrect = attempt.trim().toLowerCase() === word.word.trim().toLowerCase();
                return (
                  <div key={word.id} className="space-y-2">
                    <p className="text-sm text-gray-600">{word.definition}</p>
                    <div className="flex gap-2">
                      <div
                        className={`flex-1 p-3 rounded border ${
                          isCorrect ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
                        }`}
                      >
                        <p className="text-xs text-gray-500 mb-1">You typed:</p>
                        <p
                          className={`text-lg font-mono ${
                            isCorrect ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {attempt || <span className="italic text-gray-400">(no answer)</span>}
                        </p>
                      </div>
                      {!isCorrect && (
                        <div className="flex-1 p-3 rounded border border-gray-300 bg-gray-50">
                          <p className="text-xs text-gray-500 mb-1">Correct:</p>
                          <p className="text-lg font-mono text-gray-700">{word.word}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-center mt-4">
              <Button variant="outline" onClick={() => setShowAnswersModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
