// src/app/game/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Volume2, Play, Share2, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import supabase from "@/lib/supabase";
import useIsIpad from "@/hooks/useIsIpad";
import { formatInTimeZone } from "date-fns-tz";
import { getTodayDate, getLaMidnightUtc } from "@/lib/utils";
import { useGameState } from "@/hooks/useGameState";
import { Keyboard } from "@/components/Keyboard";

interface Word {
  id: number;
  word: string;
  definition: string;
  audio_url: string;
}

// Helper function to seed a random number generator
const seedRandom = (seed: number): () => number => {
  let value = seed;
  return () => {
    // LCG parameters
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
};

// Deterministic Fisher-Yates Shuffle
const deterministicShuffle = (array: Word[], seed: number): Word[] => {
  const shuffled = [...array];
  const rand = seedRandom(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function SpellingGame() {
  const TOTAL_TIME = 60;
  const isIpad = useIsIpad();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Use the persistent game state hook.
  const { state: gameData, setState: setGameData } = useGameState({
    gameState: "ready",
    score: 0,
    correctWordCount: 0,
    timeLeft: TOTAL_TIME,
    attempts: [],
    currentWordIndex: 0,
    userInput: "",
  });

  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showIpadKeyboard, setShowIpadKeyboard] = useState(false);

  // When the words have been fetched, initialize the attempts array if needed.
  useEffect(() => {
    if (selectedWords.length > 0 && gameData.attempts.length !== selectedWords.length) {
      setStateToInitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWords]);

  const setStateToInitial = () => {
    setGameData((prev) => ({
      ...prev,
      gameState: "ready",
      score: 0,
      correctWordCount: 0,
      timeLeft: TOTAL_TIME,
      attempts: Array(selectedWords.length).fill(""),
      currentWordIndex: 0,
      userInput: "",
    }));
  };

  // Determine today’s words based on a fixed seed.
  const getTodayWords = useCallback(
    (wordList: Word[]): Word[] => {
      const referenceDate = new Date("2023-01-01");
      const laDateString = getTodayDate();
      const laMidnightUtc = getLaMidnightUtc(laDateString);
      const diffTime = laMidnightUtc.getTime() - referenceDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const shuffledWords = deterministicShuffle(wordList, diffDays);
      return [shuffledWords[0], shuffledWords[1], shuffledWords[2]];
    },
    []
  );

  // Handle game end by applying the remaining time bonus.
  const handleGameEnd = useCallback(() => {
    setGameData((prev) => ({
      ...prev,
      score: prev.score + prev.timeLeft,
      gameState: "finished",
    }));
  }, [setGameData]);

  // Handle the submission of an answer.
  const handleSubmit = useCallback(() => {
    if (gameData.currentWordIndex >= selectedWords.length) return;

    const currentWord = selectedWords[gameData.currentWordIndex];
    const userAttempt = gameData.userInput.trim().toLowerCase();
    const isCorrect =
      userAttempt === currentWord.word.trim().toLowerCase();

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
        // Play the next audio after a short delay.
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.src = selectedWords[nextIndex].audio_url;
            audioRef.current.load();
            audioRef.current.play().catch((err) =>
              console.error("Audio play error:", err)
            );
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
        // End the game.
        handleGameEnd();
        return {
          ...prev,
          score: newScore,
          correctWordCount: newCorrectWordCount,
          attempts: newAttempts,
        };
      }
    });
  }, [
    gameData.userInput,
    gameData.currentWordIndex,
    selectedWords,
    gameData.score,
    gameData.correctWordCount,
    gameData.attempts,
    gameData.timeLeft,
    setGameData,
    handleGameEnd,
  ]);

  // Start the game if not already played.
  const startGame = useCallback(() => {
    if (gameData.gameState !== "ready") {
      toast({
        description: "You have already played today. Play again tomorrow!",
        variant: "destructive",
      });
      return;
    }
    setStateToInitial();
    setGameData((prev) => ({
      ...prev,
      gameState: "playing",
    }));
    // Play the initial audio.
    setTimeout(() => {
      if (audioRef.current && selectedWords[0]) {
        audioRef.current.src = selectedWords[0].audio_url;
        audioRef.current.load();
        audioRef.current.play().catch((error) =>
          console.error("Failed to play audio:", error)
        );
      }
    }, 500);
  }, [gameData.gameState, selectedWords, setGameData]);

  // Handle physical keyboard events (desktop).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameData.gameState === "playing" && !isIpad) {
        if (e.key === "Backspace") {
          setGameData((prev) => ({ ...prev, userInput: prev.userInput.slice(0, -1) }));
        } else if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
          setGameData((prev) => ({ ...prev, userInput: prev.userInput + e.key }));
        } else if (e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameData.gameState, handleSubmit, isIpad, setGameData]);

  // Fetch words from Supabase.
  useEffect(() => {
    const fetchWords = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("audio_files")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        console.error("Error fetching words:", error);
        toast({
          description: "Failed to load words. Please refresh.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (data) {
        const words: Word[] = data as Word[];
        const validWords = words.filter(
          (word: Word) => word.word && word.definition && word.audio_url
        );
        if (validWords.length < 3) {
          console.error("Not enough valid words in the database.");
          toast({
            description: "Insufficient words in the database.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        const todaysWords = getTodayWords(validWords);
        setSelectedWords(todaysWords);
      }
      setIsLoading(false);
    };
    fetchWords();
  }, [getTodayWords]);

  // Timer effect.
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameData.gameState === "playing" && gameData.timeLeft > 0) {
      timer = setTimeout(
        () =>
          setGameData((prev) => ({ ...prev, timeLeft: prev.timeLeft - 1 })),
        1000
      );
    } else if (gameData.timeLeft === 0 && gameData.gameState === "playing") {
      handleGameEnd();
    }
    return () => clearTimeout(timer);
  }, [gameData.timeLeft, gameData.gameState, setGameData, handleGameEnd]);

  // Handle on-screen keyboard presses.
  const handleKeyPress = (key: string) => {
    if (key === "backspace") {
      setGameData((prev) => ({ ...prev, userInput: prev.userInput.slice(0, -1) }));
    } else if (key === "submit") {
      handleSubmit();
    } else {
      setGameData((prev) => ({ ...prev, userInput: prev.userInput + key }));
    }
  };

  // Play the current word’s audio.
  const playAudio = () => {
    if (!selectedWords[gameData.currentWordIndex]?.audio_url || !audioRef.current)
      return;
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

  // Share the results.
  const shareResults = async () => {
    const shareText = `I just played Spelling B-! I scored ${gameData.score} points. Can you beat that?`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Spelling B- Results",
          text: shareText,
          url: window.location.href,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      navigator.clipboard
        .writeText(shareText)
        .then(() => {
          toast({
            title: "Copied to clipboard!",
            description: "Share your results with friends.",
          });
        })
        .catch((err) => {
          console.error("Failed to copy: ", err);
        });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-lg text-gray-600">Loading game...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-2 relative">
      <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-lg bg-white rounded-xl z-10">
        <CardContent className="p-4">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">Spelling B-</h1>

          {gameData.gameState === "ready" && (
            <div className="space-y-4">
              <p className="text-center text-gray-600">
                Test your spelling skills on everyday words.
                <br />
                Autocorrect won&apos;t save you!
              </p>
              <Button
                onClick={startGame}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                size="lg"
                disabled={gameData.gameState !== "ready"}
              >
                <Play className="mr-2 h-5 w-5" /> Start Game (Sound On)
              </Button>
              {gameData.gameState !== "ready" && (
                <p className="text-center text-2xl font-bold text-gray-800 mt-4">
                  Play again tomorrow!
                </p>
              )}
            </div>
          )}

          {gameData.gameState === "playing" && selectedWords.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-lg font-medium text-gray-700">Score: {gameData.score}</p>
                <p className="text-lg font-medium text-gray-700">Time Left: {gameData.timeLeft}s</p>
              </div>

              <div className="min-h-[3rem]">
                <p className="text-center font-medium text-gray-700">
                  {selectedWords[gameData.currentWordIndex].definition}
                </p>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={playAudio}
                  variant="outline"
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 rounded-md shadow-sm"
                >
                  <Volume2 className="mr-2 h-5 w-5" /> Play Pronunciation
                </Button>
              </div>
              <audio ref={audioRef} />

              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                  <div
                    style={{ width: `${(gameData.timeLeft / TOTAL_TIME) * 100}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500 ease-out"
                  ></div>
                </div>
              </div>

              <div className="bg-gray-100 p-4 rounded-lg border border-gray-200 shadow-inner">
                <p className="text-2xl text-center font-bold text-gray-800 min-h-[40px]">
                  {gameData.userInput || "Type your answer"}
                </p>
              </div>

              <Keyboard
                onKeyPress={handleKeyPress}
                isIpad={isIpad}
                showIpadKeyboard={showIpadKeyboard}
                setShowIpadKeyboard={setShowIpadKeyboard}
              />
            </div>
          )}

          {gameData.gameState === "finished" && (
            <div className="text-center space-y-4">
              <p className="text-3xl font-bold text-gray-800">
                {gameData.correctWordCount > 0 ? "Congratulations!" : "Better luck next time!"}
              </p>

              <div className="mt-4 p-4 bg-gray-100 rounded-lg space-y-4">
                <div className="space-y-3">
                  {gameData.correctWordCount > 0 ? (
                    <>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Correct Words:</p>
                        <div className="border border-green-200 p-2 rounded bg-green-50">
                          <code className="text-lg font-mono text-green-500">
                            {gameData.correctWordCount} × 50 = {gameData.correctWordCount * 50} points
                          </code>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Time Bonus:</p>
                        <div className="border border-green-200 p-2 rounded bg-green-50">
                          <code className="text-lg font-mono text-green-500">
                            {gameData.timeLeft} points
                          </code>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Score:</p>
                        <div className="border border-green-200 p-2 rounded bg-green-50">
                          <code className="text-xl font-mono text-green-500">
                            {gameData.score} points
                          </code>
                        </div>
                      </div>
                      <p className="text-center text-2xl font-bold text-gray-800 mt-4">
                        Play again tomorrow!
                      </p>
                    </>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Score:</p>
                      <div className="border border-red-200 p-2 rounded bg-red-50">
                        <code className="text-xl font-mono text-red-500">0 points</code>
                      </div>
                      <p className="text-center text-2xl font-bold text-gray-800 mt-4">
                        Better luck next time! Play again tomorrow!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={() => {}}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors mt-4"
                size="lg"
              >
                Click for Right Answers
              </Button>

              <Button
                onClick={() => window.open('https://buy.stripe.com/5kAg2qb6R5gjfKw28f', "_blank")}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white transition-colors mt-4"
                size="lg"
              >
                Keep us ad-free
              </Button>

              <Button
                onClick={shareResults}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors mt-4"
                size="lg"
              >
                <Share2 className="mr-2 h-5 w-5" /> Share Results
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}