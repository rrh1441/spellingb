// src/app/game/page.tsx

"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Volume2, Play, Share2 } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import supabase from '@/lib/supabase'
import useIsIpad from '@/hooks/useIsIpad' // Correct import using alias

interface Word {
  id: number
  word: string
  definition: string
  audio_url: string
}

// Helper function to seed a random number generator
const seedRandom = (seed: number): () => number => {
  let value = seed
  return () => {
    // LCG parameters
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

// Deterministic Fisher-Yates Shuffle
const deterministicShuffle = (array: Word[], seed: number): Word[] => {
  const shuffled = [...array]
  const rand = seedRandom(seed)
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function SpellingGame() {
  // Define the total game time in seconds
  const TOTAL_TIME = 60

  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready')
  const [userInput, setUserInput] = useState('')
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [selectedWords, setSelectedWords] = useState<Word[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [score, setScore] = useState(0)
  const [correctWordCount, setCorrectWordCount] = useState<number>(0)
  const [hasPlayedToday, setHasPlayedToday] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Use the custom hook to detect if the device is an iPad
  const isIpad = useIsIpad()

  // Updated Helper function to get today's date in Pacific Time
  const getTodayDate = (): string => {
    const today = new Date()
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Los_Angeles', // Pacific Time Zone
      year: 'numeric',                 // Correct literal type
      month: '2-digit',                // Correct literal type
      day: '2-digit',                  // Correct literal type
    }
    const formatter = new Intl.DateTimeFormat('en-CA', options) // 'en-CA' format is 'YYYY-MM-DD'
    const dateParts = formatter.formatToParts(today)
    
    const year = dateParts.find(part => part.type === 'year')?.value
    const month = dateParts.find(part => part.type === 'month')?.value
    const day = dateParts.find(part => part.type === 'day')?.value

    if (year && month && day) {
      return `${year}-${month}-${day}`
    }

    // Fallback in case of unexpected format
    return today.toISOString().split('T')[0]
  }

  // Function to select three words based on the current date
  const getTodayWords = useCallback((wordList: Word[]): Word[] => {
    const referenceDate = new Date('2023-01-01') // Fixed reference date
    const today = new Date()
    const diffTime = today.getTime() - referenceDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const seed = diffDays // Using days since reference as seed
    const shuffledWords = deterministicShuffle(wordList, seed)
    return [
      shuffledWords[0],
      shuffledWords[1],
      shuffledWords[2]
    ]
  }, [])

  // Check if user has played today
  const hasUserPlayedToday = useCallback((): boolean => {
    const lastPlayedDate = localStorage.getItem('lastPlayedDate')
    const today = getTodayDate()
    return lastPlayedDate === today
  }, [])

  // Save game data to localStorage with specific values
  const saveGameData = useCallback((finalScore: number, correctWords: number, timeLeftValue: number) => {
    const today = getTodayDate()
    localStorage.setItem('lastPlayedDate', today)
    localStorage.setItem('lastScore', finalScore.toString())
    localStorage.setItem('lastCorrectWordCount', correctWords.toString())
    localStorage.setItem('lastTimeLeft', timeLeftValue.toString())
    console.log(`Game Data Saved: Score=${finalScore}, CorrectWords=${correctWords}, TimeLeft=${timeLeftValue}`)
  }, [])

  // Load game data from localStorage
  const loadGameData = useCallback(() => {
    try {
      const storedScore = localStorage.getItem('lastScore')
      const storedCorrectWords = localStorage.getItem('lastCorrectWordCount')
      const storedTimeLeft = localStorage.getItem('lastTimeLeft')
      console.log(`Loaded Game Data: Score=${storedScore}, CorrectWords=${storedCorrectWords}, TimeLeft=${storedTimeLeft}`)

      if (storedScore) {
        setScore(parseInt(storedScore, 10))
      }
      if (storedCorrectWords) {
        const correctWords = parseInt(storedCorrectWords, 10)
        setCorrectWordCount(correctWords)
      }
      if (storedTimeLeft) {
        setTimeLeft(parseInt(storedTimeLeft, 10))
      }
    } catch (error) {
      console.error('Error loading game data:', error)
      toast({
        description: 'Failed to load your previous game data. Starting a new game.',
        variant: "destructive"
      })
      localStorage.removeItem('lastPlayedDate')
      localStorage.removeItem('lastScore')
      localStorage.removeItem('lastCorrectWordCount')
      localStorage.removeItem('lastTimeLeft')
    }
  }, [])

  // Function to handle game end
  const handleGameEnd = useCallback(() => {
    setScore(prev => prev + timeLeft) // Add time bonus to the score
    setGameState('finished')
    saveGameData(score + timeLeft, correctWordCount, timeLeft) // Save all game data
    // Removed the "Time's up" toast notifications
  }, [timeLeft, score, correctWordCount, saveGameData])

  // Function to handle user submission
  const handleSubmit = useCallback(() => {
    if (currentWordIndex >= selectedWords.length) return

    const currentWord = selectedWords[currentWordIndex]
    const isCorrect = userInput.trim().toLowerCase() === currentWord.word.trim().toLowerCase()

    if (isCorrect) {
      setCorrectWordCount(prev => prev + 1) // Update state for UI
      setScore(prev => prev + 50) // Update score immediately
      toast({ description: 'Correct! +50 points.' })
    } else {
      toast({
        description: `Incorrect. The word was "${currentWord.word}"`,
        variant: "destructive"
      })
    }

    // Move to next word
    const nextIndex = currentWordIndex + 1
    if (nextIndex < selectedWords.length && timeLeft > 0) {
      setCurrentWordIndex(nextIndex)
      setUserInput('')

      if (isIpad && inputRef.current) inputRef.current.focus() // Only focus on iPads

      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = selectedWords[nextIndex].audio_url
          audioRef.current.load()
          audioRef.current.play().catch(error => {
            console.error('Failed to play audio:', error)
          })
        }
      }, 500)
    } else {
      // End game if no more words
      handleGameEnd()
    }
  }, [currentWordIndex, selectedWords, timeLeft, handleGameEnd, userInput, isIpad])

  // Function to fetch words from Supabase
  useEffect(() => {
    const fetchWords = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .order('id', { ascending: true }) // Ensure consistent order

      if (error) {
        console.error('Error fetching words:', error)
        toast({
          description: 'Failed to load words. Please refresh.',
          variant: "destructive"
        })
        setIsLoading(false)
        return
      }

      if (data) {
        const validWords = data.filter(word => word.word && word.definition && word.audio_url)
        if (validWords.length < 3) {
          console.error('Not enough valid words in the database.')
          toast({
            description: 'Insufficient words in the database.',
            variant: "destructive"
          })
          setIsLoading(false)
          return
        }
        const todaysWords = getTodayWords(validWords)
        setSelectedWords(todaysWords)
        console.log(`Selected Words for Today: ${todaysWords.map(w => w.word).join(', ')}`) // Debugging Line
      }
      setIsLoading(false)
    }

    fetchWords()
  }, [getTodayWords])

  // Check if user has played today and load game data if so
  useEffect(() => {
    const played = hasUserPlayedToday()
    setHasPlayedToday(played)
    if (played) {
      loadGameData()
      // Delay setting gameState to ensure all data is loaded
      setTimeout(() => {
        setGameState('finished')
      }, 100)
    }
  }, [hasUserPlayedToday, loadGameData])

  // Timer Countdown
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    } else if (timeLeft === 0 && gameState === 'playing') {
      handleGameEnd()
    }
    return () => clearTimeout(timer)
  }, [timeLeft, gameState, handleGameEnd])

  // Handling Keyboard Inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'playing') {
        if (e.key === 'Backspace') {
          setUserInput(prev => prev.slice(0, -1))
        } else if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
          setUserInput(prev => prev + e.key)
        } else if (e.key === 'Enter') {
          handleSubmit()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState, handleSubmit])

  // Function to start the game
  const startGame = () => {
    if (hasPlayedToday) {
      toast({
        description: 'You have already played today. Play again tomorrow!',
        variant: "destructive"
      })
      return
    }

    setGameState('playing')
    setTimeLeft(TOTAL_TIME)
    setUserInput('')
    setScore(0)
    setCorrectWordCount(0)
    setCurrentWordIndex(0)

    // Focus the hidden input to trigger the virtual keyboard only on iPads
    setTimeout(() => {
      if (isIpad && inputRef.current) {
        inputRef.current.focus()
      }
      if (audioRef.current && selectedWords[0]) {
        audioRef.current.src = selectedWords[0].audio_url
        audioRef.current.load()
        audioRef.current.play().catch(error => {
          console.error('Failed to play audio:', error)
        })
      }
    }, 500)
  }

  // Function to play audio pronunciation
  const playAudio = () => {
    const currentWord = selectedWords[currentWordIndex]
    if (!currentWord?.audio_url || !audioRef.current) return

    audioRef.current.src = currentWord.audio_url
    audioRef.current.load()
    audioRef.current.play().catch(error => {
      console.error('Error playing audio:', error)
      toast({
        description: 'Failed to play audio. Please try again.',
        variant: "destructive"
      })
    })
  }

  // Function to handle key presses from the on-screen keyboard
  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setUserInput(prev => prev.slice(0, -1))
    } else if (key === 'submit') {
      handleSubmit()
    } else {
      setUserInput(prev => prev + key)
    }
  }

  // Function to share results
  const shareResults = async () => {
    const shareText = `I just played Spelling B-! I scored ${score} points. Can you beat that? #SpellingBee`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Spelling B- Results',
          text: shareText,
          url: window.location.href,
        })
      } catch (error) {
        console.error('Error sharing:', error)
      }
    } else {
      navigator.clipboard.writeText(shareText).then(() => {
        toast({
          title: "Copied to clipboard!",
          description: "Share your results with friends.",
        })
      }).catch((err) => {
        console.error('Failed to copy: ', err)
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-lg text-gray-600">Loading game...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-2">
      <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-lg bg-white rounded-xl">
        <CardContent className="p-4">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">Spelling B-</h1>

          {/* Game States */}
          {gameState === 'ready' && (
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
                disabled={hasPlayedToday} // Disable if already played
              >
                <Play className="mr-2 h-5 w-5" /> Start Game
              </Button>
              {hasPlayedToday && (
                <p className="text-center text-2xl font-bold text-gray-800 mt-4">
                  Play again tomorrow!
                </p>
              )}
            </div>
          )}

          {gameState === 'playing' && selectedWords.length > 0 && (
            <div className="space-y-4">
              {/* Current Score and Time Left */}
              <div className="flex justify-between items-center">
                <p className="text-lg font-medium text-gray-700">Score: {score}</p>
                <p className="text-lg font-medium text-gray-700">Time Left: {timeLeft}s</p>
              </div>

              {/* Definition */}
              <div className="min-h-[3rem]">
                <p className="text-center font-medium text-gray-700">
                  {selectedWords[currentWordIndex].definition}
                </p>
              </div>

              {/* Audio Button */}
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

              {/* Timer Bar */}
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                  <div
                    style={{ width: `${(timeLeft / TOTAL_TIME) * 100}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500 ease-out"
                  ></div>
                </div>
              </div>

              {/* User Input Display */}
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-200 shadow-inner">
                <p className="text-2xl text-center font-bold text-gray-800 min-h-[40px]">
                  {userInput || 'Type your answer'}
                </p>
              </div>

              {/* Hidden Input for Accessibility */}
              <input
                ref={inputRef}
                type="text"
                className="absolute opacity-0 w-0 h-0 border-none outline-none"
                value={userInput}
                readOnly={!isIpad} // Set readOnly based on device
                onChange={(e) => {
                  if (isIpad) {
                    setUserInput(e.target.value)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
              />

              {/* Improved iOS-like Keyboard */}
              <div className="md:hidden">
                <div className="space-y-4"> {/* Increased vertical spacing between rows */}
                  {[
                    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
                    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
                    ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'del']
                  ].map((row, rowIndex) => (
                    <div key={rowIndex} className="flex justify-center space-x-1"> {/* Increased horizontal spacing */}
                      {row.map(key => {
                        if (key === 'del') {
                          return (
                            <Button
                              key={key}
                              onClick={() => handleKeyPress('backspace')}
                              className="w-12 h-11 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md flex items-center justify-center"
                              aria-label="Delete"
                            >
                              DEL
                            </Button>
                          )
                        }
                        return (
                          <Button
                            key={key}
                            onClick={() => handleKeyPress(key)}
                            className="w-8 h-11 text-lg bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md"
                            aria-label={key.toUpperCase()}
                          >
                            {key.toUpperCase()}
                          </Button>
                        )
                      })}
                    </div>
                  ))}
                  {/* Submit Button on Mobile */}
                  <div className="flex justify-center space-x-1">
                    <Button
                      onClick={() => handleKeyPress('submit')}
                      className="w-24 h-11 bg-blue-500 text-white hover:bg-blue-600 rounded-md flex items-center justify-center text-xl font-semibold"
                      aria-label="Enter"
                    >
                      Enter
                    </Button>
                  </div>
                </div>
              </div>

              {/* Desktop Submit Button */}
              <div className="hidden md:block">
                <Button
                  onClick={handleSubmit}
                  className="w-full px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg font-semibold"
                >
                  Submit
                </Button>
              </div>
            </div>
          )}

          {gameState === 'finished' && (
            <div className="text-center space-y-4">
              <p className="text-3xl font-bold text-gray-800">
                {correctWordCount > 0 ? 'Congratulations!' : 'Better luck next time!'}
              </p>

              {/* Display Score and Message */}
              <div className="mt-4 p-4 bg-gray-100 rounded-lg space-y-4">
                <div className="space-y-3">
                  {correctWordCount > 0 ? (
                    <>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Correct Words:</p>
                        <div className="border border-green-200 p-2 rounded bg-green-50">
                          <code className="text-lg font-mono text-green-500">
                            {correctWordCount} × 50 = {correctWordCount * 50} points
                          </code>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Time Bonus:</p>
                        <div className="border border-green-200 p-2 rounded bg-green-50">
                          <code className="text-lg font-mono text-green-500">
                            {timeLeft} points
                          </code>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Score:</p>
                        <div className="border border-green-200 p-2 rounded bg-green-50">
                          <code className="text-xl font-mono text-green-500">
                            {score} points
                          </code>
                        </div>
                      </div>
                      {/* Updated Message */}
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
                      {/* Updated Message */}
                      <p className="text-center text-2xl font-bold text-gray-800 mt-4">
                        Better luck next time! Play again tomorrow!
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Definition of Last Word:</p>
                    <p className="text-md text-gray-800">
                      {selectedWords[selectedWords.length - 1].definition}
                    </p>
                  </div>
                </div>
              </div>

              {/* Share Results */}
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
  )
}
