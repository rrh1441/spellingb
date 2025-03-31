// src/app/game/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Volume2, Play, Share2, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast"; // Ensure toast is imported
import supabase from "@/lib/supabase"; // Import the potentially null supabase client
import useIsIpad from "@/hooks/useIsIpad";
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
const seedRandom = (seed: number): (() => number) => {
  let value = seed;
  return () => {
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

  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Ensure this state exists
  const [showIpadKeyboard, setShowIpadKeyboard] = useState(false);

  // State for showing/hiding the answers modal
  const [showAnswersModal, setShowAnswersModal] = useState(false);

  // Get today's words based on a deterministic shuffle
  const getTodayWords = useCallback(
    (wordList: Word[]): Word[] => {
      const referenceDate = new Date("2023-01-01");
      const laDateString = getTodayDate();
      const laMidnightUtc = getLaMidnightUtc(laDateString);
      const diffTime = laMidnightUtc.getTime() - referenceDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const shuffledWords = deterministicShuffle(wordList, diffDays);
      // Ensure we don't try to access indices beyond the array length
      return shuffledWords.slice(0, 3);
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
      attempts: Array(selectedWords.length).fill(""),
      currentWordIndex: 0,
      userInput: "",
    }));
  }, [selectedWords.length, setGameData, TOTAL_TIME]); // Added TOTAL_TIME dependency


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
    setGameData((prev) => ({
      ...prev,
      score: prev.score + prev.timeLeft,
      gameState: "finished",
    }));
  }, [setGameData]);


  // Handle submission of an answer
  const handleSubmit = useCallback(() => {
    if (gameData.currentWordIndex >= selectedWords.length) return;

    const currentWord = selectedWords[gameData.currentWordIndex];
    // Guard against currentWord being undefined if selectedWords is empty
    if (!currentWord) return;

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
        // Play the next audio after a short delay
        setTimeout(() => {
          if (audioRef.current && selectedWords[nextIndex]) { // Check next word exists
            audioRef.current.src = selectedWords[nextIndex].audio_url;
            audioRef.current.load();
            audioRef.current
              .play()
              .catch((err) => console.error("Audio play error:", err));
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
        // End the game
        handleGameEnd(); // Call handleGameEnd here
        return {
          ...prev,
          score: newScore, // Ensure final score update is included
          correctWordCount: newCorrectWordCount, // Ensure final count is included
          attempts: newAttempts,
          // No need to call handleGameEnd again, just return the final state
        };
      }
    });
  }, [
    gameData.userInput,
    gameData.currentWordIndex,
    selectedWords,
    setGameData,
    handleGameEnd, // Keep handleGameEnd dependency
  ]);


  // Start the game
  const startGame = useCallback(() => {
    if (gameData.gameState !== "ready") {
      toast({
        description: "You have already played today. Play again tomorrow!",
        variant: "destructive",
      });
      return;
    }
    setStateToInitial(); // Reset state first
    setGameData((prev) => ({
      ...prev,
      gameState: "playing", // Update state *after* reset
    }));
    // Play the initial audio
    setTimeout(() => {
      if (audioRef.current && selectedWords[0]) {
        audioRef.current.src = selectedWords[0].audio_url;
        audioRef.current.load();
        audioRef.current
          .play()
          .catch((error) => console.error("Failed to play audio:", error));
      }
    }, 500);
  }, [gameData.gameState, selectedWords, setGameData, setStateToInitial]); // Added dependencies


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
            userInput: prev.userInput + e.key.toLowerCase(), // Ensure consistency
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


  // Fetch words from Supabase
  useEffect(() => {
    const fetchWords = async () => {
      setIsLoading(true);

      // --- ADDED CHECK FOR NULL SUPABASE CLIENT ---
      if (!supabase) {
        console.error("Supabase client is not initialized. Cannot fetch words.");
        toast({
          title: "Error",
          description: "Game configuration error. Please check setup or try again later.",
          variant: "destructive",
        });
        setIsLoading(false); // Stop loading indicator
        return; // Exit the function early
      }
      // --- END OF CHECK ---

      // Proceed only if supabase client is valid
      try {
        const { data, error } = await supabase
          .from("audio_files")
          .select("*")
          .order("id", { ascending: true });

        if (error) {
          console.error("Error fetching words:", error);
          toast({
            description: `Failed to load words: ${error.message}. Please refresh.`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (data) {
          const words: Word[] = data as Word[];
          const validWords = words.filter(
            (w) => w.word && w.definition && w.audio_url
          );
          if (validWords.length < 3) {
            console.error("Not enough valid words in the database.");
            toast({
              description: "Insufficient words available for today's game.",
              variant: "destructive",
            });
            // Set selectedWords to empty array or handle as needed
            setSelectedWords([]);
          } else {
             const todaysWords = getTodayWords(validWords);
             setSelectedWords(todaysWords);
             // Initialize attempts array based on the actual words fetched
             setGameData(prev => ({ ...prev, attempts: Array(todaysWords.length).fill("") }));
          }
        } else {
            // Handle case where data is null/undefined but no error occurred
            console.error("No data received from Supabase, but no error reported.");
            toast({
              description: "Could not retrieve words. Please try again.",
              variant: "destructive",
            });
            setSelectedWords([]); // Ensure selectedWords is empty
        }

      } catch (err) {
          // Catch any unexpected errors during the async operation
          console.error("Unexpected error during fetchWords:", err);
           toast({
              description: "An unexpected error occurred while loading words.",
              variant: "destructive",
            });
          setSelectedWords([]); // Reset words on unexpected error
      } finally {
           setIsLoading(false); // Ensure loading state is always turned off
      }
    };

    fetchWords();
  // Add getTodayWords and setGameData to dependency array if they are stable (useCallback helps)
  }, [getTodayWords, setGameData]);


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
    if (gameData.gameState !== "playing") return; // Prevent input if not playing

    if (key === "backspace") {
      setGameData((prev) => ({
        ...prev,
        userInput: prev.userInput.slice(0, -1),
      }));
    } else if (key === "submit") {
      handleSubmit();
    } else {
      // Add character (ensure consistency, e.g., lowercase)
      setGameData((prev) => ({ ...prev, userInput: prev.userInput + key.toLowerCase() }));
    }
  };


  // Play current word's audio
  const playAudio = () => {
    // Ensure game is playing and word index is valid
     if (
       gameData.gameState !== 'playing' ||
       gameData.currentWordIndex >= selectedWords.length ||
       !selectedWords[gameData.currentWordIndex]?.audio_url ||
       !audioRef.current
     ) {
         console.warn("Cannot play audio: Invalid state or missing data/ref.");
         return;
     }

    audioRef.current.src = selectedWords[gameData.currentWordIndex].audio_url;
    audioRef.current.load(); // Good practice to call load() before play() when changing src
    audioRef.current.play().catch((error) => {
      console.error("Error playing audio:", error);
      toast({
        description: "Failed to play audio. Please try again.",
        variant: "destructive",
      });
    });
  };


  // Share results
  const shareResults = async () => {
    const shareText = `I just played Spelling B-! My score: ${gameData.score} points. Correct: ${gameData.correctWordCount}/${selectedWords.length}. Can you beat that? #SpellingB`;
    const shareData = {
        title: "Spelling B- Results",
        text: shareText,
        url: window.location.href, // Share the game URL
    }

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast({ description: "Results shared!" });
      } catch (error) {
        console.error("Error sharing:", error);
        // Handle specific errors like AbortError if needed
         if ((error as DOMException).name !== 'AbortError') {
            toast({ description: "Sharing failed.", variant: "destructive" });
        }
      }
    } else {
        // Fallback for browsers without navigator.share or if data can't be shared
      try {
          await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
          toast({
            title: "Copied to clipboard!",
            description: "Share your results with friends.",
          });
      } catch(err) {
          console.error("Failed to copy results to clipboard: ", err);
          toast({ description: "Could not copy results.", variant: "destructive" });
      }
    }
  };


  // Loading State UI
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-lg text-gray-600">Loading today&apos;s words...</p>
        {/* Optional: Add a spinner here */}
      </div>
    );
  }

  // Main Game UI
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-2 relative">
      <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-lg bg-white rounded-xl z-10">
        <CardContent className="p-4">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">
            Spelling B-
          </h1>

          {/* ----- READY STATE ----- */}
          {gameData.gameState === "ready" && (
            <div className="space-y-4">
              <p className="text-center text-gray-600">
                Test your spelling skills on everyday words.
                <br />
                Autocorrect won&apos;t save you! Ready?
              </p>
              <Button
                onClick={startGame}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                size="lg"
                // Disable button if loading or no words are selected yet
                disabled={isLoading || selectedWords.length === 0}
              >
                <Play className="mr-2 h-5 w-5" /> Start Game (Sound On)
              </Button>
               {/* Show message if already played */}
               {/* This condition might need adjustment based on how gameState is persisted */}
               {/* If gameState loads as 'finished', this might show incorrectly */}
               {/* Consider a separate flag or checking the date */}
                {/* {gameData.gameState !== "ready" && (
                <p className="text-center text-2xl font-bold text-gray-800 mt-4">
                   Play again tomorrow!
                 </p>
               )} */}
                {/* Show message if words couldn't load */}
                {!isLoading && selectedWords.length === 0 && (
                   <p className="text-center text-red-600 mt-4">
                       Could not load words for today. Please try refreshing.
                   </p>
               )}
            </div>
          )}

          {/* ----- PLAYING STATE ----- */}
          {gameData.gameState === "playing" && selectedWords.length > 0 && gameData.currentWordIndex < selectedWords.length && (
            <div className="space-y-4">
              {/* Score & Timer */}
              <div className="flex justify-between items-center">
                <p className="text-lg font-medium text-gray-700">
                  Score: {gameData.score}
                </p>
                <p className="text-lg font-medium text-gray-700">
                  Time Left: {gameData.timeLeft}s
                </p>
              </div>

              {/* Definition */}
              <div className="min-h-[3rem] flex items-center justify-center">
                <p className="text-center font-medium text-gray-700">
                  {selectedWords[gameData.currentWordIndex]?.definition || "Loading definition..."}
                </p>
              </div>

              {/* Audio Button */}
              <div className="flex justify-center">
                <Button
                  onClick={playAudio}
                  variant="outline"
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 rounded-md shadow-sm"
                  // Disable if audioRef isn't ready or no URL
                  disabled={!audioRef.current || !selectedWords[gameData.currentWordIndex]?.audio_url}
                >
                  <Volume2 className="mr-2 h-5 w-5" /> Play Pronunciation
                </Button>
              </div>
              {/* Ensure audio element is always rendered for the ref */}
              <audio ref={audioRef} preload="auto" />

              {/* Timer Bar */}
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                  <div
                    style={{
                      width: `${(gameData.timeLeft / TOTAL_TIME) * 100}%`,
                    }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500 ease-linear" // Use linear for smoother timer updates
                  ></div>
                </div>
              </div>

              {/* User Input Display */}
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-200 shadow-inner">
                <p className="text-2xl text-center font-mono text-gray-800 min-h-[40px] tracking-widest"> {/* Use monospace and wider tracking */}
                  {/* Add a blinking cursor effect (optional) */}
                  {gameData.userInput || <span className="text-gray-400">Type your answer</span>}
                   {/* Example Blinking Cursor: <span className="animate-pulse">|</span> */}
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
                {gameData.correctWordCount > 0
                  ? "Game Over! Well Done!"
                  : "Game Over! Better Luck Next Time!"}
              </p>

              {/* Results Box */}
              <div className="mt-4 p-4 bg-gray-100 rounded-lg space-y-4">
                 <h2 className="text-xl font-semibold mb-2">Your Results</h2>
                <div className="space-y-3">
                   {/* Only show score breakdown if points were scored */}
                   {gameData.score > 0 ? (
                    <>
                      {gameData.correctWordCount > 0 && (
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Correct Words:</p>
                            <div className="border border-green-200 p-2 rounded bg-green-50">
                            <code className="text-lg font-mono text-green-600">
                                {gameData.correctWordCount} × 50 = {gameData.correctWordCount * 50} points
                            </code>
                            </div>
                        </div>
                      )}
                       {/* Only show time bonus if it's positive */}
                      {(gameData.score - gameData.correctWordCount * 50) > 0 && (
                           <div>
                            <p className="text-sm text-gray-600 mb-1">Time Bonus:</p>
                            <div className="border border-blue-200 p-2 rounded bg-blue-50"> {/* Changed color */}
                                <code className="text-lg font-mono text-blue-600">
                                {gameData.score - gameData.correctWordCount * 50} points
                                </code>
                            </div>
                            </div>
                      )}
                       <div>
                        <p className="text-sm text-gray-600 mb-1">Total Score:</p>
                        <div className="border border-indigo-200 p-2 rounded bg-indigo-50"> {/* Changed color */}
                            <code className="text-xl font-mono text-indigo-600 font-bold"> {/* Made bold */}
                            {gameData.score} points
                            </code>
                        </div>
                        </div>
                     </>
                  ) : (
                     // Message for zero score
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Score:</p>
                        <div className="border border-red-200 p-2 rounded bg-red-50">
                            <code className="text-xl font-mono text-red-500">0 points</code>
                        </div>
                      </div>
                  )}
                  </div>
                </div> {/* End Results Box */}

                <p className="text-center text-lg font-medium text-gray-700 mt-4">
                     Come back tomorrow for a new challenge!
                </p>

                {/* Button to show the answers modal */}
                <Button
                   onClick={() => setShowAnswersModal(true)}
                   className="w-full bg-gray-500 hover:bg-gray-600 text-white transition-colors mt-4" // Changed color
                   size="lg"
                 >
                   Review Your Answers
                 </Button>

                {/* Keep us ad-free */}
                <Button
                    onClick={() => window.open("https://buy.stripe.com/5kAg2qb6R5gjfKw28f", "_blank")}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white transition-colors mt-2" // Reduced margin
                    size="lg"
                 >
                   Support Spelling B- (Ad-Free)
                 </Button>

                {/* Share Results */}
                 <Button
                   onClick={shareResults}
                   className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors mt-2" // Reduced margin
                   size="lg"
                   disabled={!navigator.clipboard && (!navigator.share || !navigator.canShare)} // Disable if no sharing mechanism
                 >
                   <Share2 className="mr-2 h-5 w-5" /> Share Your Score
                 </Button>
            </div>
           )}
        </CardContent>
      </Card>

      {/* ----- Answers Modal ----- */}
      {showAnswersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"> {/* Added padding */}
          <div className="bg-white rounded-lg p-6 w-full max-w-md relative shadow-xl"> {/* Adjusted max-width */}
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-200 transition-colors" // Improved styling
              onClick={() => setShowAnswersModal(false)}
              aria-label="Close answers modal" // Accessibility
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold text-center mb-5"> {/* Increased margin */}
              Your Attempts vs. Correct Answers
            </h2>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2"> {/* Added max height and scroll */}
              {selectedWords.map((word, i) => {
                 // Ensure attempt exists, default to empty string if not
                const attempt = gameData.attempts[i] ?? ""; // Use nullish coalescing
                const isCorrect =
                  attempt.trim().toLowerCase() ===
                  word.word.trim().toLowerCase();
                return (
                  <div key={word.id} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 items-stretch"> {/* Adjusted layout */}
                      {/* Your Attempt */}
                      <div className={`flex-1 p-3 rounded border ${
                          isCorrect ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
                      }`}>
                         <p className="text-xs text-gray-500 mb-1">Your Input:</p>
                          <p className={`text-lg font-mono break-words ${ // Allow long words to wrap
                              isCorrect ? "text-green-700" : "text-red-700"
                          }`}>
                              {attempt || <span className="italic text-gray-400">(no attempt)</span>}
                          </p>
                      </div>
                       {/* Correct Answer */}
                      {!isCorrect && ( // Only show correct answer if attempt was wrong
                         <div className="flex-1 p-3 rounded border border-gray-300 bg-gray-50">
                           <p className="text-xs text-gray-500 mb-1">Correct Spelling:</p>
                           <p className="text-lg font-mono break-words text-gray-700">
                             {word.word}
                           </p>
                         </div>
                      )}
                  </div>
                );
              })}
               {/* Handle case where there are no selected words (shouldn't happen if modal shown) */}
               {selectedWords.length === 0 && (
                   <p className="text-center text-gray-500">No words to review.</p>
               )}
            </div>
            {/* Optional: Add a close button at the bottom */}
            <div className="text-center mt-4">
                <Button variant="outline" onClick={() => setShowAnswersModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}